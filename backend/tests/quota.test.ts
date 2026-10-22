import { Writable } from 'node:stream';
import { errorBodySchema, type AiClassifyOutput } from '@ecoclasifica/shared';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { AiCallError, type AiProvider } from '../src/services/ai/ai.provider';
import {
  hashIp,
  ipQuotaKey,
  secondsUntilBogotaMidnight,
  startOfBogotaDay,
} from '../src/services/quota.service';
import { AppError } from '../src/utils/appError';
import { createLogger } from '../src/utils/logger';
import { memoryAiUsageRepo, rowsOf, type StoredUsage } from './helpers/aiUsageRepo';
import { fakeDisposalRepo } from './helpers/disposalRules';
import { memoryProfilesRepo } from './helpers/profilesRepo';
import {
  bearer,
  fakeVerifier,
  memoryScansRepo,
  TOKEN_A,
  TOKEN_B,
  USER_A,
} from './helpers/scansRepo';

// HU-20: cuota diaria de IA (por usuario, por IP y tope global) y registro en `ai_usage`.

const SCAN = '/api/v1/scan/classify';
const UPCYCLE = '/api/v1/scan/upcycle';
const CHAT = '/api/v1/chat';
const jpegBytes = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200)]);
const scanBody = { image: jpegBytes.toString('base64'), mimeType: 'image/jpeg' };
const chatBody = {
  ideaIndex: 0,
  idea: {
    objectName: 'Frasco',
    title: 'Portalápices',
    description: 'Decóralo.',
    extraMaterials: [],
  },
  messages: [{ role: 'user', content: 'Pregunta privada' }],
};

const bottle: AiClassifyOutput = {
  is_waste: true,
  object: 'Botella',
  material: 'plastico',
  material_detail: 'PET',
  confidence: 0.93,
  alternatives: [],
};

/** 2026-10-21 10:00 en Bogotá (15:00 UTC). */
const NOON = new Date('2026-10-21T15:00:00Z');

function fakeAi(): { [K in keyof AiProvider]: ReturnType<typeof vi.fn<AiProvider[K]>> } {
  return {
    classify: vi.fn<AiProvider['classify']>().mockResolvedValue({
      data: bottle,
      usage: { promptTokens: 400, completionTokens: 90 },
      latencyMs: 1600,
    }),
    upcycle: vi.fn<AiProvider['upcycle']>(),
    chat: vi.fn<AiProvider['chat']>().mockResolvedValue({
      reply: 'Lávalo primero.',
      usage: { promptTokens: 210, completionTokens: 40 },
      latencyMs: 900,
    }),
  };
}

function setup({
  rows = [] as StoredUsage[],
  now = () => NOON,
  logger,
}: { rows?: StoredUsage[]; now?: () => Date; logger?: ReturnType<typeof createLogger> } = {}) {
  const ai = fakeAi();
  const usage = memoryAiUsageRepo(rows, now);
  const app = createApp({
    disposalRepo: fakeDisposalRepo(),
    aiProvider: ai,
    tokenVerifier: fakeVerifier,
    profilesRepo: memoryProfilesRepo(),
    scansRepo: memoryScansRepo(),
    aiUsageRepo: usage,
    now,
    ...(logger ? { logger } : {}),
  });
  return { app, ai, usage };
}

const post = (app: ReturnType<typeof createApp>, url: string, body: object, token?: string) => {
  const req = request(app).post(url);
  return (token ? req.set(bearer(token)) : req).send(body);
};

const fromIp = (app: ReturnType<typeof createApp>, url: string, body: object, ip: string) =>
  request(app).post(url).set('X-Forwarded-For', ip).send(body);

function expectError(res: request.Response, status: number, code: string) {
  expect(res.status).toBe(status);
  expect(errorBodySchema.parse(res.body).error.code).toBe(code);
}

function captureLogs() {
  const lines: string[] = [];
  const sink = new Writable({
    write(chunk, _enc, done) {
      lines.push(String(chunk));
      done();
    },
  });
  const entries = () => lines.map((l) => JSON.parse(l) as Record<string, unknown>);
  return { logger: createLogger('info', sink), lines, entries };
}

