import { create } from 'zustand';
import { useAuthStore } from '../auth/authStore';

interface FavoritesState {
  /**
   * `ideaId → favoriteId` (o `null` si se sabe que no es favorita). Una idea ausente aún no se
   * conoce. Vive en memoria: al volver del chat a /ideas el corazón sigue como estaba.
   */
  byIdea: Record<string, string | null>;
}

export const useFavoritesStore = create<FavoritesState>(() => ({ byIdea: {} }));

/** Lo que sabe el servidor (detalle del historial) o el resultado de guardar o quitar. */
export function setFavorites(entries: Record<string, string | null>): void {
  useFavoritesStore.setState((s) => ({ byIdea: { ...s.byIdea, ...entries } }));
}

export function clearFavorites(): void {
  useFavoritesStore.setState({ byIdea: {} });
}

// Al cerrar sesión o cambiar de usuario, los favoritos del anterior no deben verse.
useAuthStore.subscribe((state, prev) => {
  if (state.session?.user.id !== prev.session?.user.id) clearFavorites();
});
