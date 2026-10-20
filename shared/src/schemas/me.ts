import { z } from 'zod';

/** GET /api/v1/me: perfil del usuario con sesión (HU-04). */
export const meResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().nullable(),
  displayName: z.string().nullable(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;
