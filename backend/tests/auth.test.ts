import { Writable } from 'node:stream';
import { errorBodySchema, meResponseSchema } from '@ecoclasifica/shared';
import { AuthApiError, AuthInvalidJwtError, AuthRetryableFetchError } from '@supabase/supabase-js';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, type AppDeps } from '../src/app';
import type { ProfilesRepo } from '../src/repositories/profiles.repo';
import type { AiProvider } from '../src/services/ai/ai.provider';
import { createLogger } from '../src/utils/logger';
import { fakeDisposalRepo } from './helpers/disposalRules';

// Supabase simulado: el verificador real (`createSupabaseTokenVerifier`) llama a este `getClaims`.
const { getClaims } = vi.hoisted(() => ({ getClaims: vi.fn() }));
vi.mock('../src/repositories/supabase', () => ({
  getSupabase: () => ({ auth: { getClaims } }),
}));

const USER_ID = '5b6f1c2e-8a3d-4f7b-9c1e-2d4a6b8c0e1f';
const VALID = 'token-valido';

const claimsOk = { data: { claims: { sub: USER_ID, email: 'ana@ejemplo.com' } }, error: null };
const rejected = (message: string) => ({ data: null, error: new AuthInvalidJwtError(message) });

function fakeProfiles(displayName: string | null = 'Ana') {
  const findById = vi
    .fn<ProfilesRepo['findById']>()
    .mockResolvedValue(displayName === null ? null : { displayName });
  return { findById } satisfies ProfilesRepo;
}

const chat = vi.fn<AiProvider['chat']>();

const appWith = (overrides: Partial<AppDeps> = {}) =>
  createApp({
    disposalRepo: fakeDisposalRepo(),
    aiProvider: { classify: vi.fn(), upcycle: vi.fn(), chat },
    profilesRepo: fakeProfiles(),
    ...overrides,
  });

const chatBody = {
  ideaIndex: 0,
  idea: {
    objectName: 'Frasco de vidrio',
    title: 'Portalápices decorado',
    description: 'Forra el frasco con cuerda.',
    extraMaterials: [],
  },
  messages: [{ role: 'user', content: '¿Cómo empiezo?' }],
};

const postChat = (headers: Record<string, string> = {}) =>
  request(appWith()).post('/api/v1/chat').set(headers).send(chatBody);

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeEach(() => {
  getClaims.mockReset();
  getClaims.mockImplementation(async (token: string) =>
    token === VALID ? claimsOk : rejected('invalid JWT'),
  );
  chat.mockReset();
  chat.mockResolvedValue({
    reply: '1. Lava el frasco.',
    usage: { promptTokens: 10, completionTokens: 5 },
    latencyMs: 100,
  });
});

const SESSION_INVALID = 'Tu sesión no es válida o venció';
const LOGIN_REQUIRED = 'Inicia sesión para continuar';

/** Por defecto, el mensaje de un token inválido o vencido. */
const expectUnauthorized = (res: request.Response, message = SESSION_INVALID) => {
  expect(res.status).toBe(401);
  const { error } = errorBodySchema.parse(res.body);
  expect(error.code).toBe('UNAUTHORIZED');
  expect(error.message).toBe(message);
};

describe('optionalAuth (POST /api/v1/chat)', () => {
  it('sin cabecera responde como anónimo sin consultar a Supabase', async () => {
    const res = await postChat();
    expect(res.status).toBe(200);
    expect(getClaims).not.toHaveBeenCalled();
  });

  it('con token válido continúa y verifica ese token', async () => {
    const res = await postChat(bearer(VALID));
    expect(res.status).toBe(200);
    expect(getClaims).toHaveBeenCalledWith(VALID);
  });

  it('con token inválido responde 401 sin llamar a la IA', async () => {
    expectUnauthorized(await postChat(bearer('basura')));
    expect(chat).not.toHaveBeenCalled();
  });

  it('con token vencido responde 401', async () => {
    getClaims.mockResolvedValue(rejected('JWT has expired'));
    expectUnauthorized(await postChat(bearer('vencido')));
    expect(chat).not.toHaveBeenCalled();
  });

  it.each(['Basic abc', 'Bearer', 'Bearer ', 'token-sin-esquema'])(
    'con cabecera mal formada (%s) responde 401',
    async (header) => {
      expectUnauthorized(await postChat({ Authorization: header }));
      expect(getClaims).not.toHaveBeenCalled();
    },
  );

  it('con claims sin `sub` responde 401', async () => {
    getClaims.mockResolvedValue({ data: { claims: { email: 'x@y.co' } }, error: null });
    expectUnauthorized(await postChat(bearer(VALID)));
  });

  it('si Supabase Auth no responde es un 500, no un 401', async () => {
    getClaims.mockResolvedValue({ data: null, error: new AuthRetryableFetchError('down', 0) });
    const res = await postChat(bearer(VALID));
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('si Supabase Auth responde 5xx también es un 500', async () => {
    getClaims.mockResolvedValue({
      data: null,
      error: new AuthApiError('upstream', 503, undefined),
    });
    expect((await postChat(bearer(VALID))).status).toBe(500);
  });

  it('también protege /scan/classify', async () => {
    expectUnauthorized(
      await request(appWith()).post('/api/v1/scan/classify').set(bearer('basura')).send({}),
    );
  });
});

describe('GET /api/v1/me (requireAuth)', () => {
  it('sin cabecera responde 401 pidiendo iniciar sesión', async () => {
    expectUnauthorized(await request(appWith()).get('/api/v1/me'), LOGIN_REQUIRED);
    expect(getClaims).not.toHaveBeenCalled();
  });

  it('con cabecera mal formada responde 401 de sesión no válida', async () => {
    expectUnauthorized(
      await request(appWith()).get('/api/v1/me').set({ Authorization: 'Basic x' }),
    );
  });

  it('con token inválido responde 401', async () => {
    expectUnauthorized(await request(appWith()).get('/api/v1/me').set(bearer('basura')));
  });

  it('con token válido devuelve el perfil del propio usuario', async () => {
    const profilesRepo = fakeProfiles('Ana');
    const res = await request(appWith({ profilesRepo })).get('/api/v1/me').set(bearer(VALID));

    expect(res.status).toBe(200);
    expect(meResponseSchema.parse(res.body)).toEqual({
      id: USER_ID,
      email: 'ana@ejemplo.com',
      displayName: 'Ana',
    });
    expect(profilesRepo.findById).toHaveBeenCalledWith(USER_ID);
  });

  it('sin perfil devuelve displayName null', async () => {
    const res = await request(appWith({ profilesRepo: fakeProfiles(null) }))
      .get('/api/v1/me')
      .set(bearer(VALID));
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBeNull();
  });
});

describe('logs', () => {
  it('no registran el token ni las cookies', async () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk, _enc, done) {
        lines.push(String(chunk));
        done();
      },
    });
    const token = 'eyJ.secreto-que-no-debe-salir.firma';
    getClaims.mockResolvedValue(claimsOk);

    await request(appWith({ logger: createLogger('info', sink) }))
      .get('/api/v1/me')
      .set({ ...bearer(token), Cookie: 'sb-access=cookie-secreta' });

    await vi.waitFor(() => expect(lines.join('')).toContain('[Redacted]'));
    const output = lines.join('');
    expect(output).toContain('"host"'); // las demás cabeceras siguen registrándose
    expect(output).not.toContain(token);
    expect(output).not.toContain('cookie-secreta');
  });
});
