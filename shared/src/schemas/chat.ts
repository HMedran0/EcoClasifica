import { z } from 'zod';
import {
  CHAT_MESSAGE_MAX,
  IDEA_EXTRA_MATERIAL_MAX,
  IDEA_OBJECT_NAME_MAX,
  MAX_CHAT_MESSAGES_ACCEPTED,
  UPCYCLE_DESCRIPTION_MAX,
  UPCYCLE_EXTRA_MATERIALS_MAX,
  UPCYCLE_TITLE_MAX,
} from '../constants/materials';

/** Nunca `system`: el cliente no puede inyectar instrucciones de sistema. */
export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(CHAT_MESSAGE_MAX),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

/** La idea la envía el cliente: no es confiable y usa los mismos límites que upcycle. */
export const chatIdeaSchema = z.object({
  objectName: z.string().trim().min(1).max(IDEA_OBJECT_NAME_MAX),
  title: z.string().trim().min(1).max(UPCYCLE_TITLE_MAX),
  description: z.string().trim().max(UPCYCLE_DESCRIPTION_MAX),
  extraMaterials: z
    .array(z.string().trim().min(1).max(IDEA_EXTRA_MATERIAL_MAX))
    .max(UPCYCLE_EXTRA_MATERIALS_MAX),
});
export type ChatIdea = z.infer<typeof chatIdeaSchema>;

export const chatRequestSchema = z.object({
  scanId: z.string().uuid().optional(),
  // Opcional: un favorito no conoce el índice de su idea. Solo se usa en métricas.
  ideaIndex: z.number().int().min(0).max(2).optional(),
  /**
   * HU-15: con sesión, la idea guardada y su hilo salen de la base (se ignoran `idea` y los
   * mensajes anteriores del cliente; solo cuenta el último). Sin sesión se ignora.
   */
  ideaId: z.string().uuid().optional(),
  idea: chatIdeaSchema,
  // Se aceptan más de 10; el backend envía a la IA solo los últimos `MAX_CHAT_MESSAGES`.
  messages: z
    .array(chatMessageSchema)
    .min(1)
    .max(MAX_CHAT_MESSAGES_ACCEPTED)
    .refine((list) => list[list.length - 1]?.role === 'user', {
      message: 'El último mensaje debe ser del usuario',
    }),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const chatResponseSchema = z.object({
  reply: z.string(),
  usage: z.object({ promptTokens: z.number(), completionTokens: z.number() }),
});
export type ChatResponse = z.infer<typeof chatResponseSchema>;

/** GET /api/v1/chat/:ideaId/messages (HU-15). El hilo guardado: últimos 50, del más antiguo al más nuevo. */
export const CHAT_HISTORY_LIMIT = 50;

/** Sin tope de longitud: las respuestas guardadas de la IA pueden superar `CHAT_MESSAGE_MAX`. */
export const storedChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

export const chatHistoryResponseSchema = z.object({
  items: z.array(storedChatMessageSchema).max(CHAT_HISTORY_LIMIT),
});
export type ChatHistoryResponse = z.infer<typeof chatHistoryResponseSchema>;
