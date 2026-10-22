import { supabase } from '../../lib/supabase';
import { useAuthStore } from './authStore';
import { returnUrl } from './returnPath';

export const MIN_PASSWORD_LENGTH = 8;

interface Credentials {
  email: string;
  password: string;
}

/** Lanza el error de Supabase para que la página lo traduzca (`authErrorMessage`). */
function check({ error }: { error: unknown }): void {
  if (error) throw error;
}

export async function signIn(credentials: Credentials): Promise<void> {
  const { data, error } = await supabase.auth.signInWithPassword(credentials);
  check({ error });
  // No se espera a `onAuthStateChange`: la página redirige en cuanto hay sesión.
  useAuthStore.setState({ session: data.session, ready: true });
}

/** Con «Confirm email» activo no hay sesión hasta verificar: el enlace del correo vuelve a `back`. */
export async function signUp(credentials: Credentials, back: string): Promise<void> {
  check(
    await supabase.auth.signUp({
      ...credentials,
      options: { emailRedirectTo: returnUrl(back) },
    }),
  );
}

export async function resendVerification(email: string, back: string): Promise<void> {
  check(
    await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: returnUrl(back) },
    }),
  );
}

/** Sale del sitio hacia Google; al volver, supabase-js canjea el `?code=` (PKCE). */
export async function signInWithGoogle(back: string): Promise<void> {
  check(
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: returnUrl(back) },
    }),
  );
}

export const RESET_PATH = '/restablecer';

/**
 * Supabase responde igual exista o no la cuenta; solo falla por límite de envíos, red o correo mal
 * escrito. El enlace vuelve a `/restablecer` con `?code=` (PKCE).
 */
export async function requestPasswordReset(email: string): Promise<void> {
  check(
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${RESET_PATH}`,
    }),
  );
}

/** Cambia la contraseña de la sesión de recuperación y cierra las sesiones de otros dispositivos. */
export async function updatePassword(password: string): Promise<void> {
  check(await supabase.auth.updateUser({ password }));
  // La contraseña ya cambió: si esto falla (p. ej. sin internet) no se reporta como error.
  await supabase.auth.signOut({ scope: 'others' }).catch(() => undefined);
}

export async function signOut(): Promise<void> {
  // Se limpia la sesión local aunque falle la llamada (p. ej. sin internet).
  await supabase.auth.signOut().catch(() => undefined);
  useAuthStore.setState({ session: null, ready: true });
}
