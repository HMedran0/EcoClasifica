import { z } from 'zod';
import { DIFFICULTIES } from '../constants/materials';

export const createFavoriteSchema = z.object({
  ideaId: z.string().uuid(),
});
export type CreateFavorite = z.infer<typeof createFavoriteSchema>;

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
