import { z } from 'zod';

export const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  INVALID_IMAGE: 400,
  UNAUTHORIZED: 401,
  /** Sesión sin autorización de la política vigente (HU-21): no se guardan favoritos. */
  CONSENT_REQUIRED: 403,
  NOT_FOUND: 404,
  PAYLOAD_TOO_LARGE: 413,
  NOT_A_WASTE: 422,
  UNSAFE_REQUEST: 422,
  RATE_LIMITED: 429,
  /** Cuota diaria de IA agotada (HU-20); se reinicia a medianoche de America/Bogota. */
  QUOTA_EXCEEDED: 429,
  AI_BAD_RESPONSE: 502,
  AI_TIMEOUT: 504,
  INTERNAL_ERROR: 500,
  /** Tope global diario de tokens alcanzado (HU-20): «Servicio en pausa por hoy». */
  SERVICE_PAUSED: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export const errorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
  }),
});
export type ErrorBody = z.infer<typeof errorBodySchema>;
