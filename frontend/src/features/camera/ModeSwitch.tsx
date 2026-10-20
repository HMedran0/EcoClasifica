import { MODE_LABELS, useScanModeStore, type ScanMode } from './scanModeStore';

const MODES: ScanMode[] = ['classify', 'upcycle'];

const BADGE_STYLE: Record<ScanMode, string> = {
  classify: 'bg-bosque/10 text-bosque',
  upcycle: 'bg-lima text-petroleo',
};

/**
 * HU-03: interruptor de modo. Radios nativos (flechas del teclado y `checked` accesibles sin
 * código extra) con aspecto de control segmentado.
 */
export function ModeSwitch() {
  const mode = useScanModeStore((s) => s.mode);
  const setMode = useScanModeStore((s) => s.setMode);
  return (
    <fieldset className="flex rounded-2xl border-2 border-bosque p-1">
      <legend className="sr-only">Modo de escaneo</legend>
      {MODES.map((value) => (
        <label
          key={value}
          className="flex min-h-tactil flex-1 cursor-pointer items-center justify-center rounded-xl px-3 text-center text-base font-semibold text-bosque focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-bosque has-checked:bg-bosque has-checked:text-white"
        >
          <input
            type="radio"
            name="scan-mode"
            value={value}
            checked={mode === value}
            onChange={() => setMode(value)}
            className="sr-only"
          />
          {MODE_LABELS[value]}
        </label>
      ))}
    </fieldset>
  );
}

/** Etiqueta del modo en las pantallas de resultado (el modo se ve siempre). */
export function ModeBadge({ mode }: { mode: ScanMode }) {
  return (
    <p className={`rounded-full px-3 py-1 text-sm font-semibold ${BADGE_STYLE[mode]}`}>
      Modo {MODE_LABELS[mode]}
    </p>
  );
}
