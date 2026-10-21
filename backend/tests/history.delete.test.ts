import { readFileSync } from 'node:fs';
import { Writable } from 'node:stream';
import {
  deleteHistoryResponseSchema,
  errorBodySchema,
  favoritesListResponseSchema,
  type Favorite,
} from '@ecoclasifica/shared';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { IMAGE_DELETE_BATCH } from '../src/services/history.service';
import { createLogger } from '../src/utils/logger';
import { memoryChatMessagesRepo, savedThread } from './helpers/chatMessagesRepo';
import { fakeDisposalRepo } from './helpers/disposalRules';
import { memoryFavoritesRepo, storedIdea, type StoredFavorite } from './helpers/favoritesRepo';
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

type ScansRepoFake = ReturnType<typeof memoryScansRepo>;

function setup(scansRepo: ScansRepoFake, extra: Parameters<typeof createApp>[0] = {}) {
  const lines: Record<string, unknown>[] = [];
  const sink = new Writable({
    write(chunk, _enc, done) {
      lines.push(JSON.parse(String(chunk)) as Record<string, unknown>);
      done();
    },
  });
  const app = createApp({
    disposalRepo: fakeDisposalRepo(),
    aiProvider: { classify: vi.fn(), upcycle: vi.fn(), chat: vi.fn() },
    tokenVerifier: fakeVerifier,
    scansRepo,
    favoritesRepo: memoryFavoritesRepo(),
    logger: createLogger('info', sink),
    ...extra,
  });
  const warns = (msg: string) => lines.filter((l) => l.level === 'warn' && l.msg === msg);
  return { app, warns };
}

const deleteOne = (app: ReturnType<typeof createApp>, token: string, id: string) =>
  request(app).delete(`/api/v1/history/${id}`).set(bearer(token));

const deleteAll = (app: ReturnType<typeof createApp>, token: string) =>
  request(app).delete('/api/v1/history').set(bearer(token));

