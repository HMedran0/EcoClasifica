import rateLimit from 'express-rate-limit';
import { AppError } from '../utils/appError';

/**
 * 10 escaneos por minuto por IP. Requiere `trust proxy` activo detrás de Railway.
 * Es una fábrica para que cada `createApp()` (y cada prueba) tenga su propio contador.
 */
export const createScanLimiter = () =>
  rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new AppError('RATE_LIMITED', 'Demasiados intentos, espera un momento')),
  });
