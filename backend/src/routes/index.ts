import { Router } from 'express';
import type { AiProvider } from '../services/ai/ai.provider';
import { healthRoutes } from './health.routes';
import { createScanRoutes } from './scan.routes';

export const routes = Router();

routes.use(healthRoutes);

// Rutas de negocio (se añaden por historia, ver docs/BACKLOG.md):
//   F1: scan.routes.ts      → POST /api/v1/scan/classify          (HU-05, HU-06, HU-07)
//   F3: scan.routes.ts      → POST /api/v1/scan/upcycle           (HU-09)
//       chat.routes.ts      → POST /api/v1/chat                   (HU-11)
//   F4: history.routes.ts, favorites.routes.ts                    (HU-12 a HU-16)
export function createV1Routes(deps: { aiProvider: AiProvider }) {
  const v1 = Router();
  v1.use(createScanRoutes(deps.aiProvider));
  return v1;
}
