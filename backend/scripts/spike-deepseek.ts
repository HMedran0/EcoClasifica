/**
 * FASE F0 — Prueba real de la IA con una foto.
 * Uso: npm run spike:ai -- ./foto.jpg classify|upcycle
 * Muestra solo el JSON, los tokens y la latencia (no imprime el Base64).
 */
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import type { ImageMime } from '@ecoclasifica/shared';
import { env, requireEnv } from '../src/config/env';
import { DeepSeekProvider } from '../src/services/ai/deepseek.provider';

const MIME_BY_EXT: Record<string, ImageMime> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

async function main() {
  const [file, mode = 'classify'] = process.argv.slice(2);
  if (!file || !['classify', 'upcycle'].includes(mode)) {
    console.error('Uso: npm run spike:ai -- <foto.jpg|png|webp> [classify|upcycle]');
    process.exit(1);
  }
  const mimeType = MIME_BY_EXT[extname(file).toLowerCase()];
  if (!mimeType) {
    console.error('Formato no soportado. Usa JPG, PNG o WebP.');
    process.exit(1);
  }

  const bytes = await readFile(file);
  console.error(`Imagen: ${(bytes.length / 1024).toFixed(0)} KB (objetivo ≤ 300 KB)`);

  const provider = new DeepSeekProvider({
    apiKey: requireEnv('DEEPSEEK_API_KEY'),
    baseUrl: env.DEEPSEEK_BASE_URL,
    model: env.DEEPSEEK_MODEL,
    maxTokens: env.DEEPSEEK_MAX_TOKENS,
    chatMaxTokens: env.DEEPSEEK_CHAT_MAX_TOKENS,
    timeoutMs: env.DEEPSEEK_TIMEOUT_MS,
  });

  const image = { base64: bytes.toString('base64'), mimeType };
  const result =
    mode === 'upcycle' ? await provider.upcycle(image) : await provider.classify(image);

  console.log(JSON.stringify(result.data, null, 2));
  console.error(
    `Tokens: ${result.usage.promptTokens} entrada / ${result.usage.completionTokens} salida · ${result.latencyMs} ms`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? `${err.name}: ${err.message}` : err);
  if (err && typeof err === 'object' && 'details' in err)
    console.error((err as { details: unknown }).details);
  process.exit(1);
});
