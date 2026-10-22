import { z } from 'zod';

/** GET /api/v1/me: perfil del usuario con sesión (HU-04). */
export const meResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().nullable(),
  displayName: z.string().nullable(),
  /** Versión de la política autorizada (HU-21); `null` si nunca autorizó. */
  privacyVersion: z.string().nullable(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

/** POST /api/v1/me/consent (HU-21): sin cuerpo; responde la versión y la fecha guardadas. */
export const consentResponseSchema = z.object({
  privacyVersion: z.string(),
  privacyAcceptedAt: z.string().datetime({ offset: true }),
});
export type ConsentResponse = z.infer<typeof consentResponseSchema>;