describe('DELETE /api/v1/history/:id', () => {
  it('borra la fila y su imagen y responde 204', async () => {
    const scan = storedScan(USER_A);
    const repo = memoryScansRepo([scan]);

    const res = await deleteOne(setup(repo).app, TOKEN_A, scan.id);

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(repo.rows).toHaveLength(0);
    expect(repo.images.size).toBe(0);
    // Primero la fila y después la imagen.
    expect(repo.deleteById.mock.invocationCallOrder[0]).toBeLessThan(
      repo.removeImages.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('no borra lo ajeno: el escaneo de otro usuario responde 404 y sigue intacto', async () => {
    const ofB = storedScan(USER_B);
    const repo = memoryScansRepo([ofB]);

    const res = await deleteOne(setup(repo).app, TOKEN_A, ofB.id);

    expect(res.status).toBe(404);
    expect(errorBodySchema.parse(res.body).error.code).toBe('NOT_FOUND');
    expect(repo.deleteById).toHaveBeenCalledWith(USER_A, ofB.id);
    expect(repo.rows).toEqual([ofB]);
    expect(repo.images.has(ofB.imagePath ?? '')).toBe(true);
    expect(repo.removeImages).not.toHaveBeenCalled();
  });

  it('un id mal formado responde 404 sin consultar', async () => {
    const repo = memoryScansRepo();
    const res = await deleteOne(setup(repo).app, TOKEN_A, 'no-es-un-uuid');
    expect(res.status).toBe(404);
    expect(repo.deleteById).not.toHaveBeenCalled();
  });

  it('pide sesión', async () => {
    const res = await request(setup(memoryScansRepo()).app).delete(
      `/api/v1/history/${storedScan(USER_A).id}`,
    );
    expect(res.status).toBe(401);
  });

  it('si falla borrar la imagen responde 204 y deja un warn solo con el id del escaneo', async () => {
    const scan = storedScan(USER_A);
    const repo = memoryScansRepo([scan]);
    repo.removeImages.mockRejectedValueOnce(new Error('Storage caído'));
    const { app, warns } = setup(repo);

    const res = await deleteOne(app, TOKEN_A, scan.id);

    expect(res.status).toBe(204);
    expect(repo.rows).toHaveLength(0);
    const [warn] = warns('Imagen de escaneo borrado pendiente de limpiar');
    expect(warn).toMatchObject({ scanId: scan.id });
    expect(JSON.stringify(warn)).not.toContain(USER_A);
    expect(JSON.stringify(warn)).not.toContain('Storage caído');
  });

  it('sin imagen no toca Storage', async () => {
    const scan = storedScan(USER_A, { imagePath: null });
    const repo = memoryScansRepo([scan]);
    expect((await deleteOne(setup(repo).app, TOKEN_A, scan.id)).status).toBe(204);
    expect(repo.removeImages).not.toHaveBeenCalled();
  });

  it('cascada: el favorito se conserva con ideaId null y los mensajes del chat se borran', async () => {
    const scan = storedScan(USER_A);
    const idea = storedIdea(USER_A);
    const copy: Favorite = {
      id: '3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
      ideaId: idea.ideaId,
      objectName: idea.objectName,
      difficulty: idea.difficulty,
      title: idea.title,
      description: idea.description,
      extraMaterials: idea.extraMaterials,
      createdAt: '2026-10-20T12:00:00.000Z',
    };
    const favorite: StoredFavorite = { ...copy, userId: USER_A };
    const favoritesRepo = memoryFavoritesRepo([idea], [favorite]);
    const chatMessagesRepo = memoryChatMessagesRepo([
      ...savedThread(USER_A, idea.ideaId, 4),
      ...savedThread(USER_B, 'idea-de-beto', 2),
    ]);
    // Lo que hace la base (0001_init.sql): scan_ideas y chat_messages en cascada, favorites → null.
    const ideasOfScan: Record<string, string[]> = { [scan.id]: [idea.ideaId] };
    const repo = memoryScansRepo([scan], (scanIds) => {
      const gone = new Set(scanIds.flatMap((id) => ideasOfScan[id] ?? []));
      for (const fav of favoritesRepo.rows)
        if (fav.ideaId && gone.has(fav.ideaId)) fav.ideaId = null;
      const kept = chatMessagesRepo.rows.filter((m) => !gone.has(m.ideaId));
      chatMessagesRepo.rows.splice(0, chatMessagesRepo.rows.length, ...kept);
    });
    const { app } = setup(repo, { favoritesRepo, chatMessagesRepo });

    expect((await deleteOne(app, TOKEN_A, scan.id)).status).toBe(204);

    const list = favoritesListResponseSchema.parse(
      (await request(app).get('/api/v1/favorites').set(bearer(TOKEN_A))).body,
    );
    expect(list.items).toEqual([{ ...copy, ideaId: null }]);
    expect(chatMessagesRepo.rows.every((m) => m.userId === USER_B)).toBe(true);
    // El servicio no borra favoritos por su cuenta.
    expect(favoritesRepo.remove).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/v1/history', () => {
  it('borra solo lo del usuario y responde cuántos escaneos borró', async () => {
    const ofA = [storedScan(USER_A), storedScan(USER_A, { imagePath: null })];
    const ofB = storedScan(USER_B);
    const repo = memoryScansRepo([...ofA, ofB]);

    const res = await deleteAll(setup(repo).app, TOKEN_A);

    expect(res.status).toBe(200);
    expect(deleteHistoryResponseSchema.parse(res.body)).toEqual({ deleted: 2 });
    expect(repo.deleteAll).toHaveBeenCalledWith(USER_A);
    // Solo la imagen del escaneo que la tenía, derivada de la fila borrada.
    expect(repo.removeImages).toHaveBeenCalledWith([ofA[0]!.imagePath]);
    expect(repo.rows).toEqual([ofB]);
    expect([...repo.images]).toEqual([ofB.imagePath]);
  });

  it('con el historial vacío responde { deleted: 0 }', async () => {
    const repo = memoryScansRepo();
    const res = await deleteAll(setup(repo).app, TOKEN_A);
    expect(res.body).toEqual({ deleted: 0 });
    expect(repo.removeImages).not.toHaveBeenCalled();
  });

  it(`borra las imágenes en lotes de ${IMAGE_DELETE_BATCH}`, async () => {
    const scans = Array.from({ length: 250 }, () => storedScan(USER_A));
    const repo = memoryScansRepo(scans);

    const res = await deleteAll(setup(repo).app, TOKEN_A);

    expect(res.body).toEqual({ deleted: 250 });
    expect(repo.removeImages.mock.calls.map(([paths]) => paths.length)).toEqual([100, 100, 50]);
    expect(repo.images.size).toBe(0);
  });

  it('un lote fallido no frena a los demás: 200 y warn con los ids de ese lote', async () => {
    const scans = Array.from({ length: 150 }, () => storedScan(USER_A));
    const repo = memoryScansRepo(scans);
    repo.removeImages.mockRejectedValueOnce(new Error('Storage caído'));
    const { app, warns } = setup(repo);

    const res = await deleteAll(app, TOKEN_A);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: 150 });
    expect(repo.removeImages).toHaveBeenCalledTimes(2);
    const [warn] = warns('Imágenes de escaneos borrados pendientes de limpiar');
    const failed = repo.removeImages.mock.calls[0]?.[0] ?? [];
    const idOf = new Map(scans.map((s) => [s.imagePath, s.id]));
    expect(warn?.scanIds).toEqual(failed.map((path) => idOf.get(path)));
    expect(JSON.stringify(warn)).not.toContain(USER_A);
    expect(JSON.stringify(warn)).not.toContain('Storage caído');
  });

  it('un escaneo guardado después de borrar las filas conserva su imagen', async () => {
    const repo = memoryScansRepo([storedScan(USER_A)]);
    const late = storedScan(USER_A);
    // Otra pestaña guarda justo cuando terminan de borrarse las filas.
    repo.deleteAll.mockImplementationOnce(async (userId) => {
      const gone = repo.rows.filter((r) => r.userId === userId);
      repo.rows.splice(0, repo.rows.length, late);
      repo.images.add(late.imagePath ?? '');
      return gone.map(({ id, imagePath }) => ({ id, imagePath }));
    });

    const res = await deleteAll(setup(repo).app, TOKEN_A);

    expect(res.body).toEqual({ deleted: 1 });
    expect([...repo.images]).toEqual([late.imagePath]);
  });

  it('pide sesión', async () => {
    const res = await request(setup(memoryScansRepo()).app).delete('/api/v1/history');
    expect(res.status).toBe(401);
  });

  it('B no pierde nada cuando A borra todo', async () => {
    const ofB = storedScan(USER_B);
    const repo = memoryScansRepo([ofB]);
    await deleteAll(setup(repo).app, TOKEN_A);
    expect(repo.rows).toEqual([ofB]);
    expect((await deleteAll(setup(repo).app, TOKEN_B)).body).toEqual({ deleted: 1 });
  });
});

describe('cascadas en el esquema (0001_init.sql)', () => {
  const sql = readFileSync(
    new URL('../../supabase/migrations/0001_init.sql', import.meta.url),
    'utf8',
  );
  const tableBody = (name: string) =>
    new RegExp(`create table[^(]*\\b${name}\\s*\\(([\\s\\S]*?)\\n\\);`, 'i').exec(sql)?.[1] ?? '';

  it('scan_ideas se borra con su escaneo', () => {
    expect(tableBody('scan_ideas')).toMatch(/references scans\(id\) on delete cascade/i);
  });
  it('chat_messages se borra con su idea', () => {
    expect(tableBody('chat_messages')).toMatch(/references scan_ideas\(id\) on delete cascade/i);
  });
  it('favorites conserva la copia: idea_id pasa a null', () => {
    expect(tableBody('favorites')).toMatch(
      /idea_id uuid references scan_ideas\(id\) on delete set null/i,
    );
  });
});
