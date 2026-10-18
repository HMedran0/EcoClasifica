/**
 * FASE F0 — Prueba real de la IA con una foto.
 * Uso: npm run spike:ai -- ./foto.jpg classify|upcycle [low|auto]
 * El tercer argumento sobreescribe DEEPSEEK_IMAGE_DETAIL. Las rutas relativas se resuelven
 * desde donde se lanzó npm (INIT_CWD), normalmente la raíz del repo.
 * Muestra solo el JSON, los tokens y la latencia (no imprime el Base64).
 */
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import type { ImageMime } from '@ecoclasifica/shared';
import { env, requireEnv } from '../src/config/env';
import { DeepSeekProvider, type ImageDetail } from '../src/services/ai/deepseek.provider';

const MIME_BY_EXT: Record<string, ImageMime> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

async function main() {
  const [file, mode = 'classify', detailArg] = process.argv.slice(2);
  if (!file || !['classify', 'upcycle'].includes(mode) || !isDetail(detailArg)) {
    console.error('Uso: npm run spike:ai -- <foto.jpg|png|webp> [classify|upcycle] [low|auto]');
    process.exit(1);
  }
  const mimeType = MIME_BY_EXT[extname(file).toLowerCase()];
  if (!mimeType) {
    console.error('Formato no soportado. Usa JPG, PNG o WebP.');
    process.exit(1);
  }

  const bytes = await readFile(resolve(process.env.INIT_CWD ?? process.cwd(), file));
  console.error(`Imagen: ${(bytes.length / 1024).toFixed(0)} KB (objetivo ≤ 300 KB)`);

  const provider = new DeepSeekProvider({
    apiKey: requireEnv('DEEPSEEK_API_KEY'),
    baseUrl: env.DEEPSEEK_BASE_URL,
    model: env.DEEPSEEK_MODEL,
    maxTokens: env.DEEPSEEK_MAX_TOKENS,
    chatMaxTokens: env.DEEPSEEK_CHAT_MAX_TOKENS,
    timeoutMs: env.DEEPSEEK_TIMEOUT_MS,
    imageDetail: detailArg ?? env.DEEPSEEK_IMAGE_DETAIL,
  });

  const image = { base64: bytes.toString('base64'), mimeType };
  const result =
    mode === 'upcycle' ? await provider.upcycle(image) : await provider.classify(image);

  console.log(JSON.stringify(result.data, null, 2));
  console.error(
    `detail: ${detailArg ?? env.DEEPSEEK_IMAGE_DETAIL ?? '(no enviado)'} · Tokens: ${result.usage.promptTokens} entrada / ${result.usage.completionTokens} salida · ${result.latencyMs} ms`,
  );
}

function isDetail(v: string | undefined): v is ImageDetail | undefined {
  return v === undefined || v === 'low' || v === 'auto';
}

main().catch((err) => {
  console.error(err instanceof Error ? `${err.name}: ${err.message}` : err);
  if (err && typeof err === 'object' && 'details' in err)
    console.error((err as { details: unknown }).details);
  process.exit(1);
});
