import { z } from 'zod';
import { getSupabase } from './supabase';

const profileRowSchema = z
  .object({ display_name: z.string().nullable() })
  .transform((row) => ({ displayName: row.display_name }));

export type Profile = z.output<typeof profileRowSchema>;

/** Datos de usuario: el service role salta RLS, así que toda consulta filtra por `userId`. */
export interface ProfilesRepo {
  findById(userId: string): Promise<Profile | null>;
}

export function createSupabaseProfilesRepo(): ProfilesRepo {
  return {
    async findById(userId) {
      const { data, error } = await getSupabase()
        .from('profiles')
        .select('display_name')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw new Error(`No se pudo leer el perfil: ${error.message}`);
      return data ? profileRowSchema.parse(data) : null;
    },
  };
}
