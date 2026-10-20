import type { MaterialCode } from '@ecoclasifica/shared';

/**
 * Respaldos del backend: aunque la IA proponga ideas, estos casos nunca reciben manualidades.
 * Fallan hacia lo seguro (un falso positivo solo sugiere el modo Clasificar).
 */
export type SafetyRule = 'material' | 'blocked_term';

export interface SafetyBlock {
  rule: SafetyRule;
  reason: string;
}

const MATERIAL_REASONS: Partial<Record<MaterialCode, string>> = {
  peligroso:
    'Es un residuo peligroso: no es seguro para manualidades. Clasifícalo para llevarlo a un punto limpio.',
  electronico:
    'Los electrónicos tienen componentes peligrosos: no son seguros para manualidades. Llévalo a un punto limpio.',
};

const BLOCKED_TERM_REASON =
  'Puede ser un residuo peligroso o sanitario: no es seguro para manualidades. Clasifícalo para desecharlo bien.';

// Sin tildes ni mayúsculas. "aceite" queda fuera a propósito: un envase vacío sí se reutiliza.
const BLOCKED_TERMS = [
  'pila',
  'bateria',
  'medicamento',
  'jeringa',
  'aguja',
  'pañal',
  'toalla higienica',
  'aerosol',
  'insecticida',
  'veneno',
  'quimico',
  'cloro',
  'thinner',
  'gasolina',
  'bombillo',
  'fluorescente',
  'vidrio roto',
  // Armas y explosivos (también se aplican a la idea que llega al chat).
  'explosivo',
  'bomba casera',
  'molotov',
  'arma',
  'polvora',
];

/** Minúsculas, sin tildes (la ñ pasa a n) y con espacios simples. */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Cada término por palabra completa, admitiendo plural en cada palabra (pilas, vidrios rotos). */
const BLOCKED_PATTERN = new RegExp(
  `(?<![a-z0-9])(?:${BLOCKED_TERMS.map((term) =>
    normalize(term)
      .split(' ')
      .map((word) => `${word}(?:e?s)?`)
      .join(' '),
  ).join('|')})(?![a-z0-9])`,
);

export function hasBlockedTerm(objectName: string): boolean {
  return BLOCKED_PATTERN.test(normalize(objectName));
}

export function findSafetyBlock(objectName: string, material: MaterialCode): SafetyBlock | null {
  const materialReason = MATERIAL_REASONS[material];
  if (materialReason) return { rule: 'material', reason: materialReason };
  if (hasBlockedTerm(objectName)) return { rule: 'blocked_term', reason: BLOCKED_TERM_REASON };
  return null;
}
