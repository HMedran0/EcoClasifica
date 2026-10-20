import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase } from '../../lib/supabase';

interface AuthState {
  session: Session | null;
  /** `false` hasta conocer la sesión guardada (y canjear un `?code=` de regreso, si lo hay). */
  ready: boolean;
}

export const useAuthStore = create<AuthState>(() => ({ session: null, ready: false }));

/** Carga la sesión guardada y escucha sus cambios (entrar, salir, renovar el token). */
export function initAuth(): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.setState({ session, ready: true });
  });
  supabase.auth
    .getSession()
    .then(({ data: { session } }) => useAuthStore.setState({ session, ready: true }))
    .catch(() => useAuthStore.setState({ session: null, ready: true }));
  return () => data.subscription.unsubscribe();
}

/**
 * Token para `Authorization: Bearer`. `getSession` lo renueva si venció (p. ej. tras suspender el
 * móvil); sin sesión o si falla, la petición sale anónima.
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * El backend rechazó el token: primero se intenta renovar la sesión. Si no se puede (sesión revocada,
 * usuario borrado), se borra solo la sesión de este dispositivo y se devuelve `null`.
 */
export async function renewOrClearSession(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session) {
      useAuthStore.setState({ session: data.session, ready: true });
      return data.session.access_token;
    }
  } catch {
    /* se trata igual que una renovación fallida */
  }
  useAuthStore.setState({ session: null, ready: true });
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  return null;
}

/** Nombre visible: el de Google si existe; si no, el correo. */
export function sessionLabel(session: Session): string {
  const meta: Record<string, unknown> = session.user.user_metadata ?? {};
  const name = meta.full_name ?? meta.name;
  return typeof name === 'string' && name.trim() ? name.trim() : (session.user.email ?? '');
}
