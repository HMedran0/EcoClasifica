import { chatRequestSchema } from '@ecoclasifica/shared';
import { Router } from 'express';
import { createChatController, type ChatControllerDeps } from '../controllers/chat.controller';
import type { AuthMiddlewares } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../utils/asyncHandler';

export function createChatRoutes(deps: ChatControllerDeps, auth: AuthMiddlewares) {
  const router = Router();
  const controller = createChatController(deps);

  router.post(
    '/chat',
    auth.optionalAuth,
    validate(chatRequestSchema),
    // HU-20: antes de llamar a la IA.
    deps.meter.checkQuota('chat'),
    asyncHandler(controller.send),
  );
  router.get('/chat/:ideaId/messages', auth.requireAuth, asyncHandler(controller.messages));
  return router;
}
