import { z } from 'zod';
import {
  DIFFICULTIES,
  MATERIALS,
  UPCYCLE_IDEAS_COUNT,
  type Difficulty,
} from '../constants/materials';

const material = z.enum(MATERIALS).catch('otro');
const confidence = z.number().min(0).max(1);

/** Salida cruda esperada de la IA al clasificar (claves en snake_case, tal como las pide el prompt). */
export const aiClassifySchema = z.object({
  is_waste: z.boolean(),
  object: z.string().max(80),
  material,
  material_detail: z.string().max(80).default(''),
  confidence,
  // El prompt pide ≤ 2; se toleran hasta 4 (p. ej. si repite el principal) y el servicio deja las 2 mejores.
  alternatives: z.array(z.object({ material, confidence })).max(4).default([]),
});
export type AiClassifyOutput = z.infer<typeof aiClassifySchema>;

const DIFFICULTY_ALIASES: Record<string, Difficulty> = {
  facil: 'Fácil',
  medio: 'Medio',
  media: 'Medio',
  dificil: 'Difícil',
};

/** "facil", "FÁCIL" o "Media" → valor del contrato; lo desconocido se deja para que falle el enum. */
export function normalizeDifficulty(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const key = value.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
  return DIFFICULTY_ALIASES[key] ?? value;
}

// Los límites de la IA son holgados: el servicio recorta a los del contrato (UPCYCLE_*_MAX).
const aiIdea = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(500),
  extra_materials: z.array(z.string().max(80)).max(10).default([]),
});
const upcycleBase = {
  is_waste: z.boolean(),
  object_name: z.string().trim().min(1).max(120),
  // Respaldo de seguridad: peligroso o electronico bloquean las ideas en el backend.
  material,
  reason: z.string().max(500).default(''),
};

/** Salida cruda esperada de la IA al proponer upcycling. */
export const aiUpcycleSchema = z.union([
  // Con más de 3 ideas el servicio recorta; con menos falla y el proveedor reintenta.
  z.object({
    ...upcycleBase,
    can_upcycle: z.literal(true),
    difficulty: z.preprocess(normalizeDifficulty, z.enum(DIFFICULTIES)),
    ideas: z.array(aiIdea).min(UPCYCLE_IDEAS_COUNT).max(8),
  }),
  z.object({ ...upcycleBase, can_upcycle: z.literal(false) }),
  // Sin residuo no importa el resto: el servicio responde NOT_A_WASTE.
  z.object({ is_waste: z.literal(false), object_name: z.string().max(120).default('') }),
]);
export type AiUpcycleOutput = z.infer<typeof aiUpcycleSchema>;
