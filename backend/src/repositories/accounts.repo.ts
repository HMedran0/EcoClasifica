import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase, SupabaseOpError, supabaseErrorCode } from './supabase';

/** Usuarios de Supabase Auth (HU-22). Requiere la service role key. */
export interface AccountsRepo {
  /**
   * Borra el usuario de Auth. La base borra en cascada `profiles`, `scans`, `scan_ideas`,
   * `favorites` y `chat_messages`; `ai_usage.user_id` pasa a `null` (registro anónimo).
   */
  deleteUser(userId: string): Promise<void>;
}

export function createSupabaseAccountsRepo(
  client: () => SupabaseClient = getSupabase,
): AccountsRepo {
  return {
    async deleteUser(userId) {
      const { error } = await client().auth.admin.deleteUser(userId);
      if (error)
        throw new SupabaseOpError('No se pudo borrar el usuario', supabaseErrorCode(error));
    },
  };
}
