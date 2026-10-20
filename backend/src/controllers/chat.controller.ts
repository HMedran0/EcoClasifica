import type { ChatRequest } from '@ecoclasifica/shared';
import type { Request, Response } from 'express';
import { currentUser } from '../middlewares/auth';
import { chatAboutIdea, listChatMessages, type ChatDeps } from '../services/chat.service';

export const createChatController = (deps: ChatDeps) => ({
  async send(req: Request, res: Response) {
    const body = req.body as ChatRequest;
    const { response, sentMessages, latencyMs, saved } = await chatAboutIdea(
      deps,
      body,
      req.user,
      req.log,
    );
    // Solo métricas: nunca el texto de los mensajes ni la respuesta.
    req.log.info(
      {
        mode: 'chat',
        ideaIndex: body.ideaIndex,
        sentMessages,
        saved,
        ...response.usage,
        latencyMs,
      },
      'Chat completado',
    );
    res.json(response);
  },

  /** HU-15: el hilo guardado para retomar el chat. */
  async messages(req: Request, res: Response) {
    res.json(await listChatMessages(deps, currentUser(req), req.params.ideaId ?? ''));
  },
});
