import { z } from 'zod';
import { getSupabase } from './supabase';

const profileRowSchema = z
  .object({ display_name: z.string().nullable(), privacy_version: z.string().nullable() })
  .transform((row) => ({ displayName: row.display_name, privacyVersion: row.privacy_version }));

const consentRowSchema = z.object({
  privacy_version: z.string(),
  privacy_accepted_at: z.string(),
});

export type Profile = z.output<typeof profileRowSchema>;

/** Datos de usuario: el service role salta RLS, así que toda consulta filtra por `userId`. */
export interface ProfilesRepo {
  findById(userId: string): Promise<Profile | null>;
  /**
   * HU-21: guarda la autorización y devuelve su fecha. Si ya había autorizado esa versión, conserva
   * la primera fecha. `null` si el usuario no tiene perfil.
   */
  saveConsent(userId: string, version: string, acceptedAt: Date): Promise<Date | null>;
}

export function createSupabaseProfilesRepo(): ProfilesRepo {
  return {
    async findById(userId) {
      const { data, error } = await getSupabase()
        .from('profiles')
        .select('display_name, privacy_version')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw new Error(`No se pudo leer el perfil: ${error.message}`);
      return data ? profileRowSchema.parse(data) : null;
    },

    async saveConsent(userId, version, acceptedAt) {
      // Solo actualiza si la versión guardada es otra (o ninguna): la primera fecha se conserva.
      const { data, error } = await getSupabase()
        .from('profiles')
        .update({ privacy_version: version, privacy_accepted_at: acceptedAt.toISOString() })
        .eq('id', userId)
        .or(`privacy_version.is.null,privacy_version.neq.${version}`)
        .select('privacy_accepted_at');
      if (error) throw new Error(`No se pudo guardar la autorización: ${error.message}`);
      if (data.length > 0) return acceptedAt;

      const { data: row, error: readError } = await getSupabase()
        .from('profiles')
        .select('privacy_version, privacy_accepted_at')
        .eq('id', userId)
        .maybeSingle();
      if (readError) throw new Error(`No se pudo leer la autorización: ${readError.message}`);
      const stored = consentRowSchema.safeParse(row);
      return stored.success && stored.data.privacy_version === version
        ? new Date(stored.data.privacy_accepted_at)
        : null;
    },
  };
}
