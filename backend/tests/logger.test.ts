import { Writable } from 'node:stream';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { createLogger, httpLogLevel } from '../src/utils/logger';
import { fakeDisposalRepo } from './helpers/disposalRules';
import { memoryFavoritesRepo } from './helpers/favoritesRepo';
import { bearer, fakeVerifier, memoryScansRepo, TOKEN_A } from './helpers/scansRepo';

type LogLine = Record<string, unknown>;

function setup() {
  const lines: LogLine[] = [];
  const sink = new Writable({
    write(chunk, _enc, done) {
      lines.push(JSON.parse(String(chunk)) as LogLine);
      done();
    },
  });
  const scansRepo = memoryScansRepo();
  const app = createApp({
    disposalRepo: fakeDisposalRepo(),
    aiProvider: { classify: vi.fn(), upcycle: vi.fn(), chat: vi.fn() },
    tokenVerifier: fakeVerifier,
    scansRepo,
    favoritesRepo: memoryFavoritesRepo(),
    logger: createLogger('info', sink),
  });
  // pino-http: «request completed», o «request errored» si hubo error o el código es 5xx.
  const completed = () =>
    lines.filter((l) => l.msg === 'request completed' || l.msg === 'request errored');
  return { app, lines, scansRepo, completed };
}

describe('httpLogLevel', () => {
  it.each([
    [200, 'info'],
    [302, 'info'],
    [401, 'warn'],
    [404, 'warn'],
    [500, 'error'],
    [503, 'error'],
  ])('%i → %s', (statusCode, level) => {
    expect(httpLogLevel({}, { statusCode })).toBe(level);
  });

  it('con error es error aunque el código sea < 500', () => {
    expect(httpLogLevel({}, { statusCode: 200 }, new Error('x'))).toBe('error');
  });
});

describe('niveles de log como texto (Railway @level:error)', () => {
  it('200 → info y 404 → warn en la línea de pino-http', async () => {
    const { app, completed } = setup();
    await request(app).get('/api/health');
    await request(app).get('/api/v1/no-existe');
    await vi.waitFor(() => expect(completed()).toHaveLength(2));
    expect(completed().map((l) => l.level)).toEqual(['info', 'warn']);
  });

  it('un error no controlado sale con nivel error, igual que su 500', async () => {
    const { app, lines, scansRepo, completed } = setup();
    scansRepo.list.mockRejectedValueOnce(new Error('Postgres caído'));

    const res = await request(app)
      .get('/api/v1/history')
      .set({ ...bearer(TOKEN_A), Cookie: 'sb-access=cookie-secreta' });

    expect(res.status).toBe(500);
    await vi.waitFor(() => expect(completed()).toHaveLength(1));
    const unhandled = lines.find((l) => l.msg === 'Error no controlado');
    expect(unhandled).toMatchObject({ level: 'error', requestId: res.body.error.requestId });
    expect(completed()[0]).toMatchObject({ level: 'error' });
    expect(JSON.stringify(unhandled)).not.toContain(TOKEN_A);
    expect(JSON.stringify(unhandled)).not.toContain('cookie-secreta');
  });
});
