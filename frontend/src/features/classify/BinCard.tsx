import type { Disposal } from '@ecoclasifica/shared';
import { BinIcon } from './BinIcon';

const FALLBACK_COLOR = '#9E9E9E';
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** Tarjeta del contenedor: color e ícono acompañan al nombre, nunca lo sustituyen. */
export function BinCard({ disposal }: { disposal: Disposal }) {
  const { binCode, binName, colorHex, instructions, requiresDropOff } = disposal;
  const color = HEX_COLOR.test(colorHex) ? colorHex : FALLBACK_COLOR;
  return (
    <article className="flex items-start gap-4 rounded-2xl border-2 border-bosque/30 bg-white p-4">
      {/* Borde oscuro siempre: el contenedor blanco (#F5F5F5) no se distinguiría del fondo. */}
      <div
        data-testid="bin-swatch"
        className="flex size-16 shrink-0 items-center justify-center rounded-xl border-2 border-petroleo"
        style={{ backgroundColor: color, color: isLight(color) ? '#03393b' : '#ffffff' }}
      >
        <BinIcon code={binCode} />
      </div>
      <div className="flex flex-col gap-1">
        {requiresDropOff ? (
          <h2 className="text-xl font-bold text-petroleo">Llevar a punto limpio</h2>
        ) : (
          <>
            <p className="text-sm font-semibold text-bosque">Deposítalo en</p>
            <h2 className="text-xl font-bold text-petroleo">{binName}</h2>
          </>
        )}
        <p className="text-base text-bosque">{instructions}</p>
      </div>
    </article>
  );
}

/** Luminancia relativa (WCAG) > 0,179: el ícono oscuro contrasta más que el blanco. */
function isLight(hex: string): boolean {
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179;
}
