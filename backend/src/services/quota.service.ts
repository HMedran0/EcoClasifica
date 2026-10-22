import { createHmac } from 'node:crypto';
import { isIPv6 } from 'node:net';
import type { Request, RequestHandler } from 'express';
import type { Logger } from 'pino';
import type {
  AiEndpoint,
  AiUsageRepo,
  AiUsageRow,
  UsageSubject,
} from '../repositories/aiUsage.repo';
import { AppError } from '../utils/appError';
import { AiCallError, type AiProvider, type AiUsage } from './ai/ai.provider';

/** Colombia no tiene horario de verano: America/Bogota es siempre UTC−5. */
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Medianoche de America/Bogota del día de `now`, como instante UTC. */
export function startOfBogotaDay(now: Date): Date {
  const local = now.getTime() - BOGOTA_OFFSET_MS;
  return new Date(local - (((local % DAY_MS) + DAY_MS) % DAY_MS) + BOGOTA_OFFSET_MS);
}

/** Segundos hasta la próxima medianoche de Bogotá (para `Retry-After`). */
export function secondsUntilBogotaMidnight(now: Date): number {
  const next = startOfBogotaDay(now).getTime() + DAY_MS;
  return Math.ceil((next - now.getTime()) / 1000);
}

/**
 * Clave de cuota de una IP. `::ffff:1.2.3.4` y `1.2.3.4` son la misma IPv4. Una IPv6 se agrupa
 * por su /64: cada cliente suele tener un /64 entero y podría rotar de dirección dentro de él.
 */
export function ipQuotaKey(ip: string): string {
  const unmapped = ip.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, '');
  if (!isIPv6(unmapped)) return unmapped;
  // Una IPv4 al final (`64:ff9b::1.2.3.4`) ocupa dos grupos.
  const groups = (part: string) =>
    part ? part.split(':').flatMap((g) => (g.includes('.') ? ['0', '0'] : [g])) : [];
  const [head = '', tail] = unmapped.split('::');
  const left = groups(head);
  const right = tail === undefined ? [] : groups(tail);
  const full = [...left, ...Array<string>(8 - left.length - right.length).fill('0'), ...right];
  return `${full
    .slice(0, 4)
    .map((g) => parseInt(g, 16).toString(16))
    .join(':')}::/64`;
}

/** HMAC-SHA256 en hexadecimal: sin la sal no se puede revertir ni cruzar con otras bases. */
export function hashIp(ip: string, salt: string): string {
  return createHmac('sha256', salt).update(ipQuotaKey(ip)).digest('hex');
}

export type QuotaKind = 'scan' | 'chat';

const ENDPOINTS: Record<QuotaKind, AiEndpoint[]> = {
  scan: ['classify', 'upcycle'],
  chat: ['chat'],
};

export interface QuotaLimits {
  userScans: number;
  userChat: number;
  anonScans: number;
  anonChat: number;
  dailyTokenCap: number;
  /** Fracción del tope global a partir de la cual se corta a los anónimos (0,7 = 70 %). */
  anonTokenShare: number;
}

export interface UsageMeterDeps {
  repo: AiUsageRepo;
  limits: QuotaLimits;
  ipSalt: string;
  /** Reloj inyectable: las pruebas cambian de día sin esperar. */
  now?: () => Date;
}

const RESET = 'Se reinicia a medianoche (hora de Colombia).';

function quotaMessage(kind: QuotaKind, limit: number, withSession: boolean): string {
  const what = kind === 'scan' ? `${limit} escaneos` : `${limit} mensajes de chat`;
  return withSession
    ? `Llegaste al límite de hoy: ${what}. ${RESET}`
    : `Desde esta conexión se alcanzó el límite de hoy sin cuenta: ${what}. ` +
        `Crea una cuenta gratis para seguir hoy. ${RESET}`;
}

const ANON_PAUSED =
  'Hoy hay mucha demanda y el uso sin cuenta llegó a su límite. ' +
  `Crea una cuenta gratis para seguir hoy. ${RESET}`;

/** Lo que se registra de cada llamada; `scanId` se conoce al final (después de guardar). */
type PendingRow = Omit<AiUsageRow, 'scanId'>;

export interface RequestUsage {
  /** El proveedor que deja constancia de cada llamada, también de las fallidas. */
  ai: AiProvider;
  /** Registra las llamadas de la petición. Nunca lanza: un fallo deja un `warn`. */
  flush(scanId: string | null): Promise<void>;
}

