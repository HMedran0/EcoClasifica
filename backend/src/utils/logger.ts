import pino from 'pino';
import { env } from '../config/env';

// Nunca registrar imágenes, Base64, tokens ni cabeceras de autorización.
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: ['req.headers.authorization', 'req.headers.cookie', 'req.body.image'],
});
