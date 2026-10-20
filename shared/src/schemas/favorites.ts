import { z } from 'zod';
import { DIFFICULTIES } from '../constants/materials';

export const FAVORITES_PAGE_SIZE = 20;
export const FAVORITES_MAX_PAGE = 1000;

/**
 * POST /api/v1/favorites (HU-12). Solo el `ideaId`: la copia la arma el backend desde la base;
 * cualquier otro campo del cliente se descarta.
 */
export const createFavoriteSchema = z.object({
  ideaId: z.string().uuid(),
});
export type CreateFavorite = z.infer<typeof createFavoriteSchema>;

/** Un id mal formado responde 404, igual que el de otro usuario. */
export const favoriteIdSchema = z.string().uuid();

/** GET /api/v1/favorites?page=N. Fuera de rango: `items: []` y `hasMore: false`. */
export const favoritesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(FAVORITES_MAX_PAGE).default(1),
});
export type FavoritesQuery = z.infer<typeof favoritesQuerySchema>;

/** Copia de la idea: sobrevive aunque se borre el escaneo (`ideaId` pasa a `null`). */
export const favoriteSchema = z.object({
  id: z.string().uuid(),
  ideaId: z.string().uuid().nullable(),
  objectName: z.string(),
  difficulty: z.enum(DIFFICULTIES).nullable(),
  title: z.string(),
  description: z.string(),
  extraMaterials: z.array(z.string()),
  createdAt: z.string(),
});
export type Favorite = z.infer<typeof favoriteSchema>;

export const favoritesListResponseSchema = z.object({
  items: z.array(favoriteSchema),
  page: z.number().int().min(1),
  pageSize: z.literal(FAVORITES_PAGE_SIZE),
  hasMore: z.boolean(),
});
export type FavoritesListResponse = z.infer<typeof favoritesListResponseSchema>;
