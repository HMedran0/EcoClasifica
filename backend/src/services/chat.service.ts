import {
  CHAT_HISTORY_LIMIT,
  MAX_CHAT_MESSAGES,
  type ChatHistoryResponse,
  type ChatIdea,
  type ChatMessage,
  type ChatRequest,
  type ChatResponse,
} from '@ecoclasifica/shared';
import type { Logger } from 'pino';
import { z } from 'zod';
import { ChatSaveError, type ChatMessagesRepo } from '../repositories/chatMessages.repo';
import type { FavoritesRepo } from '../repositories/favorites.repo';
import { AppError } from '../utils/appError';
import { toPlainText } from '../utils/text';
import type { AiProvider, AiUsage } from './ai/ai.provider';
import type { AuthUser } from './auth.service';
import { hasBlockedTerm } from './upcycle.safety';

export interface ChatDeps {
  ai: AiProvider;
  /** Solo `findIdeaSnapshot`: la idea con el filtro por dueño del escaneo. */
  favorites: Pick<FavoritesRepo, 'findIdeaSnapshot'>;
  chatMessages: ChatMessagesRepo;
}

export interface ChatOutcome {
  response: ChatResponse;
  sentMessages: number;
  latencyMs: number;
  /** `true` si el intercambio quedó en `chat_messages`. */
  saved: boolean;
}

/** Idea ajena o inexistente → 404 (no 403): no se revela si existe. */
const ideaNotFound = () => new AppError('NOT_FOUND', 'No encontramos esa idea en tu historial');

/** Los mismos respaldos de upcycle sobre la idea (la envía el cliente, no es confiable). */
function assertSafeIdea({ objectName, title }: ChatIdea, log: Logger) {
  const field = hasBlockedTerm(objectName) ? 'objectName' : hasBlockedTerm(title) ? 'title' : null;
  if (!field) return;
  // Sin el texto: lo escribe el cliente.
  log.warn({ field, rule: 'blocked_term' }, 'Chat bloqueado por seguridad');
  throw new AppError(
    'UNSAFE_REQUEST',
    'Esa idea no es segura y no podemos guiarte con ella. Elige otra idea.',
  );
}

/** Lo que la IA lee: la idea y el hilo, y dónde guardar el intercambio (si se guarda). */
interface ChatContext {
  idea: ChatIdea;
  messages: ChatMessage[];
  persist: { userId: string; ideaId: string } | null;
}

/**
 * HU-15: con sesión e `ideaId`, la idea y los mensajes anteriores salen de la base; del cliente
 * solo cuenta la pregunta nueva (no puede inventar respuestas del asistente). Sin sesión o sin
 * `ideaId`, como en HU-11: idea y hilo del cliente, recortado a los últimos 10.
 */
async function buildContext(
  { favorites, chatMessages }: ChatDeps,
  req: ChatRequest,
  user: AuthUser | undefined,
): Promise<ChatContext> {
  if (!user || !req.ideaId) {
    // Control de costos: solo las últimas interacciones viajan a la IA.
    return { idea: req.idea, messages: req.messages.slice(-MAX_CHAT_MESSAGES), persist: null };
  }
  const snapshot = await favorites.findIdeaSnapshot(user.id, req.ideaId);
  if (!snapshot) throw ideaNotFound();
  const { objectName, title, description, extraMaterials } = snapshot;
  // El esquema garantiza que el último mensaje es del usuario.
  const question = req.messages[req.messages.length - 1] as ChatMessage;
  const previous = await chatMessages.listRecent(user.id, req.ideaId, MAX_CHAT_MESSAGES - 1);
  return {
    idea: { objectName, title, description, extraMaterials },
    messages: [...previous, question],
    persist: { userId: user.id, ideaId: req.ideaId },
  };
}

export async function chatAboutIdea(
  deps: ChatDeps,
  req: ChatRequest,
  user: AuthUser | undefined,
  log: Logger,
): Promise<ChatOutcome> {
  const { idea, messages, persist } = await buildContext(deps, req, user);
  assertSafeIdea(idea, log);
  const { reply, usage, latencyMs } = await deps.ai.chat(idea, messages);

  const text = toPlainText(reply);
  if (!text) throw new AppError('AI_BAD_RESPONSE', 'No pudimos responder, intenta de nuevo');
  const question = messages[messages.length - 1]?.content ?? '';
  const saved = persist ? await saveExchange(deps, persist, { question, reply: text }, log) : false;
  return {
    response: { reply: text, usage: pickUsage(usage) },
    sentMessages: messages.length,
    latencyMs,
    saved,
  };
}

/** Si guardar falla, la respuesta igual llega: se avisa en el log sin el texto. */
async function saveExchange(
  { chatMessages }: ChatDeps,
  { userId, ideaId }: { userId: string; ideaId: string },
  exchange: { question: string; reply: string },
  log: Logger,
): Promise<boolean> {
  try {
    await chatMessages.insertExchange(userId, ideaId, exchange);
    return true;
  } catch (err) {
    // Solo el código de Postgres: el mensaje podría citar la fila (el texto del usuario).
    const code = err instanceof ChatSaveError ? err.code : undefined;
    log.warn({ mode: 'chat', code }, 'No se pudo guardar el chat');
    return false;
  }
}

/** El hilo guardado de una idea propia; un id ajeno o mal formado responde 404. */
export async function listChatMessages(
  { favorites, chatMessages }: ChatDeps,
  user: AuthUser,
  ideaId: string,
): Promise<ChatHistoryResponse> {
  const id = z.string().uuid().safeParse(ideaId);
  if (!id.success || !(await favorites.findIdeaSnapshot(user.id, id.data))) throw ideaNotFound();
  return { items: await chatMessages.listRecent(user.id, id.data, CHAT_HISTORY_LIMIT) };
}

const pickUsage = ({ promptTokens, completionTokens }: AiUsage) => ({
  promptTokens,
  completionTokens,
});
