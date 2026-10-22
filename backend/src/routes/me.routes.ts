import { Router } from 'express';
import { createMeController } from '../controllers/me.controller';
import type { AuthMiddlewares } from '../middlewares/auth';
import type { AccountDeletionDeps, MeDeps } from '../services/me.service';
import { asyncHandler } from '../utils/asyncHandler';

export function createMeRoutes(deps: MeDeps & AccountDeletionDeps, auth: AuthMiddlewares) {
  const router = Router();
  const controller = createMeController(deps);

  router.get('/me', auth.requireAuth, asyncHandler(controller.show));
  // HU-21: sin cuerpo; la versión la fija el servidor.
  router.post('/me/consent', auth.requireAuth, asyncHandler(controller.consent));
  // HU-22: borra las fotos y después el usuario de Auth (la base borra el resto en cascada).
  router.delete('/me', auth.requireAuth, asyncHandler(controller.remove));
  return router;
}
