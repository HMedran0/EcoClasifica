import { Writable } from 'node:stream';
import { errorBodySchema } from '@ecoclasifica/shared';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import type { AccountsRepo } from '../src/repositories/accounts.repo';
import { SupabaseOpError } from '../src/repositories/supabase';
import { createLogger } from '../src/utils/logger';
import { fakeDisposalRepo } from './helpers/disposalRules';
import {
  bearer,
  fakeVerifier,
  memoryScansRepo,
  storedScan,
  TOKEN_A,
  USER_A,
  USER_B,
} from './helpers/scansRepo';

// HU-22: DELETE /api/v1/me borra las fotos del usuario y después su usuario de Auth.

type ScansRepoFake = ReturnType<typeof memoryScansRepo>;

function setup(scansRepo: ScansRepoFake = memoryScansRepo()) {
  const lines: Record<string, unknown>[] = [];
  const sink = new Writable({
    write(chunk, _enc, done) {
      lines.push(JSON.parse(String(chunk)) as Record<string, unknown>);
      done();
    },
  });
  const users = new Set([USER_A, USER_B]);
  const deleteUser = vi.fn<AccountsRepo['deleteUser']>(async (userId) => {
    users.delete(userId);
  });
  // `users` es el estado de Auth simulado que las pruebas inspeccionan.
  const accounts = { users, deleteUser };
  const app = createApp({
    disposalRepo: fakeDisposalRepo(),
    aiProvider: { classify: vi.fn(), upcycle: vi.fn(), chat: vi.fn() },
    tokenVerifier: fakeVerifier,
    scansRepo,
    accountsRepo: accounts,
    logger: createLogger('info', sink),
  });
  return { app, accounts, lines };
}

const deleteMe = (app: ReturnType<typeof createApp>) =>
  request(app).delete('/api/v1/me').set(bearer(TOKEN_A));

/** `n` imágenes en la carpeta del usuario (sin filas: también cuentan las huérfanas). */
function addImages(repo: ScansRepoFake, userId: string, n: number) {
  for (let i = 0; i < n; i++) repo.images.add(`${userId}/foto-${String(i).padStart(3, '0')}.jpg`);
}

function expectDeleteFailed(res: request.Response) {
  expect(res.status).toBe(503);
  const body = errorBodySchema.parse(res.body);
  expect(body.error.code).toBe('ACCOUNT_DELETE_FAILED');
  expect(body.error.message).toBe('No pudimos eliminar tu cuenta. Intenta de nuevo.');
}

