import { z } from 'zod';

export const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  INVALID_IMAGE: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  PAYLOAD_TOO_LARGE: 413,
  NOT_A_WASTE: 422,
  UNSAFE_REQUEST: 422,
  RATE_LIMITED: 429,
  AI_BAD_RESPONSE: 502,
  AI_TIMEOUT: 504,
  INTERNAL_ERROR: 500,
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
