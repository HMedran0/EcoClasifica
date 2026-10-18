import { scanRequestSchema } from '@ecoclasifica/shared';
import { Router } from 'express';
import { createScanController } from '../controllers/scan.controller';
import { validate } from '../middlewares/validate';
import type { ClassifyDeps } from '../services/classification.service';
import { asyncHandler } from '../utils/asyncHandler';

export function createScanRoutes(deps: ClassifyDeps) {
  const router = Router();
  const controller = createScanController(deps);

  router.post('/scan/classify', validate(scanRequestSchema), asyncHandler(controller.classify));
  return router;
}
