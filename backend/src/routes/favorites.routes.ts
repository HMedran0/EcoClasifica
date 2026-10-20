import { createFavoriteSchema, favoritesQuerySchema } from '@ecoclasifica/shared';
import { Router } from 'express';
import { createFavoritesController } from '../controllers/favorites.controller';
import type { AuthMiddlewares } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import type { FavoritesDeps } from '../services/favorites.service';
import { asyncHandler } from '../utils/asyncHandler';

export function createFavoritesRoutes(deps: FavoritesDeps, auth: AuthMiddlewares) {
  const router = Router();
  const controller = createFavoritesController(deps);

  router.get(
    '/favorites',
    auth.requireAuth,
    validate(favoritesQuerySchema, 'query'),
    asyncHandler(controller.list),
  );
  router.post(
    '/favorites',
    auth.requireAuth,
    validate(createFavoriteSchema),
    asyncHandler(controller.create),
  );
  router.delete('/favorites/:id', auth.requireAuth, asyncHandler(controller.remove));
  return router;
}
