import { Writable } from 'node:stream';
import { errorBodySchema } from '@ecoclasifica/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { createApp } from '../src/app';
import { createSupabaseChatMessagesRepo } from '../src/repositories/chatMessages.repo';
import { createSupabaseFavoritesRepo } from '../src/repositories/favorites.repo';
import { createLogger } from '../src/utils/logger';
import { fakeDisposalRepo } from './helpers/disposalRules';
import { bearer, fakeVerifier, TOKEN_A, USER_A } from './helpers/scansRepo';

// Filas corruptas → 500 (no 400) y errores de Postgres sin su mensaje (puede citar la fila).

type Result = { data: unknown; error: { code: string; message: string } | null };

/** Cliente de Supabase simulado: cualquier consulta encadenada resuelve con `result`. */
function fakeSupabase(result: Result): () => SupabaseClient {
  const builder: Record<string, unknown> = {
    then: (resolve: (r: Result) => void) => resolve(result),
  };
  const chain = ['select', 'insert', 'delete', 'eq', 'in', 'order', 'range', 'limit'];
  for (const method of [...chain, 'maybeSingle', 'single']) builder[method] = () => builder;
  const client = { from: () => builder } as unknown as SupabaseClient;
  return () => client;
}

const IDEA_ID = '1f8d4c2b-3a5e-4d7f-8b9c-2e3f4a5b6c70';
const SECRET = 'texto privado del usuario';
const pgError = {
  code: '23514',
  message: `Failing row contains (${SECRET})`,
};

/** Error genérico (no `ZodError`) cuyo mensaje no cita la fila. */
async function expectInternal(promise: Promise<unknown>) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(Error);
  expect(err).not.toBeInstanceOf(ZodError);
  expect((err as Error).message).not.toContain(SECRET);
}

describe('favorites.repo', () => {
  const corrupt = { data: [{ id: 'no-uuid', title: SECRET }], error: null };
  const corruptOne = { data: { id: 'no-uuid', title: SECRET }, error: null };

  it('una fila corrupta lanza un error interno en cada lectura', async () => {
    const list = createSupabaseFavoritesRepo(fakeSupabase(corrupt));
    const one = createSupabaseFavoritesRepo(fakeSupabase(corruptOne));
    await expectInternal(list.list(USER_A, { offset: 0, limit: 21 }));
    await expectInternal(list.idsByIdeas(USER_A, [IDEA_ID]));
    await expectInternal(one.findByIdea(USER_A, IDEA_ID));
    await expectInternal(one.findIdeaSnapshot(USER_A, IDEA_ID));
  });

  it('un error de Postgres lleva solo su código', async () => {
    const repo = createSupabaseFavoritesRepo(fakeSupabase({ data: null, error: pgError }));
    const err = await repo.list(USER_A, { offset: 0, limit: 21 }).catch((e: unknown) => e);
    expect((err as Error).message).toBe('No se pudieron leer los favoritos (23514)');
    await expectInternal(repo.remove(USER_A, IDEA_ID));
    await expectInternal(repo.findIdeaSnapshot(USER_A, IDEA_ID));
  });

  it('GET /favorites con una fila corrupta responde 500 INTERNAL_ERROR sin datos de la fila', async () => {
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
      favoritesRepo: createSupabaseFavoritesRepo(fakeSupabase(corrupt)),
      logger: createLogger('info', sink),
    });

    const res = await request(app).get('/api/v1/favorites').set(bearer(TOKEN_A));

    expect(res.status).toBe(500);
    expect(errorBodySchema.parse(res.body).error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
    expect(lines.join('\n')).not.toContain(SECRET);
  });
});

describe('chatMessages.repo', () => {
  it('una fila corrupta lanza un error interno', async () => {
    const repo = createSupabaseChatMessagesRepo(
      fakeSupabase({ data: [{ role: 'system', content: SECRET }], error: null }),
    );
    await expectInternal(repo.listRecent(USER_A, IDEA_ID, 9));
  });

  it('los errores de Postgres llevan solo su código', async () => {
    const repo = createSupabaseChatMessagesRepo(fakeSupabase({ data: null, error: pgError }));
    await expectInternal(repo.listRecent(USER_A, IDEA_ID, 9));
    await expectInternal(repo.insertExchange(USER_A, IDEA_ID, { question: SECRET, reply: 'r' }));
    const err = await repo
      .insertExchange(USER_A, IDEA_ID, { question: SECRET, reply: 'r' })
      .catch((e: unknown) => e);
    expect((err as Error).message).toBe('No se pudo guardar el chat (23514)');
  });
});
