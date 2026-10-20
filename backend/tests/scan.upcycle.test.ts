import {
  UPCYCLE_DESCRIPTION_MAX,
  UPCYCLE_REASON_MAX,
  UPCYCLE_TITLE_MAX,
  upcycleResponseSchema,
  type AiUpcycleOutput,
} from '@ecoclasifica/shared';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import type { AiProvider } from '../src/services/ai/ai.provider';
import { DeepSeekProvider } from '../src/services/ai/deepseek.provider';
import { AppError } from '../src/utils/appError';
import { fakeDisposalRepo } from './helpers/disposalRules';

const URL = '/api/v1/scan/upcycle';
const jpegBytes = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200)]);
const validBody = { image: jpegBytes.toString('base64'), mimeType: 'image/jpeg' };

const idea = (n: number) => ({
  title: `Idea ${n}`,
  description: `Descripción corta ${n}.`,
  extra_materials: ['Pegamento'],
});

const jar = {
  is_waste: true,
  can_upcycle: true,
  reason: '',
  object_name: 'Frasco de vidrio',
  material: 'vidrio',
  difficulty: 'Fácil',
  ideas: [idea(1), idea(2), idea(3)],
} satisfies AiUpcycleOutput;

const diaperBag = {
  is_waste: true,
  can_upcycle: false,
  reason: 'Puede contener residuos sanitarios: no es seguro manipularlo.',
  object_name: 'Bolsa cerrada',
  material: 'plastico',
} satisfies AiUpcycleOutput;

function fakeAi(upcycle: AiProvider['upcycle']): AiProvider {
  return { classify: vi.fn(), upcycle, chat: vi.fn() };
}

const resolving = (data: AiUpcycleOutput) =>
  vi.fn<AiProvider['upcycle']>().mockResolvedValue({
    data,
    usage: { promptTokens: 500, completionTokens: 240 },
    latencyMs: 2200,
  });

const appWith = (upcycle: AiProvider['upcycle']) =>
  createApp({ disposalRepo: fakeDisposalRepo(), aiProvider: fakeAi(upcycle) });

const post = (upcycle: AiProvider['upcycle']) =>
  request(appWith(upcycle)).post(URL).send(validBody);

/** Texto de `words` palabras de 9 caracteres ("palabraNN"), para probar recortes. */
const longText = (words: number) =>
  Array.from({ length: words }, (_, i) => `palabra${String(i).padStart(2, '0')}`).join(' ');

/** El recorte termina en «…», respeta el máximo y no parte palabras del original. */
function expectWordTruncated(value: string, original: string, max: number) {
  expect(value.length).toBeLessThanOrEqual(max);
  expect(value.endsWith('…')).toBe(true);
  const kept = value.slice(0, -1);
  expect(original.startsWith(kept)).toBe(true);
  expect(original[kept.length]).toBe(' ');
}

