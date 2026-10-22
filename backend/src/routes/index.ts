import { Router } from 'express';
import type { ChatControllerDeps } from '../controllers/chat.controller';
import type { ScanDeps } from '../controllers/scan.controller';
import type { AuthMiddlewares } from '../middlewares/auth';
import type { FavoritesDeps } from '../services/favorites.service';
import type { HistoryDeps } from '../services/history.service';
import type { MeDeps } from '../services/me.service';
import { createChatRoutes } from './chat.routes';
import { createFavoritesRoutes } from './favorites.routes';
import { healthRoutes } from './health.routes';
import { createHistoryRoutes } from './history.routes';
import { createMeRoutes } from './me.routes';
import { createScanRoutes } from './scan.routes';

export const routes = Router();

routes.use(healthRoutes);

// Rutas de negocio (se añaden por historia, ver docs/BACKLOG.md):
//   F1: scan.routes.ts      → POST /api/v1/scan/classify          (HU-05, HU-06, HU-07)
//   F3: scan.routes.ts      → POST /api/v1/scan/upcycle           (HU-09)
//       chat.routes.ts      → POST /api/v1/chat                   (HU-11)
//                             GET /chat/:ideaId/messages          (HU-15)
//   F4: me.routes.ts        → GET /api/v1/me                      (HU-04)
//                             POST /api/v1/me/consent             (HU-21)
//       history.routes.ts   → GET /api/v1/history, /history/:id   (HU-13)
//       favorites.routes.ts → GET/POST /favorites, DELETE /:id    (HU-12; pantalla en HU-15)
export function createV1Routes(
  deps: ScanDeps & ChatControllerDeps & MeDeps & HistoryDeps & FavoritesDeps,
  auth: AuthMiddlewares,
) {
  const v1 = Router();
  v1.use(createScanRoutes(deps, auth));
  v1.use(createChatRoutes(deps, auth));
  v1.use(createMeRoutes(deps, auth));
  v1.use(createHistoryRoutes(deps, auth));
  v1.use(createFavoritesRoutes(deps, auth));
  return v1;
}
