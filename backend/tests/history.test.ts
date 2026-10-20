import {
  errorBodySchema,
  historyDetailSchema,
  historyListResponseSchema,
  type SavedScanResult,
} from '@ecoclasifica/shared';
import { Writable } from 'node:stream';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { summarize } from '../src/services/history.service';
import { createLogger } from '../src/utils/logger';
import { fakeDisposalRepo } from './helpers/disposalRules';
import { memoryFavoritesRepo } from './helpers/favoritesRepo';
import {
  bearer,
  fakeVerifier,
  memoryScansRepo,
  storedScan,
  TOKEN_A,
  TOKEN_B,
  USER_A,
  USER_B,
  type StoredScan,
} from './helpers/scansRepo';

const appWith = (scansRepo: ReturnType<typeof memoryScansRepo>) =>
  createApp({
    disposalRepo: fakeDisposalRepo(),
    aiProvider: { classify: vi.fn(), upcycle: vi.fn(), chat: vi.fn() },
    tokenVerifier: fakeVerifier,
    scansRepo,
    favoritesRepo: memoryFavoritesRepo(),
  });

/** `n` escaneos de un usuario, uno por minuto (el último es el más reciente). */
const scansOf = (userId: string, n: number) =>
  Array.from({ length: n }, (_, i) =>
    storedScan(userId, {
      createdAt: new Date(Date.UTC(2026, 9, 20, 12, i)).toISOString(),
      objectName: `Objeto ${i}`,
    }),
  );

const getList = (repo: ReturnType<typeof memoryScansRepo>, token: string, query = '') =>
  request(appWith(repo)).get(`/api/v1/history${query}`).set(bearer(token));

const getOne = (repo: ReturnType<typeof memoryScansRepo>, token: string, id: string) =>
  request(appWith(repo)).get(`/api/v1/history/${id}`).set(bearer(token));