/**
 * HU-20: cuota diaria de IA. `checkQuota` corta antes de llamar a la IA y `track` registra cada
 * llamada en `ai_usage`. Si Supabase falla se deja pasar: el piloto no se bloquea por la métrica.
 */
export function createUsageMeter({ repo, limits, ipSalt, now = () => new Date() }: UsageMeterDeps) {
  const subjectOf = (req: Request): UsageSubject =>
    req.user ? { userId: req.user.id } : { ipHash: hashIp(req.ip ?? 'unknown', ipSalt) };

  const limitFor = (kind: QuotaKind, withSession: boolean) =>
    kind === 'scan'
      ? withSession
        ? limits.userScans
        : limits.anonScans
      : withSession
        ? limits.userChat
        : limits.anonChat;

  function checkQuota(kind: QuotaKind): RequestHandler {
    return async (req, res, next) => {
      const at = now();
      const since = startOfBogotaDay(at);
      let used: number;
      let tokens: number;
      try {
        [used, tokens] = await Promise.all([
          repo.countSince(subjectOf(req), ENDPOINTS[kind], since),
          repo.tokensSince(since),
        ]);
      } catch (err) {
        // Solo el mensaje (trae el código de Postgres): nunca datos de la petición.
        req.log.warn(
          { kind, error: err instanceof Error ? err.message : 'desconocido' },
          'No se pudo contar la cuota de IA; se deja pasar',
        );
        return next();
      }
      const reject = (error: AppError) => {
        res.set('Retry-After', String(secondsUntilBogotaMidnight(at)));
        next(error);
      };
      if (tokens >= limits.dailyTokenCap) {
        req.log.warn({ kind, tokens, cap: limits.dailyTokenCap }, 'Tope global de tokens de IA');
        return reject(new AppError('SERVICE_PAUSED', `Servicio en pausa por hoy. ${RESET}`));
      }
      const withSession = !!req.user;
      // El último 30 % del tope queda reservado para quien tiene cuenta.
      const anonCap = limits.dailyTokenCap * limits.anonTokenShare;
      if (!withSession && tokens >= anonCap) {
        req.log.warn({ kind, tokens, anonCap }, 'Tope de tokens de IA para anónimos');
        return reject(new AppError('QUOTA_EXCEEDED', ANON_PAUSED));
      }
      const limit = limitFor(kind, withSession);
      if (used >= limit) {
        req.log.info({ kind, withSession, limit }, 'Cuota diaria de IA agotada');
        return reject(new AppError('QUOTA_EXCEEDED', quotaMessage(kind, limit, withSession)));
      }
      next();
    };
  }

  /** Envuelve `inner` para esta petición: cada llamada queda pendiente hasta `flush`. */
  function track(req: Request, inner: AiProvider): RequestUsage {
    const subject = subjectOf(req);
    const pending: PendingRow[] = [];

    async function metered<T extends { usage: AiUsage }>(
      endpoint: AiEndpoint,
      call: () => Promise<T>,
    ): Promise<T> {
      const started = Date.now();
      const push = (usage: AiUsage | null) =>
        pending.push({
          endpoint,
          userId: 'userId' in subject ? subject.userId : null,
          ipHash: 'ipHash' in subject ? subject.ipHash : null,
          promptTokens: usage?.promptTokens ?? null,
          completionTokens: usage?.completionTokens ?? null,
          latencyMs: Date.now() - started,
        });
      try {
        const result = await call();
        push(result.usage);
        return result;
      } catch (err) {
        // También cuestan: con los tokens que el proveedor alcanzó a informar.
        push(err instanceof AiCallError ? err.usage : null);
        throw err;
      }
    }

    const ai: AiProvider = {
      classify: (image) => metered('classify', () => inner.classify(image)),
      upcycle: (image) => metered('upcycle', () => inner.upcycle(image)),
      chat: (idea, messages) => metered('chat', () => inner.chat(idea, messages)),
    };

    return {
      ai,
      async flush(scanId) {
        const rows = pending.splice(0);
        await Promise.all(rows.map((row) => record(repo, { ...row, scanId }, req.log)));
      },
    };
  }

  return { checkQuota, track };
}

export type UsageMeter = ReturnType<typeof createUsageMeter>;

async function record(repo: AiUsageRepo, row: AiUsageRow, log: Logger) {
  try {
    await repo.record(row);
  } catch (err) {
    log.warn(
      { endpoint: row.endpoint, error: err instanceof Error ? err.message : 'desconocido' },
      'No se pudo registrar el uso de IA',
    );
  }
}
