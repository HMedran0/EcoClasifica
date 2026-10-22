import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireEnv } from '../config/env';

let client: SupabaseClient | undefined;

/**
 * Cliente con la service role key (salta RLS): las consultas de tablas de usuario
 * deben filtrar siempre por `userId`. Se crea al primer uso para que health y pruebas
 * no exijan las variables de Supabase.
 */
export function getSupabase(): SupabaseClient {
  client ??= createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/**
 * Fallo de Supabase sin su mensaje, que puede citar rutas de Storage o el uuid del usuario: solo
 * el código o el status HTTP, que es seguro registrar.
 */
export class SupabaseOpError extends Error {
  constructor(
    operation: string,
    readonly code: string,
  ) {
    super(`${operation} (${code})`);
    this.name = 'SupabaseOpError';
  }
}

/** `code` (Auth, Postgres) o `statusCode`/`status` (Storage, Auth); si no hay, `desconocido`. */
export function supabaseErrorCode(error: unknown): string {
  if (typeof error !== 'object' || error === null) return 'desconocido';
  const { code, statusCode, status } = error as Record<string, unknown>;
  for (const value of [code, statusCode, status]) {
    if ((typeof value === 'string' && value) || typeof value === 'number') return String(value);
  }
  return 'desconocido';
}
