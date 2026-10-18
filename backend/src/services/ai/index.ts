import { env, requireEnv } from '../../config/env';
import type { AiProvider } from './ai.provider';
import { DeepSeekProvider } from './deepseek.provider';

export type { AiProvider } from './ai.provider';

export function createDeepSeekProvider(): DeepSeekProvider {
  return new DeepSeekProvider({
    apiKey: requireEnv('DEEPSEEK_API_KEY'),
    baseUrl: env.DEEPSEEK_BASE_URL,
    model: env.DEEPSEEK_MODEL,
    maxTokens: env.DEEPSEEK_MAX_TOKENS,
    chatMaxTokens: env.DEEPSEEK_CHAT_MAX_TOKENS,
    timeoutMs: env.DEEPSEEK_TIMEOUT_MS,
    imageDetail: env.DEEPSEEK_IMAGE_DETAIL,
  });
}

/**
 * Crea el proveedor real en la primera llamada: así `createApp()` no exige
 * `DEEPSEEK_API_KEY` (health y pruebas funcionan sin ella).
 */
export function lazyAiProvider(factory: () => AiProvider = createDeepSeekProvider): AiProvider {
  let instance: AiProvider | undefined;
  const get = () => (instance ??= factory());
  return {
    classify: (image) => get().classify(image),
    upcycle: (image) => get().upcycle(image),
    chat: (idea, messages) => get().chat(idea, messages),
  };
}
