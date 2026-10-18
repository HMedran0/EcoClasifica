import type { BinCode } from '@ecoclasifica/shared';

// Caneca común (tapa, asa y cuerpo); cada contenedor añade su marca.
const BIN = 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13';

const PATHS: Record<BinCode, string> = {
  WHITE: `${BIN} M12 10l3 5H9z`, // Triángulo de aprovechables.
  GREEN: `${BIN} M9 17c0-4 2.5-6 6-6 0 4-2.5 6-6 6z M9 17l3-3`, // Hoja.
  BLACK: `${BIN} M10 11v6 M14 11v6`,
  BULKY: 'M3 8l9-4 9 4v9l-9 4-9-4z M3 8l9 4 9-4 M12 12v9', // Caja grande.
  DROP_OFF: 'M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z M12 7v6 M9 10h6', // Punto en el mapa.
};

interface BinIconProps {
  code: BinCode;
  className?: string;
}

/** Decorativo: el nombre del contenedor siempre va en texto al lado. */
export function BinIcon({ code, className = 'size-8' }: BinIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-bin={code}
      className={className}
    >
      <path d={PATHS[code]} />
    </svg>
  );
}
