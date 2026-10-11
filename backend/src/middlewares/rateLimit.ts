import rateLimit from 'express-rate-limit';
import { AppError } from '../utils/appError';

/** 10 escaneos por minuto por IP. Requiere `trust proxy` activo detrás de Railway. */
export const scanLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) =>
    next(new AppError('RATE_LIMITED', 'Demasiados intentos, espera un momento')),
});
