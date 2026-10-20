import { historyQuerySchema } from '@ecoclasifica/shared';
import { Router } from 'express';
import { createHistoryController } from '../controllers/history.controller';
import type { AuthMiddlewares } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import type { HistoryDeps } from '../services/history.service';
import { asyncHandler } from '../utils/asyncHandler';

export function createHistoryRoutes(deps: HistoryDeps, auth: AuthMiddlewares) {
  const router = Router();
  const controller = createHistoryController(deps);

  router.get(
    '/history',
    auth.requireAuth,
    validate(historyQuerySchema, 'query'),
    asyncHandler(controller.list),
  );
  router.delete('/history', auth.requireAuth, asyncHandler(controller.removeAll));
  router.get('/history/:id', auth.requireAuth, asyncHandler(controller.show));
  // El id se valida en el servicio: mal formado responde 404, igual que el ajeno.
  router.delete('/history/:id', auth.requireAuth, asyncHandler(controller.remove));
  return router;
}
