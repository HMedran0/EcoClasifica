import {
  ERROR_STATUS,
  type ClassifyResponse,
  type ErrorCode,
  type UpcycleResponse,
} from '@ecoclasifica/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient, REQUEST_TIMEOUT_MS } from './client';
import { ApiError, errorMessage, isUntilTomorrow } from './errors';

const body = { image: 'A'.repeat(100), mimeType: 'image/jpeg' as const };

const ok: ClassifyResponse = {
  scanId: null,
  mode: 'classify',
  result: {
    object: 'Botella',
    material: 'plastico',
    materialDetail: 'PET',
    confidence: 0.93,
    lowConfidence: false,
    alternatives: [],
  },
  disposal: null,
  saved: false,
};

const jsonResponse = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

/** fetch simulado que solo termina cuando se aborta su señal. */
const hangingFetch = vi.fn<typeof fetch>(
  (_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('', 'AbortError')));
    }),
);

const client = (fetchFn: typeof fetch) => createApiClient({ baseUrl: 'https://api.test', fetchFn });

async function apiErrorOf(promise: Promise<unknown>): Promise<ApiError> {
  const err = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ApiError);
  return err as ApiError;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('api.classify', () => {
  it('envía POST JSON a /api/v1/scan/classify y devuelve la respuesta validada', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, ok));
    await expect(client(fetchFn).classify(body)).resolves.toEqual(ok);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('https://api.test/api/v1/scan/classify');
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify(body) });
  });

  it('rechaza con UNEXPECTED_RESPONSE si la respuesta 200 no cumple el esquema', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(200, { mode: 'classify' }));
    const err = await apiErrorOf(client(fetchFn).classify(body));
    expect(err.code).toBe('UNEXPECTED_RESPONSE');
  });

  // La cuota (HU-20) usa el mensaje del servidor: se prueba aparte.
  it.each((Object.keys(ERROR_STATUS) as ErrorCode[]).filter((code) => !isUntilTomorrow(code)))(
    'traduce %s del backend a un mensaje en español',
    async (code) => {
      const status = ERROR_STATUS[code];
      const fetchFn = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          jsonResponse(status, { error: { code, message: 'x', requestId: 'r1' } }),
        );
      const err = await apiErrorOf(client(fetchFn).classify(body));
      expect(err).toMatchObject({ code, status, requestId: 'r1', message: errorMessage(code) });
    },
  );

  it('trata un código de error desconocido como UNEXPECTED_RESPONSE', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(500, { error: { code: 'BOOM', message: 'x' } }));
    expect((await apiErrorOf(client(fetchFn).classify(body))).code).toBe('UNEXPECTED_RESPONSE');
  });

  it('trata un error sin cuerpo JSON (p. ej. 502 del proxy) como UNEXPECTED_RESPONSE', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('Bad Gateway', { status: 502 }));
    const err = await apiErrorOf(client(fetchFn).classify(body));
    expect(err).toMatchObject({ code: 'UNEXPECTED_RESPONSE', status: 502 });
  });

  it('rechaza con NETWORK_ERROR si no hay conexión', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));
    expect((await apiErrorOf(client(fetchFn).classify(body))).code).toBe('NETWORK_ERROR');
  });

  it('aborta y rechaza con REQUEST_TIMEOUT a los 25 s', async () => {
    vi.useFakeTimers();
    const pending = client(hangingFetch)
      .classify(body)
      .catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    expect(hangingFetch.mock.calls.at(-1)![1]!.signal!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(REQUEST_TIMEOUT_MS).toBe(25_000);
    expect(await pending).toMatchObject({ code: 'REQUEST_TIMEOUT' });
  });

  it('aplica el timeout también si el cuerpo no termina de llegar', async () => {
    vi.useFakeTimers();
    const stalledBody = (signal: AbortSignal) =>
      new ReadableStream({
        start(ctrl) {
          signal.addEventListener('abort', () => ctrl.error(new DOMException('', 'AbortError')));
        },
      });
    const fetchFn = vi.fn<typeof fetch>(
      async (_url, init) => new Response(stalledBody(init!.signal!), { status: 200 }),
    );
    const pending = client(fetchFn)
      .classify(body)
      .catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    expect(await pending).toMatchObject({ code: 'REQUEST_TIMEOUT' });
  });

  it('rechaza con UNEXPECTED_RESPONSE si un 200 no trae JSON', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('<html>', { status: 200 }));
    expect((await apiErrorOf(client(fetchFn).classify(body))).code).toBe('UNEXPECTED_RESPONSE');
  });

  it('no llama a fetch si la señal ya estaba abortada', async () => {
    const fetchFn = vi.fn<typeof fetch>();
    const pending = client(fetchFn).classify(body, { signal: AbortSignal.abort() });
    expect((await apiErrorOf(pending)).code).toBe('ABORTED');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('rechaza con ABORTED si la UI cancela', async () => {
    const controller = new AbortController();
    const pending = client(hangingFetch).classify(body, { signal: controller.signal });
    controller.abort();
    expect((await apiErrorOf(pending)).code).toBe('ABORTED');
  });
});

