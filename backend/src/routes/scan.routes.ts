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
    // HU-20: antes de llamar a la IA; classify y upcycle comparten la cuota de escaneos.
    deps.meter.checkQuota('scan'),
    asyncHandler(controller.classify),
  );
  router.post(
    '/scan/upcycle',
    auth.optionalAuth,
    validate(scanRequestSchema),
    deps.meter.checkQuota('scan'),
    asyncHandler(controller.upcycle),
  );
  return router;
}