describe('día de America/Bogota', () => {
  it('empieza a las 05:00 UTC', () => {
    expect(startOfBogotaDay(new Date('2026-10-21T15:00:00Z')).toISOString()).toBe(
      '2026-10-21T05:00:00.000Z',
    );
    // 23:59 del 20 en Bogotá todavía es el día anterior aunque en UTC ya sea el 21.
    expect(startOfBogotaDay(new Date('2026-10-21T04:59:59Z')).toISOString()).toBe(
      '2026-10-20T05:00:00.000Z',
    );
    expect(startOfBogotaDay(new Date('2026-10-21T05:00:00Z')).toISOString()).toBe(
      '2026-10-21T05:00:00.000Z',
    );
  });

  it('Retry-After cuenta los segundos hasta medianoche', () => {
    expect(secondsUntilBogotaMidnight(new Date('2026-10-22T04:59:00Z'))).toBe(60);
    expect(secondsUntilBogotaMidnight(NOON)).toBe(14 * 3600);
  });
});

describe('hashIp', () => {
  it('es estable, no contiene la IP y depende de la sal', () => {
    const h = hashIp('203.0.113.7', 'sal-a');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(hashIp('203.0.113.7', 'sal-a'));
    expect(h).toBe(hashIp('::ffff:203.0.113.7', 'sal-a'));
    expect(h).not.toBe(hashIp('203.0.113.7', 'sal-b'));
    expect(h).not.toContain('203');
  });
});

