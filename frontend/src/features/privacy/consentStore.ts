import { PRIVACY_VERSION } from '@ecoclasifica/shared';
import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { api } from '../../api/client';

/**
 * - `checking`: consultando `/me`.
 * - `ok`: autorizó la versión vigente.
 * - `needed`: debe ver `/autorizacion`.
 * - `unverified`: no se pudo consultar (p. ej. sin internet); se deja pasar y se reintenta al
 *   navegar. El backend igual no guarda nada sin autorización (HU-21).
 */
export type ConsentStatus = 'checking' | 'ok' | 'needed' | 'unverified';

interface ConsentState {
  /** Usuario al que corresponde `status`; cambia al entrar con otra cuenta. */
  userId: string | null;
  status: ConsentStatus;
}

export const useConsentStore = create<ConsentState>(() => ({ userId: null, status: 'checking' }));

export function markConsented(userId: string): void {
  useConsentStore.setState({ userId, status: 'ok' });
}

/** Lo marcó al crear la cuenta con correo (`signUp` lo guarda en `user_metadata`). */
function acceptedAtSignUp(session: Session): boolean {
  const meta: Record<string, unknown> = session.user.user_metadata ?? {};
  return meta.privacy_version === PRIVACY_VERSION;
}

/**
 * Consulta la versión autorizada. Si la casilla se marcó al registrarse, la autorización se registra
 * sin volver a preguntar; la prueba es la fila de `profiles`, con la versión y la fecha del servidor.
 */
async function resolveConsent(session: Session): Promise<ConsentStatus> {
  let version: string | null;
  try {
    version = (await api.me()).privacyVersion;
  } catch {
    return 'unverified';
  }
  if (version === PRIVACY_VERSION) return 'ok';
  if (!acceptedAtSignUp(session)) return 'needed';
  try {
    await api.acceptPrivacy();
    return 'ok';
  } catch {
    return 'needed';
  }
}

/** Comprueba una vez por usuario (y de nuevo tras `unverified`). */
export async function checkConsent(session: Session): Promise<void> {
  const userId = session.user.id;
  const current = useConsentStore.getState();
  if (current.userId === userId && current.status !== 'unverified') return;
  useConsentStore.setState({ userId, status: 'checking' });
  const status = await resolveConsent(session);
  // Si entretanto cambió la cuenta, el resultado ya no aplica.
  if (useConsentStore.getState().userId === userId) useConsentStore.setState({ status });
}
