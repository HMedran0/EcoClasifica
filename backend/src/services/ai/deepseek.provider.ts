import {
  aiClassifySchema,
  aiUpcycleSchema,
  type AiClassifyOutput,
  type AiUpcycleOutput,
  type ChatMessage,
} from '@ecoclasifica/shared';
import type { ZodType, ZodTypeDef } from 'zod';
import { AppError } from '../../utils/appError';
import {
  AiCallError,
  type AiProvider,
  type AiResult,
  type AiUsage,
  type IdeaContext,
  type ImageInput,
} from './ai.provider';
import {
  CLASSIFY_SYSTEM,
  CLASSIFY_USER,
  UPCYCLE_SYSTEM,
  UPCYCLE_USER,
  chatSystem,
} from './prompts';

export type ImageDetail = 'low' | 'auto';

export interface DeepSeekConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
  chatMaxTokens: number;
  timeoutMs: number;
  imageDetail?: ImageDetail;
}

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: ImageDetail } };
type ApiMessage = { role: 'system' | 'user' | 'assistant'; content: string | ContentPart[] };

interface CompletionResponse {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * Adaptador de DeepSeek (formato compatible con OpenAI /chat/completions).
 * Verificado en F0 (api-docs.deepseek.com/guides/vision, 2026-10-11): `deepseek-flash`
 * acepta imágenes (JPEG/PNG/GIF/WebP) como `image_url` con data URI Base64, solo en
 * mensajes `user` (en `system`/`assistant` devuelve 400). Cada imagen cuesta ≤ 1024 tokens.
 * El modo de razonamiento viene activo por defecto y sus tokens consumen `max_tokens`
 * (truncaba el JSON con 384): se desactiva con `thinking: { type: 'disabled' }`.
 */
export class DeepSeekProvider implements AiProvider {
  constructor(private readonly cfg: DeepSeekConfig) {}

  classify(image: ImageInput): Promise<AiResult<AiClassifyOutput>> {
    return this.json(this.visionMessages(CLASSIFY_SYSTEM, CLASSIFY_USER, image), aiClassifySchema);
  }

  upcycle(image: ImageInput): Promise<AiResult<AiUpcycleOutput>> {
    return this.json(this.visionMessages(UPCYCLE_SYSTEM, UPCYCLE_USER, image), aiUpcycleSchema);
  }

  async chat(idea: IdeaContext, messages: ChatMessage[]) {
    const apiMessages: ApiMessage[] = [
      { role: 'system', content: chatSystem(idea) },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];
    const { content, usage, latencyMs } = await this.complete(apiMessages, {
      json: false,
      maxTokens: this.cfg.chatMaxTokens,
    });
    return { reply: content.trim(), usage, latencyMs };
  }

  private visionMessages(system: string, user: string, image: ImageInput): ApiMessage[] {
    return [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          { type: 'text', text: user },
          {
            type: 'image_url',
            image_url: {
              url: `data:${image.mimeType};base64,${image.base64}`,
              ...(this.cfg.imageDetail ? { detail: this.cfg.imageDetail } : {}),
            },
          },
        ],
      },
    ];
  }

  /** Llama a la IA, valida el JSON con Zod y reintenta una vez si es inválido o truncado. */
  private async json<T>(
    messages: ApiMessage[],
    schema: ZodType<T, ZodTypeDef, unknown>,
  ): Promise<AiResult<T>> {
    let lastReason = 'respuesta vacía';
    const total: AiUsage = { promptTokens: 0, completionTokens: 0 };
    let totalLatency = 0;

    for (let attempt = 0; attempt < 2; attempt++) {
      const { content, usage, latencyMs, truncated } = await this.complete(messages, {
        json: true,
        maxTokens: this.cfg.maxTokens,
      }).catch((err: unknown) => {
        // Un timeout en el reintento no borra los tokens del primer intento.
        throw err instanceof AppError
          ? new AiCallError(err.code, err.message, { ...total }, err.details)
          : err;
      });
      total.promptTokens += usage.promptTokens;
      total.completionTokens += usage.completionTokens;
      totalLatency += latencyMs;

      if (truncated) {
        lastReason = 'JSON truncado por el límite de tokens';
        continue;
      }
      try {
        const parsed = schema.safeParse(JSON.parse(stripFences(content)));
        if (parsed.success) return { data: parsed.data, usage: total, latencyMs: totalLatency };
        lastReason = 'el JSON no cumple el esquema';
      } catch {
        lastReason = 'JSON inválido';
      }
    }
    throw new AiCallError(
      'AI_BAD_RESPONSE',
      'No pudimos analizar la imagen, intenta de nuevo',
      total,
      { reason: lastReason },
    );
  }

  private async complete(messages: ApiMessage[], opts: { json: boolean; maxTokens: number }) {
    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(`${this.cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: this.cfg.model,
          max_tokens: opts.maxTokens,
          temperature: 0.1,
          thinking: { type: 'disabled' },
          ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
          messages,
        }),
        signal: AbortSignal.timeout(this.cfg.timeoutMs),
      });
    } catch (err) {
      if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
        throw new AppError('AI_TIMEOUT', 'El análisis tardó demasiado, intenta de nuevo');
      }
      throw new AppError('AI_BAD_RESPONSE', 'No se pudo contactar al servicio de IA');
    }

    if (!res.ok) {
      throw new AppError('AI_BAD_RESPONSE', 'El servicio de IA devolvió un error', {
        status: res.status,
      });
    }

    const body = (await res.json()) as CompletionResponse;
    const choice = body.choices?.[0];
    return {
      content: choice?.message?.content ?? '',
      truncated: choice?.finish_reason === 'length',
      usage: {
        promptTokens: body.usage?.prompt_tokens ?? 0,
        completionTokens: body.usage?.completion_tokens ?? 0,
      },
      latencyMs: Date.now() - started,
    };
  }
}

/** Quita los bloques ```json ... ``` que algunos modelos añaden pese a response_format. */
function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
}
