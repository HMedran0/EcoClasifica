import type { RequestHandler } from 'express';
import type { AuthUser, TokenVerifier } from '../services/auth.service';
import { AppError } from '../utils/appError';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Usuario autenticado; ausente en peticiones anónimas. */
      user?: AuthUser;
    }
  }
}

const BEARER = /^Bearer ([^\s]+)$/i;

const unauthorized = () => new AppError('UNAUTHORIZED', 'Tu sesión no es válida o venció');

/** `undefined` si no hay cabecera; `null` si la hay pero no es `Bearer <token>`. */
function readBearer(header: string | undefined): string | null | undefined {
  if (header === undefined) return undefined;
  return BEARER.exec(header.trim())?.[1] ?? null;
}

/**
 * `optionalAuth`: sin cabecera → anónimo; cabecera inválida → 401.
 * `requireAuth`: sin sesión válida → 401. Ambos fijan `req.user`.
 */
export function createAuthMiddlewares(verifier: TokenVerifier) {
  const authenticate =
    (required: boolean): RequestHandler =>
    async (req, _res, next) => {
      try {
        const token = readBearer(req.headers.authorization);
        if (token === undefined && !required) return next();
        if (!token) throw unauthorized();
        const user = await verifier.verify(token);
        if (!user) throw unauthorized();
        req.user = user;
        next();
      } catch (err) {
        next(err);
      }
    };

  return { optionalAuth: authenticate(false), requireAuth: authenticate(true) };
}

export type AuthMiddlewares = ReturnType<typeof createAuthMiddlewares>;
