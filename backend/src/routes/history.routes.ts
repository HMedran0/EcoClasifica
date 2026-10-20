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
  router.get('/history/:id', auth.requireAuth, asyncHandler(controller.show));
  return router;
}