describe('GET /api/v1/history', () => {
  it('pide sesión', async () => {
    const res = await request(appWith(memoryScansRepo())).get('/api/v1/history');
    expect(res.status).toBe(401);
    expect(errorBodySchema.parse(res.body).error.code).toBe('UNAUTHORIZED');
  });

  it('pagina de 20 en 20, más recientes primero', async () => {
    const repo = memoryScansRepo(scansOf(USER_A, 25));

    const first = await getList(repo, TOKEN_A);
    expect(first.status).toBe(200);
    const page1 = historyListResponseSchema.parse(first.body);
    expect(page1).toMatchObject({ page: 1, pageSize: 20, hasMore: true });
    expect(page1.items).toHaveLength(20);
    expect(page1.items[0]?.objectName).toBe('Objeto 24');

    const page2 = historyListResponseSchema.parse((await getList(repo, TOKEN_A, '?page=2')).body);
    expect(page2).toMatchObject({ page: 2, hasMore: false });
    expect(page2.items.map((i) => i.objectName)).toEqual([
      'Objeto 4',
      'Objeto 3',
      'Objeto 2',
      'Objeto 1',
      'Objeto 0',
    ]);
    // Pide 21 filas desde la posición correcta para saber si hay otra página.
    expect(repo.list).toHaveBeenLastCalledWith(USER_A, { offset: 20, limit: 21 });
  });

  it('con exactamente 20 no anuncia otra página', async () => {
    const res = await getList(memoryScansRepo(scansOf(USER_A, 20)), TOKEN_A);
    expect(historyListResponseSchema.parse(res.body)).toMatchObject({ hasMore: false });
  });

  it('una página fuera de rango responde vacía', async () => {
    const res = await getList(memoryScansRepo(scansOf(USER_A, 3)), TOKEN_A, '?page=7');
    expect(res.status).toBe(200);
    expect(historyListResponseSchema.parse(res.body)).toMatchObject({ items: [], hasMore: false });
  });

  it.each(['0', '1001', '1.5', 'dos'])('rechaza page=%s', async (page) => {
    const res = await getList(memoryScansRepo(), TOKEN_A, `?page=${page}`);
    expect(res.status).toBe(400);
    expect(errorBodySchema.parse(res.body).error.code).toBe('VALIDATION_ERROR');
  });

  it('el orden es estable con escaneos de la misma hora en páginas distintas', async () => {
    const sameTime = Array.from({ length: 21 }, () =>
      storedScan(USER_A, { createdAt: '2026-10-20T12:00:00+00:00' }),
    );
    const repo = memoryScansRepo(sameTime);

    const page1 = historyListResponseSchema.parse((await getList(repo, TOKEN_A)).body);
    const page2 = historyListResponseSchema.parse((await getList(repo, TOKEN_A, '?page=2')).body);

    const ids = [...page1.items, ...page2.items].map((i) => i.id);
    expect(page2.items).toHaveLength(1);
    expect(new Set(ids).size).toBe(21);
    expect(ids).toEqual(
      sameTime
        .map((s) => s.id)
        .sort()
        .reverse(),
    );
  });

  it('A no ve los escaneos de B', async () => {
    const repo = memoryScansRepo([...scansOf(USER_A, 2), ...scansOf(USER_B, 3)]);

    const resA = historyListResponseSchema.parse((await getList(repo, TOKEN_A)).body);
    const resB = historyListResponseSchema.parse((await getList(repo, TOKEN_B)).body);

    const idsOf = (userId: string) =>
      new Set(repo.rows.filter((r) => r.userId === userId).map((r) => r.id));
    expect(resA.items).toHaveLength(2);
    expect(resA.items.every((i) => idsOf(USER_A).has(i.id))).toBe(true);
    expect(resB.items).toHaveLength(3);
    expect(resB.items.every((i) => idsOf(USER_B).has(i.id))).toBe(true);
    expect(repo.list.mock.calls.map(([userId]) => userId)).toEqual([USER_A, USER_B]);
  });

  it('firma las miniaturas en lote', async () => {
    const repo = memoryScansRepo(scansOf(USER_A, 3));
    const page = historyListResponseSchema.parse((await getList(repo, TOKEN_A)).body);

    expect(repo.signImageUrls).toHaveBeenCalledTimes(1);
    expect(page.items[0]?.thumbnailUrl).toBe(
      `https://firmado.test/${USER_A}/${page.items[0]?.id}.jpg?token=t`,
    );
  });

  it('sin imagen o si falla la firma, la miniatura es null y la lista sigue', async () => {
    const repo = memoryScansRepo([
      storedScan(USER_A, { imagePath: null }),
      storedScan(USER_A, { createdAt: '2026-10-19T12:00:00+00:00' }),
    ]);
    const noImage = historyListResponseSchema.parse((await getList(repo, TOKEN_A)).body);
    expect(noImage.items.map((i) => i.thumbnailUrl === null)).toEqual([true, false]);
    expect(repo.signImageUrls).toHaveBeenLastCalledWith([repo.rows[1]?.imagePath]);

    repo.signImageUrls.mockRejectedValueOnce(new Error('Storage caído'));
    const res = await getList(repo, TOKEN_A);
    expect(res.status).toBe(200);
    const failed = historyListResponseSchema.parse(res.body);
    expect(failed.items.map((i) => i.thumbnailUrl)).toEqual([null, null]);
  });
});

