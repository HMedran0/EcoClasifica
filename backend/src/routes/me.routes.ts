import { Router } from 'express';
import { createMeController } from '../controllers/me.controller';
import type { AuthMiddlewares } from '../middlewares/auth';
import type { MeDeps } from '../services/me.service';
import { asyncHandler } from '../utils/asyncHandler';

export function createMeRoutes(deps: MeDeps, auth: AuthMiddlewares) {
  const router = Router();
  const controller = createMeController(deps);

  router.get('/me', auth.requireAuth, asyncHandler(controller.show));
  return router;
}
