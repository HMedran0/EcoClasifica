import { randomUUID } from 'node:crypto';
import {
  errorBodySchema,
  favoriteSchema,
  favoritesListResponseSchema,
  historyDetailSchema,
  type SavedScanResult,
} from '@ecoclasifica/shared';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { fakeDisposalRepo } from './helpers/disposalRules';
import {
  memoryFavoritesRepo,
  snapshotOf,
  storedIdea,
  type StoredFavorite,
  type StoredIdea,
} from './helpers/favoritesRepo';
import {
  bearer,
  fakeVerifier,
  memoryScansRepo,
  storedScan,
  TOKEN_A,
  TOKEN_B,
  USER_A,
  USER_B,
} from './helpers/scansRepo';

const appWith = (
  favoritesRepo: ReturnType<typeof memoryFavoritesRepo>,
  scansRepo = memoryScansRepo(),
) =>
  createApp({
    disposalRepo: fakeDisposalRepo(),
    aiProvider: { classify: vi.fn(), upcycle: vi.fn(), chat: vi.fn() },
    tokenVerifier: fakeVerifier,
    scansRepo,
    favoritesRepo,
  });

const post = (repo: ReturnType<typeof memoryFavoritesRepo>, token: string, body: object) =>
  request(appWith(repo)).post('/api/v1/favorites').set(bearer(token)).send(body);

const favoriteOf = (userId: string, idea: StoredIdea, i = 0): StoredFavorite => ({
  ...snapshotOf(idea),
  id: randomUUID(),
  userId,
  createdAt: new Date(Date.UTC(2026, 9, 20, 12, i)).toISOString(),
});

const expectError = (res: request.Response, status: number, code: string) => {
  expect(res.status).toBe(status);
  expect(errorBodySchema.parse(res.body).error.code).toBe(code);
};

