import { Writable } from 'node:stream';
import {
  classifyResponseSchema,
  upcycleResponseSchema,
  type AiClassifyOutput,
  type AiUpcycleOutput,
} from '@ecoclasifica/shared';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import type { AiProvider } from '../src/services/ai/ai.provider';
import { createLogger } from '../src/utils/logger';
import { fakeDisposalRepo } from './helpers/disposalRules';
import { bearer, fakeVerifier, memoryScansRepo, TOKEN_A, USER_A } from './helpers/scansRepo';

const jpegBytes = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200)]);
const validBody = { image: jpegBytes.toString('base64'), mimeType: 'image/jpeg' };
const usage = { promptTokens: 400, completionTokens: 90 };

const bottle: AiClassifyOutput = {
  is_waste: true,
  object: 'Botella de gaseosa',
  material: 'plastico',
  material_detail: 'PET transparente',
  confidence: 0.93,
  alternatives: [],
};

const idea = (n: number) => ({
  title: `Idea ${n}`,
  description: `Descripción ${n}.`,
  extra_materials: ['Pegamento'],
});

const jar: AiUpcycleOutput = {
  is_waste: true,
  can_upcycle: true,
  reason: '',
  object_name: 'Frasco de vidrio',
  material: 'vidrio',
  difficulty: 'Fácil',
  ideas: [idea(1), idea(2), idea(3)],
};

const battery: AiUpcycleOutput = {
  is_waste: true,
  can_upcycle: false,
  reason: 'Es un residuo peligroso.',
  object_name: 'Pila',
  material: 'peligroso',
};

function fakeAi(classify: AiClassifyOutput, upcycle: AiUpcycleOutput = jar): AiProvider {
  return {
    classify: vi
      .fn<AiProvider['classify']>()
      .mockResolvedValue({ data: classify, usage, latencyMs: 1 }),
    upcycle: vi
      .fn<AiProvider['upcycle']>()
      .mockResolvedValue({ data: upcycle, usage, latencyMs: 1 }),
    chat: vi.fn(),
  };
}

function setup(ai = fakeAi(bottle), lines?: string[]) {
  const scansRepo = memoryScansRepo();
  const sink = new Writable({
    write(chunk, _enc, done) {
      lines?.push(String(chunk));
      done();
    },
  });
  const app = createApp({
    disposalRepo: fakeDisposalRepo(),
    aiProvider: ai,
    tokenVerifier: fakeVerifier,
    scansRepo,
    logger: createLogger('info', sink),
  });
  return { app, scansRepo };
}

describe('guardar escaneos en el historial (HU-13)', () => {
  it('con sesión, clasificar guarda la copia completa y responde scanId y saved: true', async () => {
    const { app, scansRepo } = setup();

    const res = await request(app)
      .post('/api/v1/scan/classify')
      .set(bearer(TOKEN_A))
      .send(validBody);

    expect(res.status).toBe(200);
    const body = classifyResponseSchema.parse(res.body);
    expect(body.saved).toBe(true);
    expect(scansRepo.save).toHaveBeenCalledTimes(1);
    const saved = scansRepo.save.mock.calls[0]![0];
    expect(saved).toMatchObject({
      id: body.scanId,
      userId: USER_A,
      objectName: 'Botella de gaseosa',
      materialCode: 'plastico',
      confidence: 0.93,
      ideas: [],
      saved: { mode: 'classify', result: body.result, disposal: body.disposal },
    });
    expect(saved.image.bytes.equals(jpegBytes)).toBe(true);
    expect(saved.image.mimeType).toBe('image/jpeg');
  });

  it('con sesión, las ideas se guardan con su id y la respuesta los incluye', async () => {
    const { app, scansRepo } = setup();

    const res = await request(app)
      .post('/api/v1/scan/upcycle')
      .set(bearer(TOKEN_A))
      .send(validBody);

    const body = upcycleResponseSchema.parse(res.body);
    expect(body.saved).toBe(true);
    const saved = scansRepo.save.mock.calls[0]![0];
    expect(saved.id).toBe(body.scanId);
    expect(saved.difficulty).toBe('Fácil');
    expect(saved.saved).toEqual({ mode: 'upcycle', result: body.result });
    if (!body.result.canUpcycle) throw new Error('se esperaban ideas');
    expect(saved.ideas.map((i) => i.id)).toEqual(body.result.ideas.map((i) => i.ideaId));
    expect(saved.ideas.map((i) => i.ideaIndex)).toEqual([0, 1, 2]);
  });

  it('con sesión, un objeto no reutilizable se guarda sin ideas', async () => {
    const { app, scansRepo } = setup(fakeAi(bottle, battery));

    const res = await request(app)
      .post('/api/v1/scan/upcycle')
      .set(bearer(TOKEN_A))
      .send(validBody);

    expect(upcycleResponseSchema.parse(res.body).saved).toBe(true);
    expect(scansRepo.save.mock.calls[0]![0]).toMatchObject({ ideas: [], difficulty: null });
  });

  it('sin sesión no guarda nada', async () => {
    const { app, scansRepo } = setup();

    const classify = await request(app).post('/api/v1/scan/classify').send(validBody);
    const upcycle = await request(app).post('/api/v1/scan/upcycle').send(validBody);

    expect(classifyResponseSchema.parse(classify.body)).toMatchObject({
      scanId: null,
      saved: false,
    });
    const upBody = upcycleResponseSchema.parse(upcycle.body);
    expect(upBody).toMatchObject({ scanId: null, saved: false });
    if (upBody.result.canUpcycle) expect(upBody.result.ideas[0]?.ideaId).toBeUndefined();
    expect(scansRepo.save).not.toHaveBeenCalled();
  });

  it('NOT_A_WASTE no se guarda', async () => {
    const { app, scansRepo } = setup(fakeAi({ ...bottle, is_waste: false }));

    const res = await request(app)
      .post('/api/v1/scan/classify')
      .set(bearer(TOKEN_A))
      .send(validBody);

    expect(res.status).toBe(422);
    expect(scansRepo.save).not.toHaveBeenCalled();
  });

  it('si guardar falla, igual devuelve el resultado con saved: false y registra el error sin la imagen', async () => {
    const lines: string[] = [];
    const { app, scansRepo } = setup(fakeAi(bottle), lines);
    scansRepo.save.mockRejectedValueOnce(new Error('No se pudo subir la imagen: timeout'));

    const res = await request(app)
      .post('/api/v1/scan/classify')
      .set(bearer(TOKEN_A))
      .send(validBody);

    expect(res.status).toBe(200);
    expect(classifyResponseSchema.parse(res.body)).toMatchObject({
      scanId: null,
      saved: false,
      result: { object: 'Botella de gaseosa' },
    });
    await vi.waitFor(() =>
      expect(lines.join('')).toContain('No se pudo guardar el escaneo en el historial'),
    );
    const output = lines.join('');
    expect(output).toContain('No se pudo subir la imagen: timeout');
    expect(output).not.toContain(validBody.image);
    expect(output).not.toContain(USER_A);
    expect(output).not.toContain('ana@ejemplo.com');
  });
});