describe('api.upcycle', () => {
  const ideas: UpcycleResponse = {
    scanId: null,
    mode: 'upcycle',
    result: {
      canUpcycle: true,
      objectName: 'Frasco de vidrio',
      difficulty: 'Fácil',
      ideas: [0, 1, 2].map((ideaIndex) => ({
        ideaIndex,
        title: `Idea ${ideaIndex}`,
        description: 'Descripción',
        extraMaterials: [],
      })),
    },
    saved: false,
  };

  it('envía POST JSON a /api/v1/scan/upcycle y devuelve la respuesta validada', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, ideas));
    await expect(client(fetchFn).upcycle(body)).resolves.toEqual(ideas);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('https://api.test/api/v1/scan/upcycle');
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify(body) });
  });

  it('rechaza con UNEXPECTED_RESPONSE si llega una respuesta de classify', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, ok));
    expect((await apiErrorOf(client(fetchFn).upcycle(body))).code).toBe('UNEXPECTED_RESPONSE');
  });

  it('traduce NOT_A_WASTE al mismo mensaje en español', async () => {
    const error = { error: { code: 'NOT_A_WASTE', message: 'x', requestId: 'r1' } };
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(422, error));
    const err = await apiErrorOf(client(fetchFn).upcycle(body));
    expect(err).toMatchObject({ code: 'NOT_A_WASTE', status: 422, requestId: 'r1' });
    expect(err.message).toBe(errorMessage('NOT_A_WASTE'));
  });

  it('QUOTA_EXCEEDED conserva el mensaje del servidor (dice qué límite se alcanzó)', async () => {
    const message = 'Llegaste al límite de hoy: 60 escaneos.';
    const error = { error: { code: 'QUOTA_EXCEEDED', message, requestId: 'r2' } };
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(429, error));
    const err = await apiErrorOf(client(fetchFn).upcycle(body));
    expect(err).toMatchObject({ code: 'QUOTA_EXCEEDED', status: 429, message });
  });

  it('aborta y rechaza con REQUEST_TIMEOUT con el mismo plazo', async () => {
    vi.useFakeTimers();
    const pending = apiErrorOf(client(hangingFetch).upcycle(body));
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    expect((await pending).code).toBe('REQUEST_TIMEOUT');
  });
});

describe('api.health', () => {
  const healthy = { status: 'ok', service: 'ecoclasifica-api', time: '2026-10-18T12:00:00.000Z' };

  it('envía un GET simple (sin cuerpo ni Content-Type, sin preflight) a /api/health', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, healthy));
    await expect(client(fetchFn).health()).resolves.toEqual(healthy);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('https://api.test/api/health');
    expect(init?.method).toBe('GET');
    expect(init?.body).toBeUndefined();
    expect(init?.headers).toBeUndefined();
  });

  it('rechaza con UNEXPECTED_RESPONSE si responde algo que no es el backend', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, { ok: true }));
    expect((await apiErrorOf(client(fetchFn).health())).code).toBe('UNEXPECTED_RESPONSE');
  });

  it('rechaza con NETWORK_ERROR si CORS o la red bloquean la solicitud', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));
    expect((await apiErrorOf(client(fetchFn).health())).code).toBe('NETWORK_ERROR');
  });
});

describe('api.history (HU-13)', () => {
  const ID = '0e7c3b1a-2f4d-4c6e-9a8b-1d2e3f4a5b6c';
  const page = { items: [], page: 2, pageSize: 20, hasMore: false };

  it('pide la página indicada con GET', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, page));
    await expect(client(fetchFn).history(2)).resolves.toEqual(page);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('https://api.test/api/v1/history?page=2');
    expect(init?.method).toBe('GET');
  });

  it('pide el detalle por id y valida la respuesta', async () => {
    const detail = {
      id: ID,
      createdAt: '2026-10-20T12:00:00+00:00',
      imageUrl: null,
      mode: 'upcycle',
      result: { canUpcycle: false, objectName: 'Pila', reason: 'Peligroso.' },
    };
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, detail));
    await expect(client(fetchFn).historyItem(ID)).resolves.toEqual(detail);
    expect(fetchFn.mock.calls[0]![0]).toBe(`https://api.test/api/v1/history/${ID}`);
  });

  it('traduce el 404 a NOT_FOUND', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'x' } }));
    expect((await apiErrorOf(client(fetchFn).historyItem(ID))).code).toBe('NOT_FOUND');
  });
});

