import { z } from 'zod';
import { MAX_CHAT_MESSAGES } from '../constants/materials';

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(1000),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatRequestSchema = z.object({
  scanId: z.string().uuid().optional(),
  ideaIndex: z.number().int().min(0).max(2),
  idea: z.object({
    objectName: z.string().max(80),
    title: z.string().max(80),
    description: z.string().max(240),
    extraMaterials: z.array(z.string().max(60)).max(5),
  }),
  messages: z.array(chatMessageSchema).min(1).max(MAX_CHAT_MESSAGES),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const chatResponseSchema = z.object({
  reply: z.string(),
  usage: z.object({ promptTokens: z.number(), completionTokens: z.number() }),
});
export type ChatResponse = z.infer<typeof chatResponseSchema>;
