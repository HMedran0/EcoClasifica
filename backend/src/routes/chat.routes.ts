import { chatRequestSchema } from '@ecoclasifica/shared';
import { Router } from 'express';
import { createChatController } from '../controllers/chat.controller';
import { validate } from '../middlewares/validate';
import type { ChatDeps } from '../services/chat.service';
import { asyncHandler } from '../utils/asyncHandler';

export function createChatRoutes(deps: ChatDeps) {
  const router = Router();
  const controller = createChatController(deps);

  router.post('/chat', validate(chatRequestSchema), asyncHandler(controller.send));
  return router;
}
