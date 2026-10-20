import type { HistoryQuery } from '@ecoclasifica/shared';
import type { Request, Response } from 'express';
import { getHistoryItem, listHistory, type HistoryDeps } from '../services/history.service';
import { AppError } from '../utils/appError';
import type { AuthUser } from '../services/auth.service';

// `requireAuth` lo garantiza; la comprobación evita usar `!`.
function currentUser(req: Request): AuthUser {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Inicia sesión para continuar');
  return req.user;
}

export const createHistoryController = (deps: HistoryDeps) => ({
  async list(req: Request, res: Response) {
    const { page } = req.query as unknown as HistoryQuery;
    res.json(await listHistory(deps, currentUser(req), page, req.log));
  },

  async show(req: Request, res: Response) {
    res.json(await getHistoryItem(deps, currentUser(req), req.params.id ?? '', req.log));
  },
});
