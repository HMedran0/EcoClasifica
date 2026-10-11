import type {
  AiClassifyOutput,
  AiUpcycleOutput,
  ChatMessage,
  ChatRequest,
  ImageMime,
} from '@ecoclasifica/shared';

export interface ImageInput {
  /** Base64 sin el prefijo `data:`. */
  base64: string;
  mimeType: ImageMime;
}

export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface AiResult<T> {
  data: T;
  usage: AiUsage;
  latencyMs: number;
}

export type IdeaContext = ChatRequest['idea'];

/**
 * Contrato con el proveedor de IA. Solo `services/ai` conoce la implementación concreta
 * (ADR-3 y ADR-4). Las pruebas inyectan un simulado.
 */
export interface AiProvider {
  classify(image: ImageInput): Promise<AiResult<AiClassifyOutput>>;
  upcycle(image: ImageInput): Promise<AiResult<AiUpcycleOutput>>;
  chat(
    idea: IdeaContext,
    messages: ChatMessage[],
  ): Promise<{ reply: string; usage: AiUsage; latencyMs: number }>;
}
