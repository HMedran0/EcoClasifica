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