describe('POST /api/v1/favorites', () => {
  it('guarda la copia de la idea propia (201)', async () => {
    const idea = storedIdea(USER_A);
    const repo = memoryFavoritesRepo([idea]);

    const res = await post(repo, TOKEN_A, { ideaId: idea.ideaId });

    expect(res.status).toBe(201);
    expect(favoriteSchema.parse(res.body)).toMatchObject({
      ideaId: idea.ideaId,
      objectName: 'Frasco de vidrio',
      difficulty: 'Fácil',
      title: 'Portalápices',
      description: 'Lava el frasco y decóralo con cuerda.',
      extraMaterials: ['cuerda', 'pegante'],
    });
    expect(repo.findIdeaSnapshot).toHaveBeenCalledWith(USER_A, idea.ideaId);
    expect(repo.rows).toHaveLength(1);
  });

  it('arma la copia desde la base aunque el cliente envíe otros campos', async () => {
    const idea = storedIdea(USER_A);
    const repo = memoryFavoritesRepo([idea]);

    const res = await post(repo, TOKEN_A, {
      ideaId: idea.ideaId,
      title: 'Título inventado',
      description: '<script>alert(1)</script>',
      objectName: 'Otro objeto',
      difficulty: 'Difícil',
      extraMaterials: ['oro'],
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'Portalápices',
      description: 'Lava el frasco y decóralo con cuerda.',
      objectName: 'Frasco de vidrio',
      difficulty: 'Fácil',
      extraMaterials: ['cuerda', 'pegante'],
    });
    expect(repo.insert).toHaveBeenCalledWith(USER_A, {
      ideaId: idea.ideaId,
      objectName: 'Frasco de vidrio',
      difficulty: 'Fácil',
      title: 'Portalápices',
      description: 'Lava el frasco y decóralo con cuerda.',
      extraMaterials: ['cuerda', 'pegante'],
    });
  });

  it('es idempotente: si ya es favorita devuelve la existente (200)', async () => {
    const idea = storedIdea(USER_A);
    const repo = memoryFavoritesRepo([idea]);

    const first = await post(repo, TOKEN_A, { ideaId: idea.ideaId });
    const second = await post(repo, TOKEN_A, { ideaId: idea.ideaId });

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(repo.rows).toHaveLength(1);
  });

  it('si otra petición la guardó a la vez, devuelve esa (200)', async () => {
    const idea = storedIdea(USER_A);
    const repo = memoryFavoritesRepo([idea]);
    const raced = favoriteOf(USER_A, idea);
    // La primera lectura no la ve; la inserción choca con la unicidad.
    repo.findByIdea.mockResolvedValueOnce(null);
    repo.rows.push(raced);

    const res = await post(repo, TOKEN_A, { ideaId: idea.ideaId });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(raced.id);
    expect(repo.rows).toHaveLength(1);
  });

  it('la idea de otro usuario responde 404 y no guarda nada', async () => {
    const idea = storedIdea(USER_B);
    const repo = memoryFavoritesRepo([idea]);

    expectError(await post(repo, TOKEN_A, { ideaId: idea.ideaId }), 404, 'NOT_FOUND');
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('una idea inexistente responde 404', async () => {
    expectError(
      await post(memoryFavoritesRepo(), TOKEN_A, { ideaId: randomUUID() }),
      404,
      'NOT_FOUND',
    );
  });

  it.each([{}, { ideaId: 'no-es-uuid' }])('cuerpo inválido (%o) responde 400', async (body) => {
    expectError(await post(memoryFavoritesRepo(), TOKEN_A, body), 400, 'VALIDATION_ERROR');
  });

  it('sin cabecera responde 401 pidiendo iniciar sesión', async () => {
    const res = await request(appWith(memoryFavoritesRepo()))
      .post('/api/v1/favorites')
      .send({ ideaId: randomUUID() });
    expectError(res, 401, 'UNAUTHORIZED');
    expect(res.body.error.message).toBe('Inicia sesión para continuar');
  });

  it('con token inválido responde 401 de sesión no válida', async () => {
    const res = await post(memoryFavoritesRepo(), 'basura', { ideaId: randomUUID() });
    expectError(res, 401, 'UNAUTHORIZED');
    expect(res.body.error.message).toBe('Tu sesión no es válida o venció');
  });
});

describe('DELETE /api/v1/favorites/:id', () => {
  const del = (repo: ReturnType<typeof memoryFavoritesRepo>, token: string, id: string) =>
    request(appWith(repo)).delete(`/api/v1/favorites/${id}`).set(bearer(token));

  it('quita la propia (204)', async () => {
    const favorite = favoriteOf(USER_A, storedIdea(USER_A));
    const repo = memoryFavoritesRepo([], [favorite]);

    const res = await del(repo, TOKEN_A, favorite.id);

    expect(res.status).toBe(204);
    expect(repo.rows).toHaveLength(0);
    expect(repo.remove).toHaveBeenCalledWith(USER_A, favorite.id);
  });

  it('la de otro usuario responde 404 y sigue existiendo', async () => {
    const favorite = favoriteOf(USER_B, storedIdea(USER_B));
    const repo = memoryFavoritesRepo([], [favorite]);

    expectError(await del(repo, TOKEN_A, favorite.id), 404, 'NOT_FOUND');
    expect(repo.rows).toHaveLength(1);
  });

  it('un id mal formado responde 404 sin consultar', async () => {
    const repo = memoryFavoritesRepo();
    expectError(await del(repo, TOKEN_A, 'no-es-uuid'), 404, 'NOT_FOUND');
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it('sin sesión responde 401', async () => {
    const res = await request(appWith(memoryFavoritesRepo())).delete(
      `/api/v1/favorites/${randomUUID()}`,
    );
    expectError(res, 401, 'UNAUTHORIZED');
  });
});

describe('GET /api/v1/favorites', () => {
  const get = (repo: ReturnType<typeof memoryFavoritesRepo>, token: string, query = '') =>
    request(appWith(repo)).get(`/api/v1/favorites${query}`).set(bearer(token));

  it('pagina de 20, más recientes primero y solo las propias', async () => {
    const own = Array.from({ length: 21 }, (_, i) =>
      favoriteOf(USER_A, storedIdea(USER_A, { title: `Idea ${i}` }), i),
    );
    const repo = memoryFavoritesRepo([], [...own, favoriteOf(USER_B, storedIdea(USER_B))]);

    const page1 = favoritesListResponseSchema.parse((await get(repo, TOKEN_A)).body);
    expect(page1).toMatchObject({ page: 1, pageSize: 20, hasMore: true });
    expect(page1.items[0]?.title).toBe('Idea 20');

    const page2 = favoritesListResponseSchema.parse((await get(repo, TOKEN_A, '?page=2')).body);
    expect(page2).toMatchObject({ page: 2, hasMore: false });
    expect(page2.items.map((f) => f.title)).toEqual(['Idea 0']);
    expect(repo.list).toHaveBeenLastCalledWith(USER_A, { offset: 20, limit: 21 });
  });

  it('página inválida responde 400', async () => {
    const res = await get(memoryFavoritesRepo(), TOKEN_A, '?page=0');
    expectError(res, 400, 'VALIDATION_ERROR');
  });

  it('sin sesión responde 401', async () => {
    expectError(
      await request(appWith(memoryFavoritesRepo())).get('/api/v1/favorites'),
      401,
      'UNAUTHORIZED',
    );
  });
});

describe('GET /api/v1/history/:id con favoritos', () => {
  const ideaIds: [string, string, string] = [randomUUID(), randomUUID(), randomUUID()];
  const saved: SavedScanResult = {
    mode: 'upcycle',
    result: {
      canUpcycle: true,
      objectName: 'Frasco de vidrio',
      difficulty: 'Fácil',
      ideas: ideaIds.map((ideaId, ideaIndex) => ({
        ideaIndex,
        ideaId,
        title: `Idea ${ideaIndex}`,
        description: 'd',
        extraMaterials: [],
      })),
    },
  };

  it('cada idea trae su favoriteId o null, solo de las favoritas propias', async () => {
    const scan = storedScan(USER_A, { saved, objectName: 'Frasco de vidrio' });
    const mine = favoriteOf(USER_A, storedIdea(USER_A, { ideaId: ideaIds[1] }));
    // Un favorito ajeno de la misma idea no debe filtrarse al detalle.
    const theirs = favoriteOf(USER_B, storedIdea(USER_B, { ideaId: ideaIds[0] }));
    const favorites = memoryFavoritesRepo([], [mine, theirs]);

    const res = await request(appWith(favorites, memoryScansRepo([scan])))
      .get(`/api/v1/history/${scan.id}`)
      .set(bearer(TOKEN_A));

    expect(res.status).toBe(200);
    const detail = historyDetailSchema.parse(res.body);
    if (detail.mode !== 'upcycle' || !detail.result.canUpcycle) throw new Error('modo inesperado');
    expect(detail.result.ideas.map((i) => i.favoriteId)).toEqual([null, mine.id, null]);
    expect(favorites.idsByIdeas).toHaveBeenCalledWith(USER_A, ideaIds);
  });

  it('un escaneo de clasificar no consulta favoritos', async () => {
    const scan = storedScan(USER_A);
    const favorites = memoryFavoritesRepo();

    const res = await request(appWith(favorites, memoryScansRepo([scan])))
      .get(`/api/v1/history/${scan.id}`)
      .set(bearer(TOKEN_A));

    expect(res.status).toBe(200);
    expect(favorites.idsByIdeas).not.toHaveBeenCalled();
  });

  it('otro usuario no ve el escaneo (404)', async () => {
    const scan = storedScan(USER_A, { saved });
    const res = await request(appWith(memoryFavoritesRepo(), memoryScansRepo([scan])))
      .get(`/api/v1/history/${scan.id}`)
      .set(bearer(TOKEN_B));
    expectError(res, 404, 'NOT_FOUND');
  });
});
