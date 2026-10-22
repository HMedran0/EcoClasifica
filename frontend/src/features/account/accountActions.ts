import { api } from '../../api/client';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../auth/authStore';
import { usePhotoStore } from '../camera/photoStore';
import { clearFavorites } from '../favorites/favoritesStore';
import { useConsentStore } from '../privacy/consentStore';

/** HU-22: el backend borra las fotos y después el usuario; si falla, la cuenta sigue intacta. */
export async function deleteAccount(): Promise<void> {
  await api.deleteAccount();
}

/** Olvida en memoria lo de la cuenta: foto, respuestas en caché, chats, favoritos y autorización. */
export function clearAccountData(): void {
  usePhotoStore.getState().clear();
  clearFavorites();
  useConsentStore.setState({ userId: null, status: 'checking' });
}

/**
 * Tras borrar la cuenta: limpia los stores y cierra solo la sesión local (el usuario ya no existe
 * en Auth, así que cerrarla en el servidor fallaría).
 */
export async function endDeletedSession(): Promise<void> {
  clearAccountData();
  useAuthStore.setState({ session: null, ready: true });
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
}