describe('DELETE /api/v1/me', () => {
  it('sin sesión responde 401 y no borra nada', async () => {
    const { app, accounts } = setup();

    const res = await request(app).delete('/api/v1/me');

    expect(res.status).toBe(401);
    expect(accounts.deleteUser).not.toHaveBeenCalled();
  });

  it('borra las fotos y después el usuario, y responde 204', async () => {
    const repo = memoryScansRepo([storedScan(USER_A), storedScan(USER_A)]);
    const { app, accounts } = setup(repo);

    const res = await deleteMe(app);

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(repo.images.size).toBe(0);
    expect(accounts.deleteUser).toHaveBeenCalledExactlyOnceWith(USER_A);
    // Orden: imágenes → Auth.
    expect(repo.removeImages.mock.invocationCallOrder[0]).toBeLessThan(
      accounts.deleteUser.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('solo borra lo propio: las fotos y la cuenta de otro usuario siguen intactas', async () => {
    const repo = memoryScansRepo([storedScan(USER_A), storedScan(USER_B)]);
    addImages(repo, USER_B, 3);
    const { app, accounts } = setup(repo);

    expect((await deleteMe(app)).status).toBe(204);

    expect(repo.images.size).toBe(4);
    expect([...repo.images].every((path) => path.startsWith(`${USER_B}/`))).toBe(true);
    expect(repo.listImagePaths).not.toHaveBeenCalledWith(USER_B);
    expect(accounts.users).toEqual(new Set([USER_B]));
  });

  it('borra en lotes de 100: 250 imágenes son 3 llamadas a Storage', async () => {
    const repo = memoryScansRepo();
    addImages(repo, USER_A, 250);
    const { app, accounts } = setup(repo);

    expect((await deleteMe(app)).status).toBe(204);

    expect(repo.removeImages.mock.calls.map(([paths]) => paths.length)).toEqual([100, 100, 50]);
    expect(repo.images.size).toBe(0);
    expect(accounts.deleteUser).toHaveBeenCalledOnce();
  });

  it('sin fotos borra solo el usuario', async () => {
    const repo = memoryScansRepo();
    const { app, accounts } = setup(repo);

    expect((await deleteMe(app)).status).toBe(204);
    expect(repo.removeImages).not.toHaveBeenCalled();
    expect(accounts.deleteUser).toHaveBeenCalledOnce();
  });

  it('si Storage falla, no sigue borrando ni borra el usuario', async () => {
    const repo = memoryScansRepo();
    addImages(repo, USER_A, 150);
    repo.removeImages.mockRejectedValueOnce(new Error('Storage caído'));
    const { app, accounts } = setup(repo);

    expectDeleteFailed(await deleteMe(app));
    expect(repo.removeImages).toHaveBeenCalledOnce();
    expect(accounts.deleteUser).not.toHaveBeenCalled();
  });

  it('si listar falla, no borra nada', async () => {
    const repo = memoryScansRepo([storedScan(USER_A)]);
    repo.listImagePaths.mockRejectedValueOnce(new Error('Storage caído'));
    const { app, accounts } = setup(repo);

    expectDeleteFailed(await deleteMe(app));
    expect(repo.removeImages).not.toHaveBeenCalled();
    expect(accounts.deleteUser).not.toHaveBeenCalled();
  });

  it('si al volver a listar quedan imágenes, avisa solo con el conteo y no borra la cuenta', async () => {
    const repo = memoryScansRepo();
    addImages(repo, USER_A, 2);
    // Storage dice que borró, pero una imagen sigue ahí.
    repo.removeImages.mockImplementationOnce(async (paths) => {
      repo.images.delete(paths[0] ?? '');
    });
    const { app, accounts, lines } = setup(repo);

    expectDeleteFailed(await deleteMe(app));
    expect(accounts.deleteUser).not.toHaveBeenCalled();
    const warn = lines.find((l) => l.msg === 'Quedaron imágenes; la cuenta no se borró');
    expect(warn).toMatchObject({ level: 'warn', remainingImages: 1 });
    // Sin datos personales: ni el id ni las rutas del usuario.
    expect(JSON.stringify(warn)).not.toContain(USER_A);
  });

  it('si Auth falla tras borrar las fotos, el reintento termina el borrado', async () => {
    const repo = memoryScansRepo([storedScan(USER_A)]);
    const { app, accounts } = setup(repo);
    accounts.deleteUser.mockRejectedValueOnce(new Error('Auth caído'));

    expectDeleteFailed(await deleteMe(app));
    expect(accounts.users.has(USER_A)).toBe(true);

    expect((await deleteMe(app)).status).toBe(204);
    expect(accounts.users.has(USER_A)).toBe(false);
  });

  it('los errores se registran solo con el código de Supabase, sin el uuid ni rutas', async () => {
    const repo = memoryScansRepo();
    addImages(repo, USER_A, 1);
    repo.removeImages.mockRejectedValueOnce(new SupabaseOpError('Storage', '503'));
    const first = setup(repo);

    expectDeleteFailed(await deleteMe(first.app));
    const storageLog = first.lines.find(
      (l) => l.msg === 'No se pudieron borrar las imágenes de la cuenta',
    );
    expect(storageLog).toMatchObject({ level: 'error', code: '503' });

    // Un error inesperado con el uuid en el mensaje tampoco llega al log.
    const second = setup(memoryScansRepo());
    second.accounts.deleteUser.mockRejectedValueOnce(new Error(`User ${USER_A} not found`));

    expectDeleteFailed(await deleteMe(second.app));
    const authLog = second.lines.find((l) => l.msg === 'No se pudo borrar el usuario de Auth');
    expect(authLog).toMatchObject({ level: 'error', code: 'desconocido' });

    for (const line of [...first.lines, ...second.lines]) {
      expect(JSON.stringify(line)).not.toContain(USER_A);
    }
  });
});
