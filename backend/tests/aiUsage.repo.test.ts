import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { createSupabaseAiUsageRepo } from '../src/repositories/aiUsage.repo';
import { USER_A } from './helpers/scansRepo';

// HU-20: consultas de `ai_usage` (el service role salta RLS: cada conteo filtra por sujeto).

type Result = { data?: unknown; count?: number | null; error: { code: string } | null };

/** Cliente simulado que anota cada método encadenado con sus argumentos. */
function fakeSupabase(result: Result) {
  const calls: [string, unknown[]][] = [];
  const builder: Record<string, unknown> = {
    then: (resolve: (r: Result) => void) => resolve(result),
  };
  for (const method of ['select', 'insert', 'eq', 'in', 'gte']) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, args]);
      return builder;
    };
  }
  const client = {
    from: (table: string) => {
      calls.push(['from', [table]]);
      return builder;
    },
    rpc: (fn: string, args: unknown) => {
      calls.push(['rpc', [fn, args]]);
      return Promise.resolve(result);
    },
  } as unknown as SupabaseClient;
  return { client: () => client, calls };
}

const SINCE = new Date('2026-10-21T05:00:00Z');
const IP_HASH = 'a'.repeat(64);

describe('aiUsage.repo', () => {
  it('cuenta por usuario, endpoints y desde la medianoche', async () => {
    const { client, calls } = fakeSupabase({ count: 7, error: null });
    const repo = createSupabaseAiUsageRepo(client);

    await expect(repo.countSince({ userId: USER_A }, ['classify', 'upcycle'], SINCE)).resolves.toBe(
      7,
    );
    expect(calls).toContainEqual(['eq', ['user_id', USER_A]]);
    expect(calls).toContainEqual(['in', ['endpoint', ['classify', 'upcycle']]]);
    expect(calls).toContainEqual(['gte', ['created_at', SINCE.toISOString()]]);
  });

  it('sin sesión cuenta por el hash de la IP', async () => {
    const { client, calls } = fakeSupabase({ count: null, error: null });
    await expect(
      createSupabaseAiUsageRepo(client).countSince({ ipHash: IP_HASH }, ['chat'], SINCE),
    ).resolves.toBe(0);
    expect(calls).toContainEqual(['eq', ['ip_hash', IP_HASH]]);
    expect(calls.some(([m, args]) => m === 'eq' && args[0] === 'user_id')).toBe(false);
  });

  it('suma tokens con la función ai_tokens_since (bigint puede llegar como texto)', async () => {
    const { client, calls } = fakeSupabase({ data: '123456', error: null });
    await expect(createSupabaseAiUsageRepo(client).tokensSince(SINCE)).resolves.toBe(123456);
    expect(calls).toContainEqual(['rpc', ['ai_tokens_since', { since: SINCE.toISOString() }]]);
  });

  it('una suma con forma inválida es un error interno', async () => {
    const { client } = fakeSupabase({ data: 'no-numero', error: null });
    await expect(createSupabaseAiUsageRepo(client).tokensSince(SINCE)).rejects.toThrow(
      'forma inválida',
    );
  });

  it('los errores de Postgres llevan solo su código', async () => {
    const { client } = fakeSupabase({ error: { code: '57P01' } });
    const repo = createSupabaseAiUsageRepo(client);
    const row = {
      endpoint: 'chat' as const,
      userId: USER_A,
      ipHash: null,
      scanId: null,
      promptTokens: 1,
      completionTokens: 1,
      latencyMs: 1,
    };
    await expect(repo.record(row)).rejects.toThrow('(57P01)');
    await expect(repo.countSince({ userId: USER_A }, ['chat'], SINCE)).rejects.toThrow('(57P01)');
    await expect(repo.tokensSince(SINCE)).rejects.toThrow('(57P01)');
  });
});
