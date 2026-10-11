import { ERROR_STATUS, type ErrorCode } from '@ecoclasifica/shared';

/** Error de negocio con código tipificado; el errorHandler lo convierte en la respuesta HTTP. */
export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.status = ERROR_STATUS[code];
  }
}
