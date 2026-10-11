import { Router } from 'express';
import { healthRoutes } from './health.routes';

export const routes = Router();

routes.use(healthRoutes);

// Rutas de negocio (se añaden por historia, ver docs/BACKLOG.md):
//   F1: scan.routes.ts      → POST /api/v1/scan/classify          (HU-05, HU-06, HU-07)
//   F3: scan.routes.ts      → POST /api/v1/scan/upcycle           (HU-09)
//       chat.routes.ts      → POST /api/v1/chat                   (HU-11)
//   F4: history.routes.ts, favorites.routes.ts                    (HU-12 a HU-16)
export const v1Routes = Router();