describe('POST /api/v1/scan/upcycle', () => {
  it('devuelve objeto, dificultad y 3 ideas según el contrato', async () => {
    const res = await post(resolving(jar));

    expect(res.status).toBe(200);
    expect(upcycleResponseSchema.parse(res.body)).toBeTruthy();
    expect(res.body).toMatchObject({ scanId: null, mode: 'upcycle', saved: false });
    expect(res.body.result).toMatchObject({
      canUpcycle: true,
      objectName: 'Frasco de vidrio',
      difficulty: 'Fácil',
    });
    expect(res.body.result.ideas).toEqual([
      {
        ideaIndex: 0,
        title: 'Idea 1',
        description: 'Descripción corta 1.',
        extraMaterials: ['Pegamento'],
      },
      {
        ideaIndex: 1,
        title: 'Idea 2',
        description: 'Descripción corta 2.',
        extraMaterials: ['Pegamento'],
      },
      {
        ideaIndex: 2,
        title: 'Idea 3',
        description: 'Descripción corta 3.',
        extraMaterials: ['Pegamento'],
      },
    ]);
  });

  it('recorta a 3 ideas si la IA devuelve más', async () => {
    const res = await post(resolving({ ...jar, ideas: [1, 2, 3, 4, 5].map(idea) }));

    expect(res.status).toBe(200);
    expect(res.body.result.ideas.map((i: { title: string }) => i.title)).toEqual([
      'Idea 1',
      'Idea 2',
      'Idea 3',
    ]);
  });

  it('recorta en palabra completa título (≤ 60) y descripción (≤ 120)', async () => {
    const title = longText(10);
    const description = longText(20);
    const res = await post(
      resolving({ ...jar, ideas: [{ ...idea(1), title, description }, idea(2), idea(3)] }),
    );

    expect(res.status).toBe(200);
    expect(upcycleResponseSchema.parse(res.body)).toBeTruthy();
    const [first] = res.body.result.ideas;
    expectWordTruncated(first.title, title, UPCYCLE_TITLE_MAX);
    expectWordTruncated(first.description, description, UPCYCLE_DESCRIPTION_MAX);
  });

  it('deja como máximo 5 materiales extra', async () => {
    const extra_materials = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const res = await post(
      resolving({ ...jar, ideas: [{ ...idea(1), extra_materials }, idea(2), idea(3)] }),
    );

    expect(res.body.result.ideas[0].extraMaterials).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('devuelve canUpcycle false con el motivo y sin ideas', async () => {
    const res = await post(resolving(diaperBag));

    expect(res.status).toBe(200);
    expect(upcycleResponseSchema.parse(res.body)).toBeTruthy();
    expect(res.body.result).toEqual({
      canUpcycle: false,
      objectName: 'Bolsa cerrada',
      reason: 'Puede contener residuos sanitarios: no es seguro manipularlo.',
    });
  });

  it('recorta el motivo en palabra completa (≤ 160)', async () => {
    const reason = longText(25);
    const res = await post(resolving({ ...diaperBag, reason }));

    expectWordTruncated(res.body.result.reason, reason, UPCYCLE_REASON_MAX);
  });

  it('usa un motivo por defecto si la IA no lo da', async () => {
    const res = await post(resolving({ ...diaperBag, reason: '' }));

    expect(res.body.result.reason).toMatch(/no es seguro/);
  });

  it('responde 422 NOT_A_WASTE si la imagen no contiene un residuo', async () => {
    const res = await post(resolving({ is_waste: false, object_name: 'Persona' }));

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('NOT_A_WASTE');
  });

  it('responde 422 NOT_A_WASTE aunque can_upcycle venga true', async () => {
    const res = await post(resolving({ ...jar, is_waste: false }));

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('NOT_A_WASTE');
  });

  it('responde 400 INVALID_IMAGE sin llamar a la IA si los bytes no son una imagen', async () => {
    const upcycle = resolving(jar);
    const res = await request(appWith(upcycle))
      .post(URL)
      .send({ image: Buffer.alloc(200, 0x41).toString('base64'), mimeType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_IMAGE');
    expect(upcycle).not.toHaveBeenCalled();
  });

  it('responde 400 VALIDATION_ERROR si el cuerpo no cumple el esquema', async () => {
    const upcycle = resolving(jar);
    const res = await request(appWith(upcycle))
      .post(URL)
      .send({ image: validBody.image, mimeType: 'image/gif' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(upcycle).not.toHaveBeenCalled();
  });

  it('responde 502 AI_BAD_RESPONSE y 504 AI_TIMEOUT', async () => {
    const bad = vi
      .fn<AiProvider['upcycle']>()
      .mockRejectedValue(new AppError('AI_BAD_RESPONSE', 'No pudimos analizar la imagen'));
    const slow = vi
      .fn<AiProvider['upcycle']>()
      .mockRejectedValue(new AppError('AI_TIMEOUT', 'El análisis tardó demasiado'));

    expect((await post(bad)).body.error.code).toBe('AI_BAD_RESPONSE');
    expect((await post(bad)).status).toBe(502);
    expect((await post(slow)).status).toBe(504);
  });
});

// Con el proveedor real y `fetch` simulado: cubre la validación Zod y el reintento de extremo a extremo.
describe('POST /api/v1/scan/upcycle: respaldos de seguridad del backend', () => {
  it('bloquea un material peligroso aunque la IA dé ideas', async () => {
    const res = await post(resolving({ ...jar, object_name: 'Envase', material: 'peligroso' }));

    expect(res.status).toBe(200);
    expect(upcycleResponseSchema.parse(res.body)).toBeTruthy();
    expect(res.body.result).toMatchObject({ canUpcycle: false, objectName: 'Envase' });
    expect(res.body.result.reason).toMatch(/peligroso/);
    expect(res.body.result).not.toHaveProperty('ideas');
  });

  it('bloquea un electrónico aunque la IA dé ideas', async () => {
    const res = await post(resolving({ ...jar, object_name: 'Celular', material: 'electronico' }));

    expect(res.body.result.canUpcycle).toBe(false);
    expect(res.body.result.reason).toMatch(/punto limpio/);
  });

  it('bloquea "Pila AA" por término aunque el material no sea peligroso', async () => {
    const res = await post(resolving({ ...jar, object_name: 'Pila AA', material: 'metal' }));

    expect(res.body.result.canUpcycle).toBe(false);
  });

  it.each(['Botella de aceite vacía', 'Frasco de vidrio'])('no bloquea "%s"', async (name) => {
    const res = await post(resolving({ ...jar, object_name: name }));

    expect(res.body.result.canUpcycle).toBe(true);
    expect(res.body.result.ideas).toHaveLength(3);
  });
});

describe('POST /api/v1/scan/upcycle con DeepSeekProvider (fetch simulado)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const completion = (data: unknown) =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(data) }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 500, completion_tokens: 240 },
      }),
      { status: 200 },
    );

  function appWithAiReplies(...replies: unknown[]) {
    const fetchMock = vi.fn();
    for (const reply of replies) fetchMock.mockResolvedValueOnce(completion(reply));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new DeepSeekProvider({
      apiKey: 'test-key',
      baseUrl: 'https://ai.example.test',
      model: 'deepseek-flash',
      maxTokens: 384,
      chatMaxTokens: 512,
      timeoutMs: 1000,
    });
    const app = createApp({ disposalRepo: fakeDisposalRepo(), aiProvider: provider });
    return { app, fetchMock };
  }

  it('reintenta una vez si la IA devuelve menos de 3 ideas', async () => {
    const two = { ...jar, ideas: [idea(1), idea(2)] };
    const { app, fetchMock } = appWithAiReplies(two, jar);

    const res = await request(app).post(URL).send(validBody);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
    expect(res.body.result.ideas).toHaveLength(3);
  });

  it('responde 502 AI_BAD_RESPONSE si tras el reintento siguen faltando ideas', async () => {
    const two = { ...jar, ideas: [idea(1), idea(2)] };
    const { app, fetchMock } = appWithAiReplies(two, two);

    const res = await request(app).post(URL).send(validBody);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('AI_BAD_RESPONSE');
  });

  it.each([
    ['facil', 'Fácil'],
    ['FÁCIL', 'Fácil'],
    ['Media', 'Medio'],
    ['dificil', 'Difícil'],
  ])('normaliza la dificultad %s → %s', async (raw, expected) => {
    const { app, fetchMock } = appWithAiReplies({ ...jar, difficulty: raw });

    const res = await request(app).post(URL).send(validBody);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.body.result.difficulty).toBe(expected);
  });

  it('responde 422 NOT_A_WASTE si is_waste es false aunque can_upcycle venga true y sin ideas', async () => {
    const { app } = appWithAiReplies({ ...jar, is_waste: false, ideas: [] });

    const res = await request(app).post(URL).send(validBody);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('NOT_A_WASTE');
  });

  it('acepta can_upcycle false sin ideas ni dificultad', async () => {
    const { app } = appWithAiReplies({ ...diaperBag, ideas: [] });

    const res = await request(app).post(URL).send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.result.canUpcycle).toBe(false);
  });
});
