import type { ChatMessage } from '@ecoclasifica/shared';
import { vi } from 'vitest';
import type { ChatMessagesRepo } from '../../src/repositories/chatMessages.repo';

export interface StoredChatMessage extends ChatMessage {
  userId: string;
  ideaId: string;
}

/** Repositorio en memoria que respeta el contrato: filtra por usuario e idea y conserva el orden. */
export function memoryChatMessagesRepo(initial: StoredChatMessage[] = []) {
  const rows = [...initial];

  const repo = {
    rows,
    listRecent: vi.fn<ChatMessagesRepo['listRecent']>(async (userId, ideaId, limit) =>
      rows
        .filter((r) => r.userId === userId && r.ideaId === ideaId)
        .slice(-limit)
        .map(({ role, content }) => ({ role, content })),
    ),
    insertExchange: vi.fn<ChatMessagesRepo['insertExchange']>(
      async (userId, ideaId, { question, reply }) => {
        rows.push(
          { userId, ideaId, role: 'user', content: question },
          { userId, ideaId, role: 'assistant', content: reply },
        );
      },
    ),
  };
  return repo satisfies ChatMessagesRepo;
}

/** Hilo guardado alterno pregunta/respuesta de `count` mensajes (empieza en pregunta). */
export function savedThread(userId: string, ideaId: string, count: number): StoredChatMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    userId,
    ideaId,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `G${i}`,
  }));
}
