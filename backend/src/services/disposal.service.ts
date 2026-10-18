import { DEFAULT_MUNICIPALITY, type Disposal, type MaterialCode } from '@ecoclasifica/shared';
import type { Logger } from 'pino';
import type { DisposalRule, DisposalRulesRepo } from '../repositories/disposalRules.repo';

export const RULES_CACHE_TTL_MS = 10 * 60 * 1000;
/** Tras un fallo con caché vencida, espera esto antes de volver a consultar Supabase. */
export const RULES_RETRY_MS = 60 * 1000;

export interface DisposalResolver {
  /** Devuelve el destino del material, o `null` si no hay reglas disponibles (nunca lanza). */
  resolve(material: MaterialCode, municipalityCode: string, log: Logger): Promise<Disposal | null>;
}

interface ResolverOptions {
  ttlMs?: number;
  now?: () => number;
}

/** Resuelve el contenedor con `disposal_rules` (ADR-7), cacheando la tabla en memoria. */
export function createDisposalResolver(
  repo: DisposalRulesRepo,
  { ttlMs = RULES_CACHE_TTL_MS, now = Date.now }: ResolverOptions = {},
): DisposalResolver {
  let cache: { rules: DisposalRule[]; loadedAt: number } | undefined;
  let pending: Promise<DisposalRule[]> | undefined;

  async function load(): Promise<DisposalRule[]> {
    const rules = await repo.listAll();
    cache = { rules, loadedAt: now() };
    return rules;
  }

  async function getRules(log: Logger): Promise<DisposalRule[] | null> {
    if (cache && now() - cache.loadedAt < ttlMs) return cache.rules;
    try {
      pending ??= load().finally(() => (pending = undefined));
      return await pending;
    } catch (err) {
      // Solo el mensaje: un error de Zod incluiría el contenido de las filas.
      const reason = err instanceof Error ? err.message : String(err);
      if (cache) {
        cache.loadedAt = now() - ttlMs + RULES_RETRY_MS;
        log.warn(
          { reason },
          'No se pudieron recargar las reglas de disposición; se usa la caché vencida',
        );
        return cache.rules;
      }
      log.error({ reason }, 'No se pudieron cargar las reglas de disposición');
      return null;
    }
  }

  return {
    async resolve(material, municipalityCode, log) {
      const rules = await getRules(log);
      if (!rules) return null;
      const rule = findRule(rules, material, municipalityCode, log);
      return rule ? toDisposal(rule) : null;
    },
  };
}

/** `(material, municipio)` → `(material, DEFAULT)` → contenedor negro por defecto. */
function findRule(
  rules: DisposalRule[],
  material: MaterialCode,
  municipalityCode: string,
  log: Logger,
): DisposalRule | undefined {
  const match = (m: MaterialCode, code: string) =>
    rules.find((r) => r.materialCode === m && r.municipalityCode === code);
  const rule = match(material, municipalityCode) ?? match(material, DEFAULT_MUNICIPALITY);
  if (rule) return rule;

  const fallback = rules.find(
    (r) => r.municipalityCode === DEFAULT_MUNICIPALITY && r.binCode === 'BLACK',
  );
  if (fallback) {
    log.warn(
      { material, municipalityCode },
      'Sin regla de disposición; se usa el contenedor negro',
    );
  } else {
    log.error(
      { material, municipalityCode },
      'Sin regla de disposición ni contenedor negro DEFAULT',
    );
  }
  return fallback;
}

function toDisposal(rule: DisposalRule): Disposal {
  return {
    binCode: rule.binCode,
    binName: rule.binName,
    colorHex: rule.colorHex,
    icon: rule.icon,
    instructions: rule.instructions,
    requiresDropOff: rule.requiresDropOff,
  };
}
