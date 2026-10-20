import { chatRequestSchema } from '@ecoclasifica/shared';
import { Router } from 'express';
import { createChatController } from '../controllers/chat.controller';
import type { AuthMiddlewares } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import type { ChatDeps } from '../services/chat.service';
import { asyncHandler } from '../utils/asyncHandler';

export function createChatRoutes(deps: ChatDeps, auth: AuthMiddlewares) {
  const router = Router();
  const controller = createChatController(deps);

  router.post(
    '/chat',
    auth.optionalAuth,
    validate(chatRequestSchema),
    asyncHandler(controller.send),
  );
  router.get('/chat/:ideaId/messages', auth.requireAuth, asyncHandler(controller.messages));
  return router;
}
