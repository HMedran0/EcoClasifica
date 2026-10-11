import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { errorHandler, notFound } from './middlewares/errorHandler';
import { routes, v1Routes } from './routes';
import type { AiProvider } from './services/ai/ai.provider';
import { logger } from './utils/logger';

export interface AppDeps {
  /** Proveedor de IA inyectable (simulado en pruebas). */
  aiProvider?: AiProvider;
}

export function createApp(_deps: AppDeps = {}) {
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
  // 6 MB: la imagen (≤ 4 MB) viaja en Base64, que pesa ~33 % más.
  app.use(express.json({ limit: '6mb' }));

  app.use('/api', routes);
  app.use('/api/v1', v1Routes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
