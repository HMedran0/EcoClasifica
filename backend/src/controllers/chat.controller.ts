import type { ChatRequest } from '@ecoclasifica/shared';
import type { Request, Response } from 'express';
import { currentUser } from '../middlewares/auth';
import { chatAboutIdea, listChatMessages, type ChatDeps } from '../services/chat.service';
import { consentedUser, type MeDeps } from '../services/me.service';
import type { UsageMeter } from '../services/quota.service';

export type ChatControllerDeps = ChatDeps & MeDeps & { meter: UsageMeter };

export const createChatController = (deps: ChatControllerDeps) => ({
  async send(req: Request, res: Response) {
    const body = req.body as ChatRequest;
    // HU-20: `scan_id` queda en null; el `scanId` del cliente no se verifica y no se registra.
    const usage = deps.meter.track(req, deps.ai);
    let outcome: Awaited<ReturnType<typeof chatAboutIdea>>;
    try {
      // HU-21: sin autorización vigente funciona como anónimo (ni carga ni guarda el hilo).
      const owner = await consentedUser(deps, req.user);
      outcome = await chatAboutIdea({ ...deps, ai: usage.ai }, body, owner, req.log);
    } finally {
      await usage.flush(null);
    }
    const { response, sentMessages, latencyMs, saved } = outcome;
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
