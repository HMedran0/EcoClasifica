import type { Request, RequestHandler } from 'express';
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

const LOGIN_REQUIRED = 'Inicia sesión para continuar';
const SESSION_INVALID = 'Tu sesión no es válida o venció';

const unauthorized = (message: string) => new AppError('UNAUTHORIZED', message);

/** `undefined` si no hay cabecera; `null` si la hay pero no es `Bearer <token>`. */
function readBearer(header: string | undefined): string | null | undefined {
  if (header === undefined) return undefined;
  return BEARER.exec(header.trim())?.[1] ?? null;
}

/**
 * `optionalAuth`: sin cabecera → anónimo; cabecera inválida → 401.
 * `requireAuth`: sin cabecera → 401 «Inicia sesión»; token inválido o vencido → 401 «sesión no
 * válida». Ambos fijan `req.user`.
 */
export function createAuthMiddlewares(verifier: TokenVerifier) {
  const authenticate =
    (required: boolean): RequestHandler =>
    async (req, _res, next) => {
      try {
        const token = readBearer(req.headers.authorization);
        if (token === undefined && !required) return next();
        if (token === undefined) throw unauthorized(LOGIN_REQUIRED);
        if (!token) throw unauthorized(SESSION_INVALID);
        const user = await verifier.verify(token);
        if (!user) throw unauthorized(SESSION_INVALID);
        req.user = user;
        next();
      } catch (err) {
        next(err);
      }
    };

  return { optionalAuth: authenticate(false), requireAuth: authenticate(true) };
}

/** Usuario de una ruta con `requireAuth`; la comprobación evita usar `!`. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized(LOGIN_REQUIRED);
  return req.user;
}

export type AuthMiddlewares = ReturnType<typeof createAuthMiddlewares>;
