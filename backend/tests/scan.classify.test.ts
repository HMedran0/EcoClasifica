import {
  MAX_IMAGE_BYTES,
  MAX_LOCALE_LENGTH,
  classifyResponseSchema,
  type AiClassifyOutput,
} from '@ecoclasifica/shared';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import type { AiProvider } from '../src/services/ai/ai.provider';
import { AppError } from '../src/utils/appError';
import { fakeDisposalRepo } from './helpers/disposalRules';

const URL = '/api/v1/scan/classify';
const jpegBytes = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200)]);
const validBody = { image: jpegBytes.toString('base64'), mimeType: 'image/jpeg' };

const bottle: AiClassifyOutput = {
  is_waste: true,
  object: 'Botella de gaseosa',
  material: 'plastico',
  material_detail: 'PET transparente',
  confidence: 0.93,
  alternatives: [],
};

function fakeAi(classify: AiProvider['classify']): AiProvider {
  return {
    classify,
    upcycle: vi.fn(),
    chat: vi.fn(),
  };
}

const resolving = (data: AiClassifyOutput) =>
  vi.fn<AiProvider['classify']>().mockResolvedValue({
    data,
    usage: { promptTokens: 400, completionTokens: 90 },
    latencyMs: 1600,
  });

describe('POST /api/v1/scan/classify', () => {
  it('devuelve material, objeto y certeza según el contrato', async () => {
    const classify = resolving(bottle);
    const res = await request(
      createApp({ disposalRepo: fakeDisposalRepo(), aiProvider: fakeAi(classify) }),
    )
      .post(URL)
      .send(validBody);

    expect(res.status).toBe(200);
    expect(classifyResponseSchema.parse(res.body)).toBeTruthy();
    expect(res.body.result).toMatchObject({
      object: 'Botella de gaseosa',
      material: 'plastico',
      materialDetail: 'PET transparente',
      confidence: 0.93,
      lowConfidence: false,
    });
    expect(res.body.saved).toBe(false);
    expect(classify).toHaveBeenCalledWith({ base64: validBody.image, mimeType: 'image/jpeg' });
  });

  it('marca lowConfidence cuando la certeza es menor a 0,60', async () => {
    const app = createApp({
      disposalRepo: fakeDisposalRepo(),
      aiProvider: fakeAi(resolving({ ...bottle, confidence: 0.4 })),
    });
    const res = await request(app).post(URL).send(validBody);
    expect(res.body.result.lowConfidence).toBe(true);
  });

  it('devuelve el contenedor de disposal_rules cuando la certeza es ≥ 0,60', async () => {
    const app = createApp({
      disposalRepo: fakeDisposalRepo(),
      aiProvider: fakeAi(resolving({ ...bottle, material: 'vidrio', confidence: 0.95 })),
    });
    const res = await request(app).post(URL).send(validBody);
    expect(res.status).toBe(200);
    expect(res.body.disposal).toEqual({
      binCode: 'WHITE',
      binName: 'Contenedor blanco (aprovechables)',
      colorHex: '#F5F5F5',
      icon: 'bin-white',
      instructions: 'Limpio y seco. Si está roto, envuélvelo en papel.',
      requiresDropOff: false,
    });
  });

  it('devuelve disposal null cuando la certeza es menor a 0,60', async () => {
    const app = createApp({
      disposalRepo: fakeDisposalRepo(),
      aiProvider: fakeAi(resolving({ ...bottle, confidence: 0.4 })),
    });
    const res = await request(app).post(URL).send(validBody);
    expect(res.body.disposal).toBeNull();
  });

  it.each(['electronico', 'peligroso'] as const)(
    'indica punto limpio para %s aunque la certeza sea baja',
    async (material) => {
      const app = createApp({
        disposalRepo: fakeDisposalRepo(),
        aiProvider: fakeAi(resolving({ ...bottle, material, confidence: 0.4 })),
      });
      const res = await request(app).post(URL).send(validBody);
      expect(res.body.result.lowConfidence).toBe(true);
      expect(res.body.disposal).toMatchObject({
        binCode: 'DROP_OFF',
        binName: 'Punto limpio',
        requiresDropOff: true,
      });
    },
  );

  it('clasifica igual con disposal null si las reglas no cargan', async () => {
    const repo = fakeDisposalRepo();
    repo.listAll.mockRejectedValue(new Error('Supabase caído'));
    const app = createApp({ disposalRepo: repo, aiProvider: fakeAi(resolving(bottle)) });
    const res = await request(app).post(URL).send(validBody);
    expect(res.status).toBe(200);
    expect(res.body.result.material).toBe('plastico');
    expect(res.body.disposal).toBeNull();
  });

  it('responde 422 NOT_A_WASTE si la imagen no contiene un residuo', async () => {
    const app = createApp({
      disposalRepo: fakeDisposalRepo(),
      aiProvider: fakeAi(resolving({ ...bottle, is_waste: false })),
    });
    const res = await request(app).post(URL).send(validBody);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('NOT_A_WASTE');
  });

  it('responde 400 VALIDATION_ERROR si el cuerpo no cumple el esquema', async () => {
    const classify = resolving(bottle);
    const res = await request(
      createApp({ disposalRepo: fakeDisposalRepo(), aiProvider: fakeAi(classify) }),
    )
      .post(URL)
      .send({ image: validBody.image, mimeType: 'image/gif' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(classify).not.toHaveBeenCalled();
  });

  it('responde 400 INVALID_IMAGE si los bytes no son una imagen', async () => {
    const classify = resolving(bottle);
    const res = await request(
      createApp({ disposalRepo: fakeDisposalRepo(), aiProvider: fakeAi(classify) }),
    )
      .post(URL)
      .send({ image: Buffer.alloc(200, 0x41).toString('base64'), mimeType: 'image/jpeg' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_IMAGE');
    expect(classify).not.toHaveBeenCalled();
  });

  it('responde 400 INVALID_IMAGE si el mimeType declarado no coincide con los bytes', async () => {
    const classify = resolving(bottle);
    const res = await request(
      createApp({ disposalRepo: fakeDisposalRepo(), aiProvider: fakeAi(classify) }),
    )
      .post(URL)
      .send({ ...validBody, mimeType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_IMAGE');
    expect(classify).not.toHaveBeenCalled();
  });

  it('responde 400 INVALID_IMAGE si la imagen supera 4 MB (antes de decodificar)', async () => {
    const big = Buffer.concat([jpegBytes, Buffer.alloc(MAX_IMAGE_BYTES)]);
    const classify = resolving(bottle);
    const res = await request(
      createApp({ disposalRepo: fakeDisposalRepo(), aiProvider: fakeAi(classify) }),
    )
      .post(URL)
      .send({ image: big.toString('base64'), mimeType: 'image/jpeg' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_IMAGE');
    expect(classify).not.toHaveBeenCalled();
  });

  it('responde 400 VALIDATION_ERROR si locale es demasiado largo', async () => {
    const res = await request(
      createApp({ disposalRepo: fakeDisposalRepo(), aiProvider: fakeAi(resolving(bottle)) }),
    )
      .post(URL)
      .send({ ...validBody, locale: 'x'.repeat(MAX_LOCALE_LENGTH + 1) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('responde 502 AI_BAD_RESPONSE con el mensaje para el usuario', async () => {
    const classify = vi
      .fn<AiProvider['classify']>()
      .mockRejectedValue(
        new AppError('AI_BAD_RESPONSE', 'No pudimos analizar la imagen, intenta de nuevo'),
      );
    const res = await request(
      createApp({ disposalRepo: fakeDisposalRepo(), aiProvider: fakeAi(classify) }),
    )
      .post(URL)
      .send(validBody);
    expect(res.status).toBe(502);
    expect(res.body.error).toMatchObject({
      code: 'AI_BAD_RESPONSE',
      message: 'No pudimos analizar la imagen, intenta de nuevo',
    });
  });

  it('responde 504 AI_TIMEOUT si la IA no responde a tiempo', async () => {
    const classify = vi
      .fn<AiProvider['classify']>()
      .mockRejectedValue(new AppError('AI_TIMEOUT', 'El análisis tardó demasiado'));
    const res = await request(
      createApp({ disposalRepo: fakeDisposalRepo(), aiProvider: fakeAi(classify) }),
    )
      .post(URL)
      .send(validBody);
    expect(res.status).toBe(504);
    expect(res.body.error.code).toBe('AI_TIMEOUT');
  });

  it('responde 429 RATE_LIMITED después de 10 escaneos por minuto', async () => {
    const app = createApp({
      disposalRepo: fakeDisposalRepo(),
      aiProvider: fakeAi(resolving(bottle)),
    });
    for (let i = 0; i < 10; i++) {
      expect((await request(app).post(URL).send(validBody)).status).toBe(200);
    }
    const res = await request(app).post(URL).send(validBody);
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('cuerpo malformado', () => {
  it('responde 400 VALIDATION_ERROR con JSON roto (no 500)', async () => {
    const res = await request(
      createApp({ disposalRepo: fakeDisposalRepo(), aiProvider: fakeAi(resolving(bottle)) }),
    )
      .post(URL)
      .set('Content-Type', 'application/json')
      .send('{"image":"AAAA');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('validación de la imagen (un solo código)', () => {
  const post = (body: object) => {
    const classify = resolving(bottle);
    const app = createApp({ disposalRepo: fakeDisposalRepo(), aiProvider: fakeAi(classify) });
    return { classify, req: request(app).post(URL).send(body) };
  };

  it.each([
    ['falta', { mimeType: 'image/jpeg' }],
    ['no es texto', { image: 12345, mimeType: 'image/jpeg' }],
    ['es demasiado corta', { image: 'AAAA', mimeType: 'image/jpeg' }],
  ])('responde 400 INVALID_IMAGE si la imagen %s', async (_caso, body) => {
    const { classify, req } = post(body);
    const res = await req;
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_IMAGE');
    expect(res.body.error.message).not.toMatch(/required|expected/i);
    expect(classify).not.toHaveBeenCalled();
  });

  it('prioriza INVALID_IMAGE si también fallan otros campos', async () => {
    const { req } = post({ image: 'AAAA', mimeType: 'image/gif' });
    const res = await req;
    expect(res.body.error.code).toBe('INVALID_IMAGE');
  });

  it('mantiene VALIDATION_ERROR si la imagen es válida y falla otro campo', async () => {
    const { req } = post({ ...validBody, mimeType: 'image/gif' });
    const res = await req;
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('baja certeza y no residuo (HU-07)', () => {
  it('con certeza baja devuelve las 2 mejores hipótesis ordenadas', async () => {
    const data: AiClassifyOutput = {
      ...bottle,
      confidence: 0.45,
      alternatives: [
        { material: 'vidrio', confidence: 0.2 },
        { material: 'metal', confidence: 0.3 },
      ],
    };
    const app = createApp({
      disposalRepo: fakeDisposalRepo(),
      aiProvider: fakeAi(resolving(data)),
    });
    const res = await request(app).post(URL).send(validBody);
    expect(res.body.result.lowConfidence).toBe(true);
    expect(res.body.disposal).toBeNull();
    expect(res.body.result.alternatives).toEqual([
      { material: 'metal', confidence: 0.3 },
      { material: 'vidrio', confidence: 0.2 },
    ]);
    expect(classifyResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it.each([
    [0.59, true],
    [0.6, false],
  ])('con certeza %s marca lowConfidence=%s (umbral 0,60)', async (confidence, low) => {
    const app = createApp({
      disposalRepo: fakeDisposalRepo(),
      aiProvider: fakeAi(resolving({ ...bottle, confidence })),
    });
    const res = await request(app).post(URL).send(validBody);
    expect(res.body.result.lowConfidence).toBe(low);
  });

  it('quita el material principal y los repetidos de las alternativas', async () => {
    const data: AiClassifyOutput = {
      ...bottle,
      confidence: 0.5,
      alternatives: [
        { material: 'plastico', confidence: 0.4 },
        { material: 'vidrio', confidence: 0.1 },
      ],
    };
    const app = createApp({
      disposalRepo: fakeDisposalRepo(),
      aiProvider: fakeAi(resolving(data)),
    });
    const res = await request(app).post(URL).send(validBody);
    expect(res.body.result.alternatives).toEqual([{ material: 'vidrio', confidence: 0.1 }]);
  });

  it('con NOT_A_WASTE no consulta reglas ni devuelve datos de escaneo guardado', async () => {
    const repo = fakeDisposalRepo();
    const app = createApp({
      disposalRepo: repo,
      aiProvider: fakeAi(resolving({ ...bottle, is_waste: false })),
    });
    const res = await request(app).post(URL).send(validBody);
    expect(res.status).toBe(422);
    expect(res.body).not.toHaveProperty('scanId');
    expect(res.body).not.toHaveProperty('saved');
    expect(repo.listAll).not.toHaveBeenCalled();
  });
});
