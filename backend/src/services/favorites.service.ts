import {
  FAVORITES_PAGE_SIZE,
  favoriteIdSchema,
  type Favorite,
  type FavoritesListResponse,
} from '@ecoclasifica/shared';
import type { FavoritesRepo } from '../repositories/favorites.repo';
import { AppError } from '../utils/appError';
import type { AuthUser } from './auth.service';

export interface FavoritesDeps {
  favorites: FavoritesRepo;
}

export interface SavedFavorite {
  favorite: Favorite;
  /** `false` si ya era favorita (la petición es idempotente). */
  created: boolean;
}

/**
 * Guarda una idea del usuario como favorita. La copia sale de la base, nunca del cliente.
 * Idea ajena o inexistente → 404 (no 403): no se revela si existe.
 */
export async function addFavorite(
  { favorites }: FavoritesDeps,
  user: AuthUser,
  ideaId: string,
): Promise<SavedFavorite> {
  const snapshot = await favorites.findIdeaSnapshot(user.id, ideaId);
  if (!snapshot) throw new AppError('NOT_FOUND', 'No encontramos esa idea en tu historial');

  const existing = await favorites.findByIdea(user.id, ideaId);
  if (existing) return { favorite: existing, created: false };

  const inserted = await favorites.insert(user.id, snapshot);
  if (inserted) return { favorite: inserted, created: true };

  // Otra petición la guardó entre la lectura y la inserción: se devuelve esa.
  const raced = await favorites.findByIdea(user.id, ideaId);
  if (!raced) throw new Error('Conflicto al guardar el favorito sin fila existente');
  return { favorite: raced, created: false };
}

/** Solo las propias; un id ajeno o mal formado responde 404. */
export async function removeFavorite(
  { favorites }: FavoritesDeps,
  user: AuthUser,
  favoriteId: string,
): Promise<void> {
  const id = favoriteIdSchema.safeParse(favoriteId);
  const removed = id.success && (await favorites.remove(user.id, id.data));
  if (!removed) throw new AppError('NOT_FOUND', 'No encontramos ese favorito');
}

/** Una página de 20, más recientes primero. Se pide uno de más para saber si hay otra página. */
export async function listFavorites(
  { favorites }: FavoritesDeps,
  user: AuthUser,
  page: number,
): Promise<FavoritesListResponse> {
  const rows = await favorites.list(user.id, {
    offset: (page - 1) * FAVORITES_PAGE_SIZE,
    limit: FAVORITES_PAGE_SIZE + 1,
  });
  return {
    items: rows.slice(0, FAVORITES_PAGE_SIZE),
    page,
    pageSize: FAVORITES_PAGE_SIZE,
    hasMore: rows.length > FAVORITES_PAGE_SIZE,
  };
}
