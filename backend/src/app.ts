import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import { allowedOrigins, env } from './config/env';
import { createAuthMiddlewares } from './middlewares/auth';
import { errorHandler, notFound } from './middlewares/errorHandler';
import { createChatLimiter, createScanLimiter } from './middlewares/rateLimit';
import {
  createSupabaseDisposalRulesRepo,
  type DisposalRulesRepo,
} from './repositories/disposalRules.repo';
import {
  createSupabaseChatMessagesRepo,
  type ChatMessagesRepo,
} from './repositories/chatMessages.repo';
import { createSupabaseFavoritesRepo, type FavoritesRepo } from './repositories/favorites.repo';
import { createSupabaseAiUsageRepo, type AiUsageRepo } from './repositories/aiUsage.repo';
import { createSupabaseAccountsRepo, type AccountsRepo } from './repositories/accounts.repo';
import { createSupabaseProfilesRepo, type ProfilesRepo } from './repositories/profiles.repo';
import { createSupabaseScansRepo, type ScansRepo } from './repositories/scans.repo';
import { createV1Routes, routes } from './routes';
import { lazyAiProvider, type AiProvider } from './services/ai';
import { createSupabaseTokenVerifier, type TokenVerifier } from './services/auth.service';
import { createDisposalResolver } from './services/disposal.service';
import { createUsageMeter } from './services/quota.service';
import { httpLogLevel, logger } from './utils/logger';

export interface AppDeps {
  /** Proveedor de IA inyectable (simulado en pruebas). */
  aiProvider?: AiProvider;
  /** Reglas de contenedores inyectables (en memoria en pruebas). */
  disposalRepo?: DisposalRulesRepo;
  /** Verificación del JWT de Supabase inyectable (simulada en pruebas). */
  tokenVerifier?: TokenVerifier;
  /** Perfiles inyectables (en memoria en pruebas). */
  profilesRepo?: ProfilesRepo;
  /** Historial de escaneos inyectable (en memoria en pruebas). */
  scansRepo?: ScansRepo;
  /** Favoritos inyectables (en memoria en pruebas). */
  favoritesRepo?: FavoritesRepo;
  /** Hilos del chat guardados inyectables (en memoria en pruebas). */
  chatMessagesRepo?: ChatMessagesRepo;
  /** Registro y conteo de `ai_usage` inyectable (en memoria en pruebas, HU-20). */
  aiUsageRepo?: AiUsageRepo;
  /** Usuarios de Auth inyectables (simulados en pruebas, HU-22). */
  accountsRepo?: AccountsRepo;
  /** Reloj de la cuota diaria inyectable (las pruebas cambian de día). */
  now?: () => Date;
  /** Logger de peticiones inyectable (las pruebas capturan su salida). */
  logger?: Logger;
}

/** Solo desarrollo y pruebas. */
const DEV_IP_HASH_SALT = 'ecoclasifica-dev-ip-hash-salt-no-usar-en-produccion';

export function createApp(deps: AppDeps = {}) {
  const aiProvider = deps.aiProvider ?? lazyAiProvider();
  // Caché de reglas por instancia, como el rate limiter (ADR-14).
  const disposal = createDisposalResolver(deps.disposalRepo ?? createSupabaseDisposalRulesRepo());
  const auth = createAuthMiddlewares(deps.tokenVerifier ?? createSupabaseTokenVerifier());
  const profiles = deps.profilesRepo ?? createSupabaseProfilesRepo();
  const scans = deps.scansRepo ?? createSupabaseScansRepo();
  const favorites = deps.favoritesRepo ?? createSupabaseFavoritesRepo();
  const chatMessages = deps.chatMessagesRepo ?? createSupabaseChatMessagesRepo();
  const accounts = deps.accountsRepo ?? createSupabaseAccountsRepo();
  const meter = createUsageMeter({
    repo: deps.aiUsageRepo ?? createSupabaseAiUsageRepo(),
    limits: {
      userScans: env.QUOTA_USER_SCANS,
      userChat: env.QUOTA_USER_CHAT,
      anonScans: env.QUOTA_ANON_SCANS,
      anonChat: env.QUOTA_ANON_CHAT,
      dailyTokenCap: env.AI_DAILY_TOKEN_CAP,
      anonTokenShare: env.AI_ANON_TOKEN_SHARE,
    },
    // En producción el arranque exige IP_HASH_SALT (productionConfigErrors).
    ipSalt: env.IP_HASH_SALT ?? DEV_IP_HASH_SALT,
    ...(deps.now ? { now: deps.now } : {}),
  });
  const app = express();

  // Detrás del proxy de Railway: necesario para ver la IP real en el rate limiting.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    pinoHttp({
      logger: deps.logger ?? logger,
      genReqId: () => randomUUID(),
      customLogLevel: httpLogLevel,
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: allowedOrigins(env),
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
  // Antes del parser: se rechaza el exceso sin leer ni parsear hasta 6 MB por petición.
  app.use('/api/v1/scan', createScanLimiter());
  // Solo enviar mensajes cuenta en el límite; leer el hilo guardado (GET) no.
  app.post('/api/v1/chat', createChatLimiter());
  // El chat es solo texto (≤ 50 mensajes de 1 000 caracteres): no necesita el límite de 6 MB.
  app.use('/api/v1/chat', express.json({ limit: '64kb' }));
  // 6 MB: la imagen (≤ 4 MB) viaja en Base64, que pesa ~33 % más.
  app.use(express.json({ limit: '6mb' }));

  app.use('/api', routes);
  app.use(
    '/api/v1',
    createV1Routes(
      { ai: aiProvider, disposal, profiles, scans, favorites, chatMessages, accounts, meter },
      auth,
    ),
  );

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
