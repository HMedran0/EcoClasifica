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

/**
 * Misma configuración en producción y en pruebas (que pasan su propio `destination`).
 * El nivel sale como texto (`"error"`, no `50`): Railway solo reconoce debug/info/warn/error
 * y, si no, marca todo stdout como `info`, así que `@level:error` no encontraba nada.
 */
export function createLogger(level: Level | 'silent', destination?: DestinationStream) {
  return pino(
    { level, redact: LOG_REDACT_PATHS, formatters: { level: (label) => ({ level: label }) } },
    destination,
  );
}

/** Nivel de la línea de pino-http: 5xx o error → error, 4xx → warn, resto → info. */
export function httpLogLevel(_req: unknown, res: { statusCode: number }, err?: Error): Level {
  if (err || res.statusCode >= 500) return 'error';
  if (res.statusCode >= 400) return 'warn';
  return 'info';
}

export const logger = createLogger(
  env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'production' ? 'info' : 'debug',
);
