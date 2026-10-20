import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { getSupabase } from '../repositories/supabase';

export interface AuthUser {
  id: string;
  email: string | null;
}

/** Valida un access token de Supabase; `null` si es inválido, vencido o no es de un usuario. */
export interface TokenVerifier {
  verify(token: string): Promise<AuthUser | null>;
}

/**
 * `getClaims` verifica en local con el JWKS (en caché) si el proyecto firma con claves asimétricas,
 * y recurre a `getUser()` (una llamada a Supabase Auth) si usa el secreto HS256. Rechaza `exp` vencido.
 */
export function createSupabaseTokenVerifier(): TokenVerifier {
  return {
    async verify(token) {
      const { data, error } = await getSupabase().auth.getClaims(token);
      // Caída de red o 5xx de Auth (vía `getUser` con HS256): fallo del servicio (500), no token inválido.
      if (isAuthRetryableFetchError(error) || (error?.status ?? 0) >= 500) throw error;
      if (error || !data) return null;
      const { sub, email } = data.claims;
      if (typeof sub !== 'string' || !sub) return null;
      return { id: sub, email: typeof email === 'string' && email ? email : null };
    },
  };
}