describe('api.favorites (HU-12)', () => {
  const IDEA_ID = '1f8d4c2b-3a5e-4d7f-8b9c-2e3f4a5b6c7d';
  const FAVORITE_ID = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
  const favorite = {
    id: FAVORITE_ID,
    ideaId: IDEA_ID,
    objectName: 'Frasco',
    difficulty: 'Fácil',
    title: 'Portalápices',
    description: 'd',
    extraMaterials: [],
    createdAt: '2026-10-20T12:00:00+00:00',
  };

  it('addFavorite envía solo el ideaId por POST y valida la respuesta', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(201, favorite));
    await expect(client(fetchFn).addFavorite(IDEA_ID)).resolves.toEqual(favorite);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('https://api.test/api/v1/favorites');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ ideaId: IDEA_ID });
  });

  it('removeFavorite usa DELETE y acepta el 204 sin cuerpo', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    await expect(client(fetchFn).removeFavorite(FAVORITE_ID)).resolves.toBeUndefined();
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe(`https://api.test/api/v1/favorites/${FAVORITE_ID}`);
    expect(init?.method).toBe('DELETE');
  });

  it('removeFavorite traduce el 404 a NOT_FOUND', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'x' } }));
    expect((await apiErrorOf(client(fetchFn).removeFavorite(FAVORITE_ID))).code).toBe('NOT_FOUND');
  });
});

describe('Authorization', () => {
  const headersOf = (fetchFn: ReturnType<typeof vi.fn<typeof fetch>>) =>
    new Headers(fetchFn.mock.calls[0]![1]!.headers);
  const withToken = (fetchFn: typeof fetch, getToken: () => Promise<string | null>) =>
    createApiClient({ baseUrl: 'https://api.test', fetchFn, getToken });

  it('con sesión envía Authorization: Bearer <access_token>', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, ok));
    await withToken(fetchFn, async () => 'tok-123').classify(body);
    expect(headersOf(fetchFn).get('Authorization')).toBe('Bearer tok-123');
    expect(headersOf(fetchFn).get('Content-Type')).toBe('application/json');
  });

  it('sin sesión no envía la cabecera', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, ok));
    await withToken(fetchFn, async () => null).classify(body);
    expect(headersOf(fetchFn).has('Authorization')).toBe(false);
  });

  it('si no se puede leer la sesión, la petición sale anónima', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, ok));
    await withToken(fetchFn, () => Promise.reject(new Error('storage'))).classify(body);
    expect(headersOf(fetchFn).has('Authorization')).toBe(false);
  });

  const unauthorized = () => jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'x' } });
  const withRenew = (fetchFn: typeof fetch, renewToken: () => Promise<string | null>) =>
    createApiClient({
      baseUrl: 'https://api.test',
      fetchFn,
      getToken: async () => 'viejo',
      renewToken,
    });
  const authOfCall = (fetchFn: ReturnType<typeof vi.fn<typeof fetch>>, i: number) =>
    new Headers(fetchFn.mock.calls[i]![1]!.headers).get('Authorization');

  it('ante un 401 con token, si la sesión se renueva reintenta con el token nuevo', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(jsonResponse(200, ok));
    const renewToken = vi.fn(async () => 'nuevo');

    await expect(withRenew(fetchFn, renewToken).classify(body)).resolves.toEqual(ok);
    expect(renewToken).toHaveBeenCalledOnce();
    expect(authOfCall(fetchFn, 0)).toBe('Bearer viejo');
    expect(authOfCall(fetchFn, 1)).toBe('Bearer nuevo');
  });

  it('ante un 401 con token, si no se puede renovar reintenta anónimo', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(jsonResponse(200, ok));

    await expect(withRenew(fetchFn, async () => null).classify(body)).resolves.toEqual(ok);
    expect(authOfCall(fetchFn, 1)).toBeNull();
  });

  it('si la renovación lanza un error también reintenta anónimo', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(jsonResponse(200, ok));

    await withRenew(fetchFn, () => Promise.reject(new Error('red'))).classify(body);
    expect(authOfCall(fetchFn, 1)).toBeNull();
  });

  it('nunca reintenta más de una vez', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(async () => unauthorized());
    const err = await apiErrorOf(withRenew(fetchFn, async () => 'nuevo').classify(body));
    expect(err.code).toBe('UNAUTHORIZED');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('un 401 sin token no reintenta', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'x' } }));
    const err = await apiErrorOf(withToken(fetchFn, async () => null).classify(body));
    expect(err.code).toBe('UNAUTHORIZED');
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it('si se cancela mientras se obtiene el token, no envía nada', async () => {
    const fetchFn = vi.fn<typeof fetch>();
    const controller = new AbortController();
    const getToken = async () => {
      controller.abort();
      return 'tok';
    };
    const err = await apiErrorOf(
      withToken(fetchFn, getToken).classify(body, { signal: controller.signal }),
    );
    expect(err.code).toBe('ABORTED');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
