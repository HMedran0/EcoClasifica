import {
  classifyResponseSchema,
  errorBodySchema,
  type ClassifyResponse,
  type scanRequestSchema,
} from '@ecoclasifica/shared';
import type { z, ZodType } from 'zod';
import { ApiError, isBackendErrorCode } from './errors';

export const REQUEST_TIMEOUT_MS = 25_000;

export type ScanRequestInput = z.input<typeof scanRequestSchema>;

export interface ApiClientOptions {
  baseUrl: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export interface RequestOptions {
  /** Permite cancelar desde la UI (botón «Cancelar» del escaneo). */
  signal?: AbortSignal;
}

export function createApiClient({
  baseUrl,
  fetchFn = (...args) => fetch(...args),
  timeoutMs = REQUEST_TIMEOUT_MS,
}: ApiClientOptions) {
  async function post<T>(
    path: string,
    body: unknown,
    schema: ZodType<T>,
    { signal }: RequestOptions = {},
  ): Promise<T> {
    const { status, ok, json } = await send(path, body, signal);
    if (!ok) throw toApiError(status, json);
    const parsed = schema.safeParse(json);
    if (!parsed.success) throw new ApiError('UNEXPECTED_RESPONSE', status);
    return parsed.data;
  }

  /** El timeout cubre también la lectura del cuerpo, no solo la llegada de las cabeceras. */
  async function send(path: string, body: unknown, signal?: AbortSignal): Promise<RawResponse> {
    if (signal?.aborted) throw new ApiError('ABORTED');
    // Fuera del try: un error aquí es de programación, no de red.
    const payload = JSON.stringify(body);
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onCancel = () => controller.abort();
    signal?.addEventListener('abort', onCancel, { once: true });
    try {
      const res = await fetchFn(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        signal: controller.signal,
      });
      return { status: res.status, ok: res.ok, json: await readJson(res, controller.signal) };
    } catch {
      if (timedOut) throw new ApiError('REQUEST_TIMEOUT');
      if (controller.signal.aborted) throw new ApiError('ABORTED');
      throw new ApiError('NETWORK_ERROR');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onCancel);
    }
  }

  return {
    classify: (req: ScanRequestInput, opts?: RequestOptions): Promise<ClassifyResponse> =>
      post('/api/v1/scan/classify', req, classifyResponseSchema, opts),
  };
}

interface RawResponse {
  status: number;
  ok: boolean;
  json: unknown;
}

/** Un cuerpo que no es JSON se trata como `undefined` (luego falla la validación), salvo si se abortó. */
async function readJson(res: Response, signal: AbortSignal): Promise<unknown> {
  try {
    return await res.json();
  } catch (err) {
    if (signal.aborted) throw err;
    return undefined;
  }
}

/** Traduce el cuerpo `{ error: { code, … } }` del backend; un código desconocido es error inesperado. */
function toApiError(status: number, json: unknown): ApiError {
  const parsed = errorBodySchema.safeParse(json);
  if (!parsed.success) return new ApiError('UNEXPECTED_RESPONSE', status);
  const { code, requestId } = parsed.data.error;
  return new ApiError(isBackendErrorCode(code) ? code : 'UNEXPECTED_RESPONSE', status, requestId);
}

export type ApiClient = ReturnType<typeof createApiClient>;

export const api = createApiClient({ baseUrl: import.meta.env.VITE_API_URL ?? '' });