describe('filas con resultado inválido', () => {
  // Corrupta entre dos válidas: 12:02 (válida), 12:01 (corrupta), 12:00 (válida).
  const [older, corrupt, newer] = scansOf(USER_A, 3);
  const rows = () => [older!, { ...corrupt!, corrupt: true }, newer!];

  it('GET /history la omite, registra un warn solo con su id y devuelve las demás', async () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk, _enc, done) {
        lines.push(String(chunk));
        done();
      },
    });
    const app = createApp({
      disposalRepo: fakeDisposalRepo(),
      aiProvider: { classify: vi.fn(), upcycle: vi.fn(), chat: vi.fn() },
      tokenVerifier: fakeVerifier,
      scansRepo: memoryScansRepo(rows()),
      favoritesRepo: memoryFavoritesRepo(),
      logger: createLogger('info', sink),
    });

    const res = await request(app).get('/api/v1/history').set(bearer(TOKEN_A));

    expect(res.status).toBe(200);
    const page = historyListResponseSchema.parse(res.body);
    expect(page.items.map((i) => i.id)).toEqual([newer!.id, older!.id]);
    const warn = lines
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .find((entry) => entry.msg === 'Escaneo con resultado inválido omitido del historial');
    expect(warn).toMatchObject({ level: 40, scanId: corrupt!.id });
    expect(Object.keys(warn ?? {})).not.toContain('objectName');
    expect(JSON.stringify(warn)).not.toContain(USER_A);
  });

  it('GET /history/:id de esa fila responde 500', async () => {
    const res = await getOne(memoryScansRepo(rows()), TOKEN_A, corrupt!.id);
    expect(res.status).toBe(500);
    expect(errorBodySchema.parse(res.body).error.code).toBe('INTERNAL_ERROR');
  });
});

describe('GET /api/v1/history/:id', () => {
  it('devuelve el detalle completo guardado, sin llamar a la IA', async () => {
    const scan = storedScan(USER_A);
    const res = await getOne(memoryScansRepo([scan]), TOKEN_A, scan.id);

    expect(res.status).toBe(200);
    expect(historyDetailSchema.parse(res.body)).toEqual({
      ...scan.saved,
      id: scan.id,
      createdAt: scan.createdAt,
      imageUrl: `https://firmado.test/${USER_A}/${scan.id}.jpg?token=t`,
    });
  });

  it('el escaneo de otro usuario responde 404, no 403', async () => {
    const ofB = storedScan(USER_B);
    const repo = memoryScansRepo([ofB]);

    const res = await getOne(repo, TOKEN_A, ofB.id);

    expect(res.status).toBe(404);
    expect(errorBodySchema.parse(res.body).error.code).toBe('NOT_FOUND');
    expect(repo.findById).toHaveBeenCalledWith(USER_A, ofB.id);
    expect(repo.signImageUrls).not.toHaveBeenCalled();
    // El dueño sí lo ve.
    expect((await getOne(repo, TOKEN_B, ofB.id)).status).toBe(200);
  });

  it('un id mal formado responde 404 sin consultar', async () => {
    const repo = memoryScansRepo();
    const res = await getOne(repo, TOKEN_A, 'no-es-un-uuid');
    expect(res.status).toBe(404);
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('pide sesión', async () => {
    const res = await request(appWith(memoryScansRepo())).get(
      `/api/v1/history/${storedScan(USER_A).id}`,
    );
    expect(res.status).toBe(401);
  });
});

describe('summarize', () => {
  const upcycle = (result: Extract<SavedScanResult, { mode: 'upcycle' }>['result']) =>
    ({ mode: 'upcycle', result }) as const;
  const idea = (ideaIndex: number) => ({
    ideaIndex,
    title: 't',
    description: 'd',
    extraMaterials: [],
  });

  it.each<[string, StoredScan['saved'], string]>([
    ['contenedor', storedScan(USER_A).saved, 'Contenedor blanco (aprovechables)'],
    [
      'certeza baja',
      {
        ...(storedScan(USER_A).saved as Extract<SavedScanResult, { mode: 'classify' }>),
        disposal: null,
      },
      'Revisa el material',
    ],
    [
      'ideas',
      upcycle({
        canUpcycle: true,
        objectName: 'Frasco',
        difficulty: 'Fácil',
        ideas: [idea(0), idea(1), idea(2)],
      }),
      '3 ideas',
    ],
    [
      'no reutilizable',
      upcycle({ canUpcycle: false, objectName: 'Pila', reason: 'r' }),
      'No reutilizable',
    ],
  ])('%s', (_name, saved, expected) => {
    expect(summarize(saved)).toBe(expected);
  });
});
