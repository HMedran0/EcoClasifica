import { z } from 'zod';
import {
  BIN_CODES,
  DIFFICULTIES,
  IMAGE_MIME_TYPES,
  MATERIALS,
  MAX_IMAGE_BASE64_LENGTH,
  MAX_LOCALE_LENGTH,
  UPCYCLE_DESCRIPTION_MAX,
  UPCYCLE_EXTRA_MATERIALS_MAX,
  UPCYCLE_IDEAS_COUNT,
  UPCYCLE_REASON_MAX,
  UPCYCLE_TITLE_MAX,
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
    /** Hasta 2 hipótesis distintas del material principal, de mayor a menor certeza. */
    alternatives: z
      .array(z.object({ material: z.enum(MATERIALS), confidence: z.number().min(0).max(1) }))
      .max(2),
  }),
  /** `null` cuando la certeza es baja (el cliente muestra las alternativas). */
  disposal: disposalSchema.nullable(),
  saved: z.boolean(),
});
export type ClassifyResponse = z.infer<typeof classifyResponseSchema>;

export const ideaSchema = z.object({
  ideaIndex: z
    .number()
    .int()
    .min(0)
    .max(UPCYCLE_IDEAS_COUNT - 1),
  title: z.string().max(UPCYCLE_TITLE_MAX),
  description: z.string().max(UPCYCLE_DESCRIPTION_MAX),
  extraMaterials: z.array(z.string()).max(UPCYCLE_EXTRA_MATERIALS_MAX),
});
export type Idea = z.infer<typeof ideaSchema>;

export const upcycleResultSchema = z.discriminatedUnion('canUpcycle', [
  z.object({
    canUpcycle: z.literal(true),
    objectName: z.string(),
    difficulty: z.enum(DIFFICULTIES),
    ideas: z.array(ideaSchema).length(UPCYCLE_IDEAS_COUNT),
  }),
  /** Peligrosos, sanitarios o vidrio roto: sin ideas; el cliente sugiere el modo Clasificar. */
  z.object({
    canUpcycle: z.literal(false),
    objectName: z.string(),
    reason: z.string().max(UPCYCLE_REASON_MAX),
  }),
]);
export type UpcycleResult = z.infer<typeof upcycleResultSchema>;

export const upcycleResponseSchema = z.object({
  scanId: z.string().uuid().nullable(),
  mode: z.literal('upcycle'),
  result: upcycleResultSchema,
  saved: z.boolean(),
});
export type UpcycleResponse = z.infer<typeof upcycleResponseSchema>;
