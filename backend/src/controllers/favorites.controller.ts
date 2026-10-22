import type { CreateFavorite, FavoritesQuery } from '@ecoclasifica/shared';
import type { Request, Response } from 'express';
import { currentUser } from '../middlewares/auth';
import {
  addFavorite,
  listFavorites,
  removeFavorite,
  type FavoritesDeps,
} from '../services/favorites.service';
import { requireConsent, type MeDeps } from '../services/me.service';

export const createFavoritesController = (deps: FavoritesDeps & MeDeps) => ({
  async list(req: Request, res: Response) {
    const { page } = req.query as unknown as FavoritesQuery;
    res.json(await listFavorites(deps, currentUser(req), page));
  },

  /** 201 si se creó; 200 con la existente si ya era favorita. */
  async create(req: Request, res: Response) {
    const { ideaId } = req.body as CreateFavorite;
    const user = currentUser(req);
    await requireConsent(deps, user);
    const { favorite, created } = await addFavorite(deps, user, ideaId);
    res.status(created ? 201 : 200).json(favorite);
  },

  async remove(req: Request, res: Response) {
    await removeFavorite(deps, currentUser(req), req.params.id ?? '');
    res.status(204).end();
  },
});
