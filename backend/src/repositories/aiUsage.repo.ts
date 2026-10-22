import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getSupabase } from './supabase';

export type AiEndpoint = 'classify' | 'upcycle' | 'chat';

/** Una llamada a la IA (HU-20). Nunca la imagen ni el texto del usuario. */
export interface AiUsageRow {
  endpoint: AiEndpoint;
  userId: string | null;
  /** Solo sin sesión: HMAC de la IP, nunca la IP. */
  ipHash: string | null;
  scanId: string | null;
  /** `null` si la llamada falló sin informar tokens (p. ej. timeout). */
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number;
}

/** A quién se le cuenta la cuota: el usuario con sesión o la IP (con hash) sin sesión. */
export type UsageSubject = { userId: string } | { ipHash: string };

/** Solo lo usa el backend (sin políticas RLS). */
export interface AiUsageRepo {
  record(row: AiUsageRow): Promise<void>;
  /** Llamadas del sujeto a esos endpoints desde `since`. */
  countSince(subject: UsageSubject, endpoints: AiEndpoint[], since: Date): Promise<number>;
  /** Tokens de todo el servicio desde `since`. */
  tokensSince(since: Date): Promise<number>;
}

const tokensSchema = z.coerce.number().int().nonnegative();

export function createSupabaseAiUsageRepo(client: () => SupabaseClient = getSupabase): AiUsageRepo {
  const usage = () => client().from('ai_usage');

  return {
    async record(row) {
      const { error } = await usage().insert({
        endpoint: row.endpoint,
        user_id: row.userId,
        ip_hash: row.ipHash,
        scan_id: row.scanId,
        prompt_tokens: row.promptTokens,
        completion_tokens: row.completionTokens,
        latency_ms: row.latencyMs,
      });
      if (error) throw new Error(`No se pudo registrar el uso de IA (${error.code})`);
    },

    async countSince(subject, endpoints, since) {
      const base = usage()
        .select('id', { count: 'exact', head: true })
        .in('endpoint', endpoints)
        .gte('created_at', since.toISOString());
      const { count, error } = await ('userId' in subject
        ? base.eq('user_id', subject.userId)
        : base.eq('ip_hash', subject.ipHash));
      if (error) throw new Error(`No se pudo contar el uso de IA (${error.code})`);
      return count ?? 0;
    },

    async tokensSince(since) {
      const { data, error } = await client().rpc('ai_tokens_since', {
        since: since.toISOString(),
      });
      if (error) throw new Error(`No se pudo sumar los tokens de IA (${error.code})`);
      const total = tokensSchema.safeParse(data ?? 0);
      if (!total.success) throw new Error('Suma de tokens de ai_usage con forma inválida');
      return total.data;
    },
  };
}
