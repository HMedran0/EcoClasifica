import rateLimit from 'express-rate-limit';
import { AppError } from '../utils/appError';

/** Fábrica para que cada `createApp()` (y cada prueba) tenga su propio contador por IP. */
const createLimiter = (limit: number, message: string) =>
  rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new AppError('RATE_LIMITED', message)),
  });

/** 10 escaneos por minuto por IP. Requiere `trust proxy` activo detrás de Railway. */
export const createScanLimiter = () => createLimiter(10, 'Demasiados intentos, espera un momento');

/** 20 mensajes de chat por minuto por IP (solo texto, pero cada uno cuesta una llamada a la IA). */
export const createChatLimiter = () =>
  createLimiter(20, 'Enviaste muchos mensajes seguidos, espera un momento');