describe('ipQuotaKey', () => {
  it('deja la IPv4 igual y agrupa la IPv6 por su /64', () => {
    expect(ipQuotaKey('203.0.113.7')).toBe('203.0.113.7');
    expect(ipQuotaKey('::FFFF:203.0.113.7')).toBe('203.0.113.7');
    expect(ipQuotaKey('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe('2001:db8:1:2::/64');
    expect(ipQuotaKey('2001:0db8:0001:0002::1')).toBe('2001:db8:1:2::/64');
    expect(ipQuotaKey('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(ipQuotaKey('::1')).toBe('0:0:0:0::/64');
    expect(ipQuotaKey('64:ff9b::203.0.113.7')).toBe('64:ff9b:0:0::/64');
  });

  it('dos direcciones del mismo /64 comparten cuota', () => {
    expect(hashIp('2001:db8:1:2::a', 's')).toBe(hashIp('2001:db8:1:2::b', 's'));
    expect(hashIp('2001:db8:1:2::a', 's')).not.toBe(hashIp('2001:db8:1:3::a', 's'));
  });
});

describe('cuota por usuario', () => {
  it('con 60 escaneos hoy responde 429 sin llamar a la IA', async () => {
    const { app, ai } = setup({ rows: rowsOf(60, { userId: USER_A, createdAt: NOON }) });

    const res = await post(app, SCAN, scanBody, TOKEN_A);

    expectError(res, 429, 'QUOTA_EXCEEDED');
    expect(res.body.error.message).toContain('60 escaneos');
    expect(res.body.error.message).toContain('medianoche');
    expect(res.headers['retry-after']).toBe(String(14 * 3600));
    expect(ai.classify).not.toHaveBeenCalled();
  });

  it('con 59 todavía pasa', async () => {
    const { app, ai } = setup({ rows: rowsOf(59, { userId: USER_A, createdAt: NOON }) });
    expect((await post(app, SCAN, scanBody, TOKEN_A)).status).toBe(200);
    expect(ai.classify).toHaveBeenCalledOnce();
  });

  it('classify y upcycle comparten la cuota de escaneos', async () => {
    const rows = [
      ...rowsOf(30, { userId: USER_A, endpoint: 'classify', createdAt: NOON }),
      ...rowsOf(30, { userId: USER_A, endpoint: 'upcycle', createdAt: NOON }),
    ];
    const { app, ai } = setup({ rows });

    expectError(await post(app, UPCYCLE, scanBody, TOKEN_A), 429, 'QUOTA_EXCEEDED');
    expect(ai.upcycle).not.toHaveBeenCalled();
  });

  it('el chat tiene su propia cuota de 100 mensajes', async () => {
    const rows = [
      ...rowsOf(60, { userId: USER_A, endpoint: 'classify', createdAt: NOON }),
      ...rowsOf(99, { userId: USER_A, endpoint: 'chat', createdAt: NOON }),
    ];
    const { app, ai, usage } = setup({ rows });

    expect((await post(app, CHAT, chatBody, TOKEN_A)).status).toBe(200);
    const res = await post(app, CHAT, chatBody, TOKEN_A);
    expectError(res, 429, 'QUOTA_EXCEEDED');
    expect(res.body.error.message).toContain('100 mensajes de chat');
    expect(ai.chat).toHaveBeenCalledOnce();
    expect(usage.rows.filter((r) => r.endpoint === 'chat')).toHaveLength(100);
  });

  it('la cuota de un usuario no afecta a otro', async () => {
    const { app, ai } = setup({ rows: rowsOf(60, { userId: USER_A, createdAt: NOON }) });

    expect((await post(app, SCAN, scanBody, TOKEN_B)).status).toBe(200);
    expect(ai.classify).toHaveBeenCalledOnce();
  });

  it('se reinicia a medianoche de Bogotá', async () => {
    // 23:59 del 20 de octubre en Bogotá.
    const rows = rowsOf(60, { userId: USER_A, createdAt: new Date('2026-10-21T04:59:00Z') });
    let now = new Date('2026-10-21T04:59:30Z');
    const { app } = setup({ rows, now: () => now });

    expectError(await post(app, SCAN, scanBody, TOKEN_A), 429, 'QUOTA_EXCEEDED');
    now = new Date('2026-10-21T05:00:00Z');
    expect((await post(app, SCAN, scanBody, TOKEN_A)).status).toBe(200);
  });
});

describe('cuota sin sesión (por IP)', () => {
  it('con 30 escaneos de la misma IP responde 429 e invita a crear cuenta', async () => {
    const { app, ai, usage } = setup();
    expect((await fromIp(app, SCAN, scanBody, '203.0.113.7')).status).toBe(200);
    const [first] = usage.rows;
    usage.rows.push(...rowsOf(29, { ipHash: first?.ipHash ?? null, createdAt: NOON }));

    const res = await fromIp(app, SCAN, scanBody, '203.0.113.7');

    expectError(res, 429, 'QUOTA_EXCEEDED');
    expect(res.body.error.message).toContain('30 escaneos');
    expect(res.body.error.message).toContain('Crea una cuenta gratis para seguir hoy');
    expect(ai.classify).toHaveBeenCalledOnce();
    // Otra IP no se ve afectada.
    expect((await fromIp(app, SCAN, scanBody, '198.51.100.9')).status).toBe(200);
  });

  it('el chat sin sesión se corta en 60 mensajes', async () => {
    const { app, ai, usage } = setup();
    expect((await fromIp(app, CHAT, chatBody, '203.0.113.7')).status).toBe(200);
    const [first] = usage.rows;
    usage.rows.push(
      ...rowsOf(59, { endpoint: 'chat', ipHash: first?.ipHash ?? null, createdAt: NOON }),
    );

    const res = await fromIp(app, CHAT, chatBody, '203.0.113.7');
    expectError(res, 429, 'QUOTA_EXCEEDED');
    expect(res.body.error.message).toContain('60 mensajes de chat');
    expect(ai.chat).toHaveBeenCalledOnce();
  });

  it('los escaneos con sesión no cuentan para la IP', async () => {
    const { app, usage } = setup();
    await fromIp(app, SCAN, scanBody, '203.0.113.7');
    const ipHash = usage.rows[0]?.ipHash ?? null;
    usage.rows.push(...rowsOf(40, { ipHash, createdAt: NOON }));

    const res = await request(app)
      .post(SCAN)
      .set('X-Forwarded-For', '203.0.113.7')
      .set(bearer(TOKEN_A))
      .send(scanBody);
    expect(res.status).toBe(200);
  });
});

describe('tope global de tokens', () => {
  it('al alcanzarlo responde 503 SERVICE_PAUSED a todos, sin llamar a la IA, con un warn', async () => {
    const logs = captureLogs();
    const rows = rowsOf(1, { promptTokens: 999_000, completionTokens: 1_000, createdAt: NOON });
    const { app, ai } = setup({ rows, logger: logs.logger });

    const scan = await post(app, SCAN, scanBody, TOKEN_A);
    const chat = await fromIp(app, CHAT, chatBody, '203.0.113.7');

    expectError(scan, 503, 'SERVICE_PAUSED');
    expect(scan.body.error.message).toContain('Servicio en pausa por hoy');
    expectError(chat, 503, 'SERVICE_PAUSED');
    expect(ai.classify).not.toHaveBeenCalled();
    expect(ai.chat).not.toHaveBeenCalled();
    expect(logs.entries().find((e) => e.msg === 'Tope global de tokens de IA')).toMatchObject({
      level: 'warn',
    });
  });

  it('al 70 % corta a los anónimos invitando a crear cuenta; con sesión sigue', async () => {
    const logs = captureLogs();
    const rows = rowsOf(1, { promptTokens: 700_000, completionTokens: 0, createdAt: NOON });
    const { app, ai } = setup({ rows, logger: logs.logger });

    const anon = await fromIp(app, SCAN, scanBody, '203.0.113.7');
    const anonChat = await fromIp(app, CHAT, chatBody, '203.0.113.7');
    expectError(anon, 429, 'QUOTA_EXCEEDED');
    expect(anon.body.error.message).toContain('Crea una cuenta gratis para seguir hoy');
    expectError(anonChat, 429, 'QUOTA_EXCEEDED');
    expect(ai.chat).not.toHaveBeenCalled();
    expect(
      logs.entries().find((e) => e.msg === 'Tope de tokens de IA para anónimos'),
    ).toMatchObject({ level: 'warn' });

    expect((await post(app, SCAN, scanBody, TOKEN_A)).status).toBe(200);
    expect(ai.classify).toHaveBeenCalledOnce();
  });

  it('por debajo del 70 % los anónimos siguen', async () => {
    const rows = rowsOf(1, { promptTokens: 699_999, completionTokens: 0, createdAt: NOON });
    const { app } = setup({ rows });
    expect((await fromIp(app, SCAN, scanBody, '203.0.113.7')).status).toBe(200);
  });

  it('los tokens de ayer no cuentan', async () => {
    const rows = rowsOf(1, {
      promptTokens: 2_000_000,
      completionTokens: 0,
      createdAt: new Date('2026-10-21T04:00:00Z'),
    });
    const { app } = setup({ rows });
    expect((await post(app, SCAN, scanBody, TOKEN_A)).status).toBe(200);
  });
});

describe('si Supabase falla', () => {
  it('no poder contar deja pasar con un warn', async () => {
    const logs = captureLogs();
    const { app, ai, usage } = setup({ logger: logs.logger });
    usage.countSince.mockRejectedValueOnce(new Error('No se pudo contar el uso de IA (503)'));

    expect((await post(app, SCAN, scanBody, TOKEN_A)).status).toBe(200);
    expect(ai.classify).toHaveBeenCalledOnce();
    expect(
      logs.entries().find((e) => e.msg === 'No se pudo contar la cuota de IA; se deja pasar'),
    ).toMatchObject({ level: 'warn' });
  });

  it('no poder sumar tokens también deja pasar', async () => {
    const { app, ai, usage } = setup();
    usage.tokensSince.mockRejectedValueOnce(new Error('caída'));
    expect((await post(app, SCAN, scanBody, TOKEN_A)).status).toBe(200);
    expect(ai.classify).toHaveBeenCalledOnce();
  });

  it('no poder registrar responde igual con un warn', async () => {
    const logs = captureLogs();
    const { app, usage } = setup({ logger: logs.logger });
    usage.record.mockRejectedValueOnce(new Error('No se pudo registrar el uso de IA (503)'));

    const res = await post(app, CHAT, chatBody, TOKEN_A);

    expect(res.status).toBe(200);
    expect(logs.entries().find((e) => e.msg === 'No se pudo registrar el uso de IA')).toMatchObject(
      { level: 'warn', endpoint: 'chat' },
    );
    expect(logs.lines.join('\n')).not.toContain('Pregunta privada');
  });
});

describe('registro en ai_usage', () => {
  it('con sesión guarda usuario, scan guardado, tokens y latencia, sin IP', async () => {
    const { app, usage } = setup();

    const res = await post(app, SCAN, scanBody, TOKEN_A);

    expect(res.status).toBe(200);
    expect(usage.rows).toHaveLength(1);
    expect(usage.rows[0]).toMatchObject({
      endpoint: 'classify',
      userId: USER_A,
      ipHash: null,
      scanId: res.body.scanId,
      promptTokens: 400,
      completionTokens: 90,
    });
    expect(usage.rows[0]?.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('sin sesión guarda el hash de la IP, nunca la IP ni la imagen', async () => {
    const { app, usage } = setup();

    await fromIp(app, SCAN, scanBody, '203.0.113.7');

    const row = usage.rows[0];
    expect(row).toMatchObject({ userId: null, scanId: null });
    expect(row?.ipHash).toMatch(/^[0-9a-f]{64}$/);
    const stored = JSON.stringify(usage.rows);
    expect(stored).not.toContain('203.0.113.7');
    expect(stored).not.toContain(scanBody.image);
  });

  it('el chat no guarda el texto ni el scanId que manda el cliente', async () => {
    const { app, usage } = setup();

    await post(app, CHAT, { ...chatBody, scanId: '11111111-1111-4111-8111-111111111111' }, TOKEN_A);

    expect(usage.rows[0]).toMatchObject({ endpoint: 'chat', userId: USER_A, scanId: null });
    expect(JSON.stringify(usage.rows)).not.toContain('Pregunta privada');
  });

  it('registra la llamada fallida con los tokens que se conocen', async () => {
    const { app, ai, usage } = setup();
    ai.classify.mockRejectedValueOnce(
      new AiCallError('AI_BAD_RESPONSE', 'No pudimos analizar la imagen', {
        promptTokens: 800,
        completionTokens: 180,
      }),
    );

    expectError(await post(app, SCAN, scanBody, TOKEN_A), 502, 'AI_BAD_RESPONSE');
    expect(usage.rows[0]).toMatchObject({ promptTokens: 800, completionTokens: 180, scanId: null });
  });

  it('un timeout sin tokens se registra con tokens en null', async () => {
    const { app, ai, usage } = setup();
    ai.classify.mockRejectedValueOnce(new AppError('AI_TIMEOUT', 'Tardó demasiado'));

    expectError(await post(app, SCAN, scanBody, TOKEN_A), 504, 'AI_TIMEOUT');
    expect(usage.rows[0]).toMatchObject({ promptTokens: null, completionTokens: null });
  });

  it('NOT_A_WASTE también cuenta: la IA respondió', async () => {
    const { app, ai, usage } = setup();
    ai.classify.mockResolvedValueOnce({
      data: { ...bottle, is_waste: false },
      usage: { promptTokens: 400, completionTokens: 30 },
      latencyMs: 1000,
    });

    expectError(await post(app, SCAN, scanBody, TOKEN_A), 422, 'NOT_A_WASTE');
    expect(usage.rows[0]).toMatchObject({ endpoint: 'classify', completionTokens: 30 });
  });

  it('una petición inválida no llama a la IA ni registra nada', async () => {
    const { app, usage } = setup();
    expectError(await post(app, SCAN, { mimeType: 'image/jpeg' }, TOKEN_A), 400, 'INVALID_IMAGE');
    expect(usage.rows).toHaveLength(0);
    expect(usage.countSince).not.toHaveBeenCalled();
  });
});
