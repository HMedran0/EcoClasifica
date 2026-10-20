import type { ChatRequest } from '@ecoclasifica/shared';
import type { Request, Response } from 'express';
import { chatAboutIdea, type ChatDeps } from '../services/chat.service';

export const createChatController = (deps: ChatDeps) => ({
  async send(req: Request, res: Response) {
    const body = req.body as ChatRequest;
    const { response, sentMessages, latencyMs } = await chatAboutIdea(deps, body, req.log);
    // Solo métricas: nunca el texto de los mensajes ni la respuesta.
    req.log.info(
      { mode: 'chat', ideaIndex: body.ideaIndex, sentMessages, ...response.usage, latencyMs },
      'Chat completado',
    );
    res.json(response);
  },
});
