import type { ChatMessage } from '@ecoclasifica/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getSupabase } from './supabase';

/** Fallo al guardar: solo el código de Postgres, que es seguro registrar. */
export class ChatSaveError extends Error {
  constructor(readonly code: string) {
    super(`No se pudo guardar el chat (${code})`);
  }
}

// Forma de la fila en Postgres; no es parte del contrato de la API.
const messageRowSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

/**
 * Hilo guardado del chat de una idea (HU-15). El service role salta RLS: toda consulta filtra por
 * `userId`, y el servicio comprueba antes que la idea sea del usuario.
 */
export interface ChatMessagesRepo {
  /** Los `limit` más recientes, devueltos del más antiguo al más nuevo. */
  listRecent(userId: string, ideaId: string, limit: number): Promise<ChatMessage[]>;
  /** Guarda la pregunta y la respuesta en orden. */
  insertExchange(
    userId: string,
    ideaId: string,
    exchange: { question: string; reply: string },
  ): Promise<void>;
}

export function createSupabaseChatMessagesRepo(
  client: () => SupabaseClient = getSupabase,
): ChatMessagesRepo {
  const messages = () => client().from('chat_messages');

  return {
    async listRecent(userId, ideaId, limit) {
      const { data, error } = await messages()
        .select('role, content')
        .eq('user_id', userId)
        .eq('idea_id', ideaId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit);
      // Sin `error.message` ni el `ZodError` (sería un 400): una fila inválida es un error interno.
      if (error) throw new Error(`No se pudo leer el chat (${error.code})`);
      const rows = z.array(messageRowSchema).safeParse(data ?? []);
      if (!rows.success) throw new Error('Fila de chat_messages con forma inválida');
      return rows.data.reverse();
    },

    async insertExchange(userId, ideaId, { question, reply }) {
      // Un solo insert comparte `now()`: la hora explícita (+1 ms) fija el orden pregunta → respuesta.
      const at = Date.now();
      const row = (role: ChatMessage['role'], content: string, ms: number) => ({
        user_id: userId,
        idea_id: ideaId,
        role,
        content,
        created_at: new Date(ms).toISOString(),
      });
      const { error } = await messages().insert([
        row('user', question, at),
        row('assistant', reply, at + 1),
      ]);
      // Sin `error.message`: Postgres puede citar la fila (el texto del usuario).
      if (error) throw new ChatSaveError(error.code);
    },
  };
}
