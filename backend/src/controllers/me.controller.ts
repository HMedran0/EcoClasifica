import type { Request, Response } from 'express';
import { currentUser } from '../middlewares/auth';
import {
  acceptPrivacy,
  deleteAccount,
  getMe,
  type AccountDeletionDeps,
  type MeDeps,
} from '../services/me.service';
import { AppError } from '../utils/appError';

export const createMeController = (deps: MeDeps & AccountDeletionDeps) => ({
  async show(req: Request, res: Response) {
    // `requireAuth` lo garantiza; la comprobación evita usar `!`.
    if (!req.user) throw new AppError('UNAUTHORIZED', 'Inicia sesión para continuar');
    res.json(await getMe(deps, req.user));
  },

  async consent(req: Request, res: Response) {
    res.json(await acceptPrivacy(deps, currentUser(req)));
  },

  async remove(req: Request, res: Response) {
    await deleteAccount(deps, currentUser(req), req.log);
    res.status(204).end();
  },
});
