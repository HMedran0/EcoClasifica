import {
  ERROR_STATUS,
  type ClassifyResponse,
  type ErrorCode,
  type UpcycleResponse,
} from '@ecoclasifica/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient, REQUEST_TIMEOUT_MS } from './client';
import { ApiError, errorMessage } from './errors';

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

  it.each(Object.keys(ERROR_STATUS) as ErrorCode[])(
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
