import { z } from 'zod';
import { DIFFICULTIES, MATERIALS, UPCYCLE_IDEAS_COUNT } from '../constants/materials';

const material = z.enum(MATERIALS).catch('otro');
const confidence = z.number().min(0).max(1);

/** Salida cruda esperada de la IA al clasificar (claves en snake_case, tal como las pide el prompt). */
export const aiClassifySchema = z.object({
  is_waste: z.boolean(),
  object: z.string().max(80),
  material,
  material_detail: z.string().max(80).default(''),
  confidence,
  alternatives: z.array(z.object({ material, confidence })).max(2).default([]),
});
export type AiClassifyOutput = z.infer<typeof aiClassifySchema>;

/** Salida cruda esperada de la IA al proponer upcycling. */
export const aiUpcycleSchema = z.object({
  object_name: z.string().min(1).max(80),
  difficulty: z.enum(DIFFICULTIES),
  ideas: z
    .array(
      z.object({
        title: z.string().min(1).max(80),
        // El prompt pide ≤ 120 caracteres; se tolera algo más y el servicio recorta.
        description: z.string().min(1).max(240),
        extra_materials: z.array(z.string().max(60)).max(5).default([]),
      }),
    )
    .length(UPCYCLE_IDEAS_COUNT),
});
export type AiUpcycleOutput = z.infer<typeof aiUpcycleSchema>;
