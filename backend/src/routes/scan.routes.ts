import { scanRequestSchema } from '@ecoclasifica/shared';
import { Router } from 'express';
import { createScanController } from '../controllers/scan.controller';
import { validate } from '../middlewares/validate';
import type { AiProvider } from '../services/ai/ai.provider';
import { asyncHandler } from '../utils/asyncHandler';

export function createScanRoutes(ai: AiProvider) {
  const router = Router();
  const controller = createScanController(ai);

  router.post('/scan/classify', validate(scanRequestSchema), asyncHandler(controller.classify));
  return router;
}
