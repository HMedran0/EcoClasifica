import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { errorHandler, notFound } from './middlewares/errorHandler';
import { createScanLimiter } from './middlewares/rateLimit';
import {
  createSupabaseDisposalRulesRepo,
  type DisposalRulesRepo,
} from './repositories/disposalRules.repo';
import { createV1Routes, routes } from './routes';
import { lazyAiProvider, type AiProvider } from './services/ai';
import { createDisposalResolver } from './services/disposal.service';
import { logger } from './utils/logger';

export interface AppDeps {
  /** Proveedor de IA inyectable (simulado en pruebas). */
  aiProvider?: AiProvider;
  /** Reglas de contenedores inyectables (en memoria en pruebas). */
  disposalRepo?: DisposalRulesRepo;
}

export function createApp(deps: AppDeps = {}) {
  const aiProvider = deps.aiProvider ?? lazyAiProvider();
  // Caché de reglas por instancia, como el rate limiter (ADR-14).
  const disposal = createDisposalResolver(deps.disposalRepo ?? createSupabaseDisposalRulesRepo());
  const app = express();

  // Detrás del proxy de Railway: necesario para ver la IP real en el rate limiting.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(pinoHttp({ logger, genReqId: () => randomUUID() }));
  app.use(helmet());
  app.use(
    cors({
      origin: env.ALLOWED_ORIGINS,
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
  // Antes del parser: se rechaza el exceso sin leer ni parsear hasta 6 MB por petición.
  app.use('/api/v1/scan', createScanLimiter());
  // 6 MB: la imagen (≤ 4 MB) viaja en Base64, que pesa ~33 % más.
  app.use(express.json({ limit: '6mb' }));

  app.use('/api', routes);
  app.use('/api/v1', createV1Routes({ ai: aiProvider, disposal }));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
