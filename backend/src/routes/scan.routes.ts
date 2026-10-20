import { scanRequestSchema } from '@ecoclasifica/shared';
import { Router } from 'express';
import { createScanController, type ScanDeps } from '../controllers/scan.controller';
import type { AuthMiddlewares } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../utils/asyncHandler';

export function createScanRoutes(deps: ScanDeps, auth: AuthMiddlewares) {
  const router = Router();
  const controller = createScanController(deps);

  // Sesión opcional: con sesión el escaneo se guarda en el historial (HU-13).
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
