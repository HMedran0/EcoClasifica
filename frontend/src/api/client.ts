import {
  classifyResponseSchema,
  errorBodySchema,
  healthResponseSchema,
  type ClassifyResponse,
  type HealthResponse,
  type scanRequestSchema,
  type UpcycleResponse,
  upcycleResponseSchema,
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
  async function request<T>(
    path: string,
    init: SendInit,
    schema: ZodType<T>,
    { signal }: RequestOptions = {},
  ): Promise<T> {
    const { status, ok, json } = await send(path, init, signal);
    if (!ok) throw toApiError(status, json);
    const parsed = schema.safeParse(json);
    if (!parsed.success) throw new ApiError('UNEXPECTED_RESPONSE', status);
    return parsed.data;
  }

  /** El timeout cubre también la lectura del cuerpo, no solo la llegada de las cabeceras. */
  async function send(path: string, init: SendInit, signal?: AbortSignal): Promise<RawResponse> {
    if (signal?.aborted) throw new ApiError('ABORTED');
    // Fuera del try: un error aquí es de programación, no de red.
    const fetchInit = toFetchInit(init);
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onCancel = () => controller.abort();
    signal?.addEventListener('abort', onCancel, { once: true });
    try {
      const res = await fetchFn(`${baseUrl}${path}`, { ...fetchInit, signal: controller.signal });
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
      request('/api/v1/scan/classify', { method: 'POST', body: req }, classifyResponseSchema, opts),
    upcycle: (req: ScanRequestInput, opts?: RequestOptions): Promise<UpcycleResponse> =>
      request('/api/v1/scan/upcycle', { method: 'POST', body: req }, upcycleResponseSchema, opts),
    /** Indicador de conexión de la pantalla inicial (prueba de humo de CORS en producción). */
    health: (opts?: RequestOptions): Promise<HealthResponse> =>
      request('/api/health', { method: 'GET' }, healthResponseSchema, opts),
  };
}

type SendInit = { method: 'GET' } | { method: 'POST'; body: unknown };

/** Un GET sin cuerpo ni `Content-Type` es una solicitud «simple»: no provoca preflight CORS. */
function toFetchInit(init: SendInit): RequestInit {
  if (init.method === 'GET') return { method: 'GET' };
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(init.body),
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

// Sin «/» final: las rutas ya empiezan por «/» (evita `//api/...`).
export const api = createApiClient({
  baseUrl: (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, ''),
});
