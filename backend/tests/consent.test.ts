import {
  classifyResponseSchema,
  consentResponseSchema,
  errorBodySchema,
  meResponseSchema,
  PRIVACY_VERSION,
  type AiClassifyOutput,
  type ChatMessage,
} from '@ecoclasifica/shared';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import type { AiProvider } from '../src/services/ai/ai.provider';
import { memoryChatMessagesRepo } from './helpers/chatMessagesRepo';
import { fakeDisposalRepo } from './helpers/disposalRules';
import { memoryFavoritesRepo, storedIdea } from './helpers/favoritesRepo';
import { memoryProfilesRepo, type StoredProfile } from './helpers/profilesRepo';
import {
  bearer,
  fakeVerifier,
  memoryScansRepo,
  TOKEN_A,
  TOKEN_B,
  USER_A,
  USER_B,
} from './helpers/scansRepo';

// HU-21: autorización de la política de privacidad y bloqueo del guardado sin ella.

const OLD_VERSION = '2025-01-1';
const jpegBytes = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200)]);
const scanBody = { image: jpegBytes.toString('base64'), mimeType: 'image/jpeg' };

const bottle: AiClassifyOutput = {
  is_waste: true,
  object: 'Botella de gaseosa',
  material: 'plastico',
  material_detail: 'PET transparente',
  confidence: 0.93,
  alternatives: [],
};

const ideaA = storedIdea(USER_A);
const clientIdea = {
  objectName: 'Lata',
  title: 'Idea del cliente',
  description: 'Otra cosa.',
  extraMaterials: [],
};
const ask = (content: string): ChatMessage => ({ role: 'user', content });

/** Ana sin autorización (o con una versión vieja); Beto con la vigente. */
function setup(ana: Partial<StoredProfile> = { privacyVersion: null }) {
  const profilesRepo = memoryProfilesRepo(
    {
      [USER_A]: ana,
      [USER_B]: { privacyVersion: PRIVACY_VERSION, privacyAcceptedAt: new Date(0) },
    },
    { consentByDefault: false },
  );
  const scansRepo = memoryScansRepo();
  const favoritesRepo = memoryFavoritesRepo([ideaA]);
  const chatMessagesRepo = memoryChatMessagesRepo();
  const ai = {
    classify: vi.fn<AiProvider['classify']>().mockResolvedValue({
      data: bottle,
      usage: { promptTokens: 400, completionTokens: 90 },
      latencyMs: 1,
    }),
    upcycle: vi.fn(),
    chat: vi.fn<AiProvider['chat']>().mockResolvedValue({
      reply: 'Lava la lata.',
      usage: { promptTokens: 200, completionTokens: 40 },
      latencyMs: 1,
    }),
  };
  const app = createApp({
    disposalRepo: fakeDisposalRepo(),
    aiProvider: ai,
    tokenVerifier: fakeVerifier,
    profilesRepo,
    scansRepo,
    favoritesRepo,
    chatMessagesRepo,
  });
  return { app, ai, profilesRepo, scansRepo, favoritesRepo, chatMessagesRepo };
}

const expectError = (res: request.Response, status: number, code: string) => {
  expect(res.status).toBe(status);
  expect(errorBodySchema.parse(res.body).error.code).toBe(code);
};

describe('POST /api/v1/me/consent', () => {
  it('guarda la versión vigente del servidor aunque el cliente envíe otra', async () => {
    const { app, profilesRepo } = setup();

    const res = await request(app)
      .post('/api/v1/me/consent')
      .set(bearer(TOKEN_A))
      .send({ privacyVersion: OLD_VERSION, privacyAcceptedAt: '2000-01-01T00:00:00Z' });

    expect(res.status).toBe(200);
    const body = consentResponseSchema.parse(res.body);
    expect(body.privacyVersion).toBe(PRIVACY_VERSION);
    expect(Date.now() - Date.parse(body.privacyAcceptedAt)).toBeLessThan(60_000);
    expect(profilesRepo.saveConsent).toHaveBeenCalledWith(
      USER_A,
      PRIVACY_VERSION,
      expect.any(Date),
    );
    expect(profilesRepo.rows.get(USER_A)?.privacyVersion).toBe(PRIVACY_VERSION);
  });

  it('si ya autorizó la versión vigente, conserva la primera fecha', async () => {
    const first = new Date('2026-10-21T08:00:00.000Z');
    const { app, profilesRepo } = setup({
      privacyVersion: PRIVACY_VERSION,
      privacyAcceptedAt: first,
    });

    const res = await request(app).post('/api/v1/me/consent').set(bearer(TOKEN_A));

    expect(res.status).toBe(200);
    expect(consentResponseSchema.parse(res.body).privacyAcceptedAt).toBe(first.toISOString());
    expect(profilesRepo.rows.get(USER_A)?.privacyAcceptedAt).toEqual(first);
  });

  it('aceptar dos veces responde la misma fecha', async () => {
    const { app } = setup();
    const accept = () => request(app).post('/api/v1/me/consent').set(bearer(TOKEN_A));

    const first = consentResponseSchema.parse((await accept()).body);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = consentResponseSchema.parse((await accept()).body);

    expect(second.privacyAcceptedAt).toBe(first.privacyAcceptedAt);
  });

  it('con una versión vieja guarda la vigente con fecha nueva', async () => {
    const { app, profilesRepo } = setup({
      privacyVersion: OLD_VERSION,
      privacyAcceptedAt: new Date(0),
    });

    await request(app).post('/api/v1/me/consent').set(bearer(TOKEN_A));

    const stored = profilesRepo.rows.get(USER_A);
    expect(stored?.privacyVersion).toBe(PRIVACY_VERSION);
    expect(stored?.privacyAcceptedAt?.getTime()).toBeGreaterThan(0);
  });

  it('solo toca el perfil del usuario con sesión', async () => {
    const { app, profilesRepo } = setup();
    const before = profilesRepo.rows.get(USER_B);

    await request(app).post('/api/v1/me/consent').set(bearer(TOKEN_A));

    expect(profilesRepo.saveConsent).toHaveBeenCalledTimes(1);
    expect(profilesRepo.rows.get(USER_B)).toEqual(before);
  });

  it('responde 401 sin sesión', async () => {
    const { app, profilesRepo } = setup();
    expectError(await request(app).post('/api/v1/me/consent'), 401, 'UNAUTHORIZED');
    expect(profilesRepo.saveConsent).not.toHaveBeenCalled();
  });

  it('GET /me devuelve la versión autorizada después de aceptar', async () => {
    const { app } = setup();
    const before = await request(app).get('/api/v1/me').set(bearer(TOKEN_A));
    expect(meResponseSchema.parse(before.body).privacyVersion).toBeNull();

    await request(app).post('/api/v1/me/consent').set(bearer(TOKEN_A));

    const after = await request(app).get('/api/v1/me').set(bearer(TOKEN_A));
    expect(meResponseSchema.parse(after.body).privacyVersion).toBe(PRIVACY_VERSION);
  });
});

