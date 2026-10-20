import { ERROR_STATUS, type ErrorCode } from '@ecoclasifica/shared';

/** Fallos que detecta el cliente sin respuesta válida del backend. */
export type ClientErrorCode =
  'NETWORK_ERROR' | 'REQUEST_TIMEOUT' | 'ABORTED' | 'UNEXPECTED_RESPONSE';
export type ApiErrorCode = ErrorCode | ClientErrorCode;

// `Record` obliga a traducir cualquier código nuevo que se añada en `shared`.
const MESSAGES: Record<ApiErrorCode, string> = {
  VALIDATION_ERROR: 'No pudimos procesar la solicitud. Intenta de nuevo.',
  INVALID_IMAGE: 'La foto no es válida. Toma otra en formato JPEG, PNG o WebP.',
  UNAUTHORIZED: 'Tu sesión expiró. Inicia sesión de nuevo.',
  NOT_FOUND: 'No encontramos lo que buscabas.',
  PAYLOAD_TOO_LARGE: 'La foto es demasiado grande. Toma otra.',
  NOT_A_WASTE: 'No encontramos un residuo en la foto. Intenta con otra.',
  UNSAFE_REQUEST: 'Esa idea no es segura y no podemos guiarte con ella. Elige otra idea.',
  RATE_LIMITED: 'Hiciste muchos escaneos seguidos. Espera un minuto e intenta de nuevo.',
  AI_BAD_RESPONSE: 'No pudimos analizar la foto. Intenta de nuevo.',
  AI_TIMEOUT: 'El análisis tardó demasiado. Intenta de nuevo.',
  INTERNAL_ERROR: 'Ocurrió un error inesperado. Intenta más tarde.',
  NETWORK_ERROR: 'No hay conexión con el servidor. Revisa tu internet.',
  REQUEST_TIMEOUT: 'El servidor tardó demasiado en responder. Intenta de nuevo.',
  ABORTED: 'Cancelaste el escaneo.',
  UNEXPECTED_RESPONSE: 'Recibimos una respuesta inesperada. Intenta de nuevo.',
};

export function isBackendErrorCode(code: string): code is ErrorCode {
  return Object.hasOwn(ERROR_STATUS, code);
}

export function errorMessage(code: ApiErrorCode): string {
  return MESSAGES[code];
}

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly status: number | null = null,
    readonly requestId?: string,
  ) {
    super(errorMessage(code));
    this.name = 'ApiError';
  }
}
