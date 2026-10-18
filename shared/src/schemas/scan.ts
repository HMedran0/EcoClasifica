import { z } from 'zod';
import {
  BIN_CODES,
  DIFFICULTIES,
  IMAGE_MIME_TYPES,
  MATERIALS,
  MAX_IMAGE_BASE64_LENGTH,
  MAX_LOCALE_LENGTH,
} from '../constants/materials';

/** Solicitud de escaneo (clasificar y upcycle comparten forma). La imagen va en Base64 sin prefijo `data:`. */
export const scanRequestSchema = z.object({
  image: z
    .string()
    .min(100, 'Imagen vacía o demasiado pequeña')
    .max(MAX_IMAGE_BASE64_LENGTH, 'La imagen supera 4 MB'),
  mimeType: z.enum(IMAGE_MIME_TYPES),
  locale: z.string().max(MAX_LOCALE_LENGTH, 'Idioma no válido').default('es-CO'),
  municipalityCode: z.string().max(20).optional(),
});
export type ScanRequest = z.infer<typeof scanRequestSchema>;

export const disposalSchema = z.object({
  binCode: z.enum(BIN_CODES),
  binName: z.string(),
  colorHex: z.string(),
  icon: z.string(),
  instructions: z.string(),
  requiresDropOff: z.boolean(),
});
export type Disposal = z.infer<typeof disposalSchema>;

export const classifyResponseSchema = z.object({
  scanId: z.string().uuid().nullable(),
  mode: z.literal('classify'),
  result: z.object({
    object: z.string(),
    material: z.enum(MATERIALS),
    materialDetail: z.string(),
    confidence: z.number().min(0).max(1),
    lowConfidence: z.boolean(),
    alternatives: z.array(
      z.object({ material: z.enum(MATERIALS), confidence: z.number().min(0).max(1) }),
    ),
  }),
  /** `null` cuando la certeza es baja (el cliente muestra las alternativas). */
  disposal: disposalSchema.nullable(),
  saved: z.boolean(),
});
export type ClassifyResponse = z.infer<typeof classifyResponseSchema>;

export const ideaSchema = z.object({
  ideaIndex: z.number().int().min(0).max(2),
  title: z.string(),
  description: z.string(),
  extraMaterials: z.array(z.string()),
});
export type Idea = z.infer<typeof ideaSchema>;

export const upcycleResponseSchema = z.object({
  scanId: z.string().uuid().nullable(),
  mode: z.literal('upcycle'),
  result: z.object({
    objectName: z.string(),
    difficulty: z.enum(DIFFICULTIES),
    ideas: z.array(ideaSchema).length(3),
  }),
  saved: z.boolean(),
});
export type UpcycleResponse = z.infer<typeof upcycleResponseSchema>;
