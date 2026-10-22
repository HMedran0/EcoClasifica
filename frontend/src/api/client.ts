import {
  chatHistoryResponseSchema,
  chatResponseSchema,
  type ChatHistoryResponse,
  classifyResponseSchema,
  type ChatResponse,
  type chatRequestSchema,
  errorBodySchema,
  favoriteSchema,
  favoritesListResponseSchema,
  type Favorite,
  type FavoritesListResponse,
  healthResponseSchema,
  deleteHistoryResponseSchema,
  historyDetailSchema,
  historyListResponseSchema,
  type HistoryDetail,
  type HistoryListResponse,
  type ClassifyResponse,
  type DeleteHistoryResponse,
  type HealthResponse,
  type scanRequestSchema,
  type UpcycleResponse,
  upcycleResponseSchema,
} from '@ecoclasifica/shared';
import { z, type ZodType } from 'zod';
import { getAccessToken, renewOrClearSession } from '../features/auth/authStore';
import { ApiError, isBackendErrorCode } from './errors';

export const REQUEST_TIMEOUT_MS = 25_000;

export type ScanRequestInput = z.input<typeof scanRequestSchema>;
export type ChatRequestInput = z.input<typeof chatRequestSchema>;

export interface ApiClientOptions {
  baseUrl: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  /** Access token de Supabase; con sesión se envía `Authorization: Bearer`. */
  getToken?: () => Promise<string | null>;
  /**
   * El backend rechazó el token: devuelve uno renovado, o `null` si la sesión ya no es válida
   * (y entonces se reintenta sin token).
   */
  renewToken?: () => Promise<string | null>;
}

export interface RequestOptions {
  /** Permite cancelar desde la UI (botón «Cancelar» del escaneo). */
  signal?: AbortSignal;
}

export function createApiClient({
  baseUrl,
  fetchFn = (...args) => fetch(...args),
  timeoutMs = REQUEST_TIMEOUT_MS,
  getToken = async () => null,
  renewToken = async () => null,
}: ApiClientOptions) {
  async function request<T>(
    path: string,
    init: SendInit,
    schema: ZodType<T>,
    { signal }: RequestOptions = {},
  ): Promise<T> {
    const token = await getToken().catch(() => null);
    let res = await send(path, init, token, signal);
    // Un solo reintento: con el token renovado o, si no se pudo renovar, anónimo (escanear no exige sesión).
    if (res.status === 401 && token) {
      const renewed = await renewToken().catch(() => null);
      res = await send(path, init, renewed, signal);
    }
    const { status, ok, json } = res;
    if (!ok) throw toApiError(status, json);
    const parsed = schema.safeParse(json);
    if (!parsed.success) throw new ApiError('UNEXPECTED_RESPONSE', status);
    return parsed.data;
  }

  /** El timeout cubre también la lectura del cuerpo, no solo la llegada de las cabeceras. */
  async function send(
    path: string,
    init: SendInit,
    token: string | null,
    signal?: AbortSignal,
  ): Promise<RawResponse> {
    // Después de obtener el token: si se cancela mientras se renueva, no se envía.
    if (signal?.aborted) throw new ApiError('ABORTED');
    // Fuera del try: un error aquí es de programación, no de red.
    const fetchInit = withAuth(toFetchInit(init), token);
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
    chat: (req: ChatRequestInput, opts?: RequestOptions): Promise<ChatResponse> =>
      request('/api/v1/chat', { method: 'POST', body: req }, chatResponseSchema, opts),
    /** HU-15: el hilo guardado del chat de una idea propia (requiere sesión). */
    chatMessages: (ideaId: string, opts?: RequestOptions): Promise<ChatHistoryResponse> =>
      request(
        `/api/v1/chat/${encodeURIComponent(ideaId)}/messages`,
        { method: 'GET' },
        chatHistoryResponseSchema,
        opts,
      ),
    /** HU-13: una página del historial (requiere sesión). */
    history: (page: number, opts?: RequestOptions): Promise<HistoryListResponse> =>
      request(`/api/v1/history?page=${page}`, { method: 'GET' }, historyListResponseSchema, opts),
    historyItem: (id: string, opts?: RequestOptions): Promise<HistoryDetail> =>
      request(
        `/api/v1/history/${encodeURIComponent(id)}`,
        { method: 'GET' },
        historyDetailSchema,
        opts,
      ),
    /** HU-14: borra un escaneo propio y su imagen (204 sin cuerpo). */
    deleteHistoryItem: async (id: string, opts?: RequestOptions): Promise<void> => {
      await request(
        `/api/v1/history/${encodeURIComponent(id)}`,
        { method: 'DELETE' },
        z.unknown(),
        opts,
      );
    },
    /** HU-14: borra todo el historial del usuario; responde cuántos escaneos se borraron. */
    deleteHistory: (opts?: RequestOptions): Promise<DeleteHistoryResponse> =>
      request('/api/v1/history', { method: 'DELETE' }, deleteHistoryResponseSchema, opts),
    /** HU-15: una página de favoritos (requiere sesión). */
    favorites: (page: number, opts?: RequestOptions): Promise<FavoritesListResponse> =>
      request(
        `/api/v1/favorites?page=${page}`,
        { method: 'GET' },
        favoritesListResponseSchema,
        opts,
      ),
    /** HU-12: guarda la idea (idempotente); la copia la arma el backend. */
    addFavorite: (ideaId: string, opts?: RequestOptions): Promise<Favorite> =>
      request('/api/v1/favorites', { method: 'POST', body: { ideaId } }, favoriteSchema, opts),
    /** HU-12: quita una favorita propia (204 sin cuerpo). */
    removeFavorite: async (favoriteId: string, opts?: RequestOptions): Promise<void> => {
      await request(
        `/api/v1/favorites/${encodeURIComponent(favoriteId)}`,
        { method: 'DELETE' },
        z.unknown(),
        opts,
      );
    },
    /** Indicador de conexión de la pantalla inicial (prueba de humo de CORS en producción). */
    health: (opts?: RequestOptions): Promise<HealthResponse> =>
      request('/api/health', { method: 'GET' }, healthResponseSchema, opts),
  };
}

type SendInit = { method: 'GET' } | { method: 'DELETE' } | { method: 'POST'; body: unknown };

/** Un GET sin cuerpo ni `Content-Type` es una solicitud «simple»: no provoca preflight CORS. */
function toFetchInit(init: SendInit): RequestInit {
  if (init.method !== 'POST') return { method: init.method };
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(init.body),
  };
}

/** Sin token la petición sale anónima: escanear y el chat funcionan sin sesión. */
function withAuth(init: RequestInit, token: string | null): RequestInit {
  if (!token) return init;
  return { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } };
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
  const { code, message, requestId } = parsed.data.error;
  if (!isBackendErrorCode(code)) return new ApiError('UNEXPECTED_RESPONSE', status, requestId);
  return new ApiError(code, status, requestId, message);
}

export type ApiClient = ReturnType<typeof createApiClient>;

// Sin «/» final: las rutas ya empiezan por «/» (evita `//api/...`).
export const api = createApiClient({
  baseUrl: (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, ''),
  getToken: getAccessToken,
  renewToken: renewOrClearSession,
});
