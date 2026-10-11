import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

/** Valida y reemplaza `req.body`, `req.query` o `req.params` con el resultado parseado de Zod. */
export const validate =
  (schema: ZodTypeAny, source: 'body' | 'query' | 'params' = 'body'): RequestHandler =>
  (req, _res, next) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    Object.assign(req, { [source]: parsed.data });
    next();
  };
