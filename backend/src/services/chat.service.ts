import { MAX_CHAT_MESSAGES, type ChatRequest, type ChatResponse } from '@ecoclasifica/shared';
import type { Logger } from 'pino';
import { AppError } from '../utils/appError';
import { toPlainText } from '../utils/text';
import type { AiProvider, AiUsage } from './ai/ai.provider';
import { hasBlockedTerm } from './upcycle.safety';

export interface ChatDeps {
  ai: AiProvider;
}

export interface ChatOutcome {
  response: ChatResponse;
  sentMessages: number;
  latencyMs: number;
}

/** Los mismos respaldos de upcycle sobre la idea (la envía el cliente, no es confiable). */
function assertSafeIdea({ objectName, title }: ChatRequest['idea'], log: Logger) {
  const field = hasBlockedTerm(objectName) ? 'objectName' : hasBlockedTerm(title) ? 'title' : null;
  if (!field) return;
  // Sin el texto: lo escribe el cliente.
  log.warn({ field, rule: 'blocked_term' }, 'Chat bloqueado por seguridad');
  throw new AppError(
    'UNSAFE_REQUEST',
    'Esa idea no es segura y no podemos guiarte con ella. Elige otra idea.',
  );
}

export async function chatAboutIdea(
  { ai }: ChatDeps,
  req: ChatRequest,
  log: Logger,
): Promise<ChatOutcome> {
  assertSafeIdea(req.idea, log);
  // Control de costos: solo las últimas interacciones viajan a la IA.
  const messages = req.messages.slice(-MAX_CHAT_MESSAGES);
  const { reply, usage, latencyMs } = await ai.chat(req.idea, messages);

  const text = toPlainText(reply);
  if (!text) throw new AppError('AI_BAD_RESPONSE', 'No pudimos responder, intenta de nuevo');
  return {
    response: { reply: text, usage: pickUsage(usage) },
    sentMessages: messages.length,
    latencyMs,
  };
}

const pickUsage = ({ promptTokens, completionTokens }: AiUsage) => ({
  promptTokens,
  completionTokens,
});
