import type { HistoryQuery } from '@ecoclasifica/shared';
import type { Request, Response } from 'express';
import { currentUser } from '../middlewares/auth';
import {
  deleteHistory,
  deleteHistoryItem,
  getHistoryItem,
  listHistory,
  type HistoryDeps,
} from '../services/history.service';

export const createHistoryController = (deps: HistoryDeps) => ({
  async list(req: Request, res: Response) {
    const { page } = req.query as unknown as HistoryQuery;
    res.json(await listHistory(deps, currentUser(req), page, req.log));
  },

  async show(req: Request, res: Response) {
    res.json(await getHistoryItem(deps, currentUser(req), req.params.id ?? '', req.log));
  },

  async remove(req: Request, res: Response) {
    await deleteHistoryItem(deps, currentUser(req), req.params.id ?? '', req.log);
    res.status(204).end();
  },

  async removeAll(req: Request, res: Response) {
    res.json(await deleteHistory(deps, currentUser(req), req.log));
  },
});
