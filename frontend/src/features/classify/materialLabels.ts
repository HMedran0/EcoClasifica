import type { MaterialCode } from '@ecoclasifica/shared';

/** Nombres que ve el usuario; `Record` obliga a traducir cualquier material nuevo de `shared`. */
export const MATERIAL_LABELS: Record<MaterialCode, string> = {
  plastico: 'Plástico',
  papel: 'Papel',
  carton: 'Cartón',
  vidrio: 'Vidrio',
  metal: 'Metal',
  organico: 'Orgánico',
  textil: 'Textil',
  electronico: 'Electrónico',
  peligroso: 'Peligroso',
  madera: 'Madera',
  mixto: 'Mixto',
  otro: 'Otro',
};

const NO_BREAK_SPACE = String.fromCharCode(0xa0);

// Corrige errores de coma flotante (0,29 × 100 = 28,999…) sin llegar a redondear hacia arriba.
const FLOAT_EPSILON = 1e-9;

/**
 * 0,93 → «93 %» (espacio duro antes del signo, como en español). Trunca en vez de redondear:
 * 0,595 se muestra «59 %» y nunca aparenta llegar al umbral de 0,60 junto a «No estoy seguro».
 */
export function formatPercent(value: number): string {
  return `${Math.floor(value * 100 + FLOAT_EPSILON)}${NO_BREAK_SPACE}%`;
}
