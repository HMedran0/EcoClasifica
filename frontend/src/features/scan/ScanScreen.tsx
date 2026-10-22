import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { isUntilTomorrow, type ApiErrorCode } from '../../api/errors';
import { ModeBadge } from '../camera/ModeSwitch';
import type { ScanMode } from '../camera/scanModeStore';
import type { ScanState } from './useScan';

export interface ScanAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

export const BUTTON =
  'flex min-h-tactil w-full items-center justify-center rounded-2xl px-6 text-base font-semibold';
export const PRIMARY = `${BUTTON} bg-lima text-lg font-bold text-petroleo`;
export const SECONDARY = `${BUTTON} border-2 border-bosque text-bosque`;
export const TITLE = 'text-2xl font-extrabold text-petroleo outline-none';

interface ScanScreenProps<T> {
  mode: ScanMode;
  previewUrl: string;
  state: ScanState<T>;
  loadingLabel: string;
  actions: ScanAction[];
  /** Contenido del resultado; solo se muestra con `state.kind === 'success'`. */
  children?: ReactNode;
}

/** Esqueleto común de /resultado e /ideas: foto, modo, carga, error y acciones. */
export function ScanScreen<T>({
  mode,
  previewUrl,
  state,
  loadingLabel,
  actions,
  children,
}: ScanScreenProps<T>) {
  const mainRef = useRef<HTMLElement>(null);

  // Al cambiar de estado los botones se reemplazan: el foco pasa al título para no perderse en `body`.
  // Layout y no pasivo: el foco se fija en el mismo commit que pinta el título (sin carrera en pruebas).
  useLayoutEffect(() => {
    mainRef.current?.querySelector<HTMLElement>('h1')?.focus();
  }, [state.kind]);

  return (
    <main ref={mainRef} className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-6 py-6">
      <div className="flex items-start justify-between gap-3">
        <img
          src={previewUrl}
          alt="Tu foto"
          className="size-24 rounded-2xl border-2 border-bosque/30 bg-petroleo object-cover"
        />
        <ModeBadge mode={mode} />
      </div>

      <section
        aria-live="polite"
        aria-busy={state.kind === 'loading'}
        className="flex flex-col gap-4"
      >
        {state.kind === 'loading' && <Loading label={loadingLabel} />}
        {state.kind === 'success' && children}
      </section>

      {state.kind === 'error' && <ErrorNotice code={state.code} message={state.message} />}

      <div className="mt-auto flex flex-col gap-3">
        {actions.map(({ label, onClick, primary }) => (
          <button
            key={label}
            type="button"
            className={primary ? PRIMARY : SECONDARY}
            onClick={onClick}
          >
            {label}
          </button>
        ))}
      </div>
    </main>
  );
}

/** Acciones de carga y error, iguales en ambos modos; `null` con éxito (cada página decide). */
export function pendingActions<T>(
  state: ScanState<T>,
  retry: () => void,
  backToCamera: () => void,
): ScanAction[] | null {
  const takeAnother = { label: 'Tomar otra foto', onClick: backToCamera };
  if (state.kind === 'loading') return [{ label: 'Cancelar', onClick: backToCamera }];
  if (state.kind === 'success') return null;
  // Con la cuota agotada (HU-20) reintentar no sirve hasta mañana.
  if (state.code === 'NOT_A_WASTE' || isUntilTomorrow(state.code)) {
    return [{ ...takeAnother, primary: true }];
  }
  return [{ label: 'Reintentar', onClick: retry, primary: true }, takeAnother];
}

function Loading({ label }: { label: string }) {
  return (
    <>
      <h1 tabIndex={-1} className={TITLE}>
        {label}…
      </h1>
      <div
        role="progressbar"
        aria-label={label}
        className="h-2 w-full overflow-hidden rounded-full bg-bosque/15"
      >
        <div className="h-full w-1/3 animate-progreso rounded-full bg-bosque motion-reduce:animate-none" />
      </div>
    </>
  );
}

const ERROR_TITLES: Partial<Record<ApiErrorCode, string>> = {
  NOT_A_WASTE: 'No parece un residuo',
  QUOTA_EXCEEDED: 'Llegaste al límite de hoy',
  SERVICE_PAUSED: 'Servicio en pausa por hoy',
};

function ErrorNotice({ code, message }: { code: ApiErrorCode; message: string }) {
  return (
    <div role="alert" className="flex flex-col gap-2">
      <h1 tabIndex={-1} className={TITLE}>
        {ERROR_TITLES[code] ?? 'No pudimos analizar la foto'}
      </h1>
      <p className="text-base text-bosque">{message}</p>
    </div>
  );
}
