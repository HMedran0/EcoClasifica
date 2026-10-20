import { scanRequestSchema } from '@ecoclasifica/shared';
import { Router } from 'express';
import { createScanController } from '../controllers/scan.controller';
import type { AuthMiddlewares } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import type { ClassifyDeps } from '../services/classification.service';
import { asyncHandler } from '../utils/asyncHandler';

export function createScanRoutes(deps: ClassifyDeps, auth: AuthMiddlewares) {
  const router = Router();
  const controller = createScanController(deps);

  // Sesión opcional; todavía no se guarda nada (`saved: false`): guardar llega en HU-13.
  router.post(
    '/scan/classify',
    auth.optionalAuth,
    validate(scanRequestSchema),
    asyncHandler(controller.classify),
  );
  router.post(
    '/scan/upcycle',
    auth.optionalAuth,
    validate(scanRequestSchema),
    asyncHandler(controller.upcycle),
  );
  return router;
}