describe('sin autorización vigente no se guarda nada', () => {
  it.each([
    ['nunca autorizó', { privacyVersion: null }],
    ['versión desactualizada', { privacyVersion: OLD_VERSION, privacyAcceptedAt: new Date(0) }],
  ])('POST /favorites responde 403 CONSENT_REQUIRED (%s)', async (_case, ana) => {
    const { app, favoritesRepo } = setup(ana);

    const res = await request(app)
      .post('/api/v1/favorites')
      .set(bearer(TOKEN_A))
      .send({ ideaId: ideaA.ideaId });

    expectError(res, 403, 'CONSENT_REQUIRED');
    expect(favoritesRepo.rows).toHaveLength(0);
  });

  it('con la versión vigente POST /favorites sí guarda', async () => {
    const { app, favoritesRepo } = setup({ privacyVersion: PRIVACY_VERSION });

    const res = await request(app)
      .post('/api/v1/favorites')
      .set(bearer(TOKEN_A))
      .send({ ideaId: ideaA.ideaId });

    expect(res.status).toBe(201);
    expect(favoritesRepo.rows).toHaveLength(1);
  });

  it('clasificar devuelve el resultado con saved: false y no guarda', async () => {
    const { app, scansRepo } = setup({ privacyVersion: OLD_VERSION });

    const res = await request(app)
      .post('/api/v1/scan/classify')
      .set(bearer(TOKEN_A))
      .send(scanBody);

    expect(res.status).toBe(200);
    const body = classifyResponseSchema.parse(res.body);
    expect(body).toMatchObject({ saved: false, scanId: null });
    expect(scansRepo.save).not.toHaveBeenCalled();
  });

  it('con autorización vigente clasificar sí guarda', async () => {
    const { app, scansRepo } = setup();

    const res = await request(app)
      .post('/api/v1/scan/classify')
      .set(bearer(TOKEN_B))
      .send(scanBody);

    expect(classifyResponseSchema.parse(res.body).saved).toBe(true);
    expect(scansRepo.save).toHaveBeenCalledTimes(1);
  });

  it('el chat funciona como anónimo: idea del cliente, sin cargar ni guardar el hilo', async () => {
    const { app, ai, chatMessagesRepo } = setup();

    const res = await request(app)
      .post('/api/v1/chat')
      .set(bearer(TOKEN_A))
      .send({ ideaId: ideaA.ideaId, idea: clientIdea, messages: [ask('¿Cómo empiezo?')] });

    expect(res.status).toBe(200);
    expect(ai.chat).toHaveBeenCalledWith(clientIdea, [ask('¿Cómo empiezo?')]);
    expect(chatMessagesRepo.listRecent).not.toHaveBeenCalled();
    expect(chatMessagesRepo.insertExchange).not.toHaveBeenCalled();
  });

  it('el chat sin autorización mantiene las validaciones de HU-11', async () => {
    const { app, ai } = setup();

    const res = await request(app)
      .post('/api/v1/chat')
      .set(bearer(TOKEN_A))
      .send({ idea: { ...clientIdea, objectName: 'Pila' }, messages: [ask('Hola')] });

    expectError(res, 422, 'UNSAFE_REQUEST');
    expect(ai.chat).not.toHaveBeenCalled();
  });
});
