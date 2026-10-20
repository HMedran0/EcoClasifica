import type { Request, Response } from 'express';
import { getMe, type MeDeps } from '../services/me.service';
import { AppError } from '../utils/appError';

export const createMeController = (deps: MeDeps) => ({
  async show(req: Request, res: Response) {
    // `requireAuth` lo garantiza; la comprobación evita usar `!`.
    if (!req.user) throw new AppError('UNAUTHORIZED', 'Inicia sesión para continuar');
    res.json(await getMe(deps, req.user));
  },
});
