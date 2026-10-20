import pino, { type DestinationStream, type Level } from 'pino';
import { env } from '../config/env';

// Nunca registrar imágenes, Base64, tokens ni cabeceras de autorización.
// pino-http serializa `req.headers` completos: `authorization` y `cookie` se ocultan aquí.
export const LOG_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.image',
  'err.body',
  'error.body',
];

/** Misma configuración en producción y en pruebas (que pasan su propio `destination`). */
export function createLogger(level: Level | 'silent', destination?: DestinationStream) {
  return pino({ level, redact: LOG_REDACT_PATHS }, destination);
}

export const logger = createLogger(
  env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'production' ? 'info' : 'debug',
);
