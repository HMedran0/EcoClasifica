import type { ClassifyResponse } from '@ecoclasifica/shared';
import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router';
import { api, type RequestOptions, type ScanRequestInput } from '../../api/client';
import { ApiError, errorMessage, type ApiErrorCode } from '../../api/errors';
import { usePhotoStore } from '../camera/photoStore';
import { BinCard } from './BinCard';
import { capitalizeFirst, formatPercent, MATERIAL_LABELS } from './materialLabels';
import { toResultView, type ResultView } from './resultView';

type State =
  | { kind: 'loading' }
  | { kind: 'success'; data: ClassifyResponse }
  | { kind: 'error'; code: ApiErrorCode; message: string };

interface Action {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

const BUTTON =
  'flex min-h-tactil w-full items-center justify-center rounded-2xl px-6 text-base font-semibold';
const PRIMARY = `${BUTTON} bg-lima text-lg font-bold text-petroleo`;
const SECONDARY = `${BUTTON} border-2 border-bosque text-bosque`;
const TITLE = 'text-2xl font-extrabold text-petroleo outline-none';

interface ResultPageProps {
  classify?: (req: ScanRequestInput, opts?: RequestOptions) => Promise<ClassifyResponse>;
}

/** HU-17: resultado del Modo Clasificar a partir de la foto de `photoStore`. */
export function ResultPage({ classify = api.classify }: ResultPageProps) {
  const photo = usePhotoStore((s) => s.photo);
  const clearPhoto = usePhotoStore((s) => s.clear);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  // Al cambiar de estado los botones se reemplazan: el foco pasa al título para no perderse en `body`.
  useEffect(() => {
    mainRef.current?.querySelector<HTMLElement>('h1')?.focus();
  }, [state.kind]);

  useEffect(() => {
    if (!photo) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    classify({ image: photo.base64, mimeType: photo.mimeType }, { signal: controller.signal }).then(
      // Una respuesta tardía de una petición cancelada (reintento, salida) no pisa el estado actual.
      (data) => {
        if (!controller.signal.aborted) setState({ kind: 'success', data });
      },
      (err: unknown) => {
        if (controller.signal.aborted) return;
        const code = err instanceof ApiError ? err.code : 'UNEXPECTED_RESPONSE';
        setState({ kind: 'error', code, message: errorMessage(code) });
      },
    );
    return () => controller.abort();
  }, [classify, photo, attempt]);

  if (!photo) return <Navigate to="/camara" replace />;

  function retry() {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }

  /** Aborta la petición en curso y vacía el store; el `Navigate` de arriba lleva a la cámara. */
  function backToCamera() {
    controllerRef.current?.abort();
    clearPhoto();
  }

  const view = state.kind === 'success' ? toResultView(state.data) : null;

  return (
    <main ref={mainRef} className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-6 py-6">
      <img
        src={photo.previewUrl}
        alt="Tu foto"
        className="size-24 rounded-2xl border-2 border-bosque/30 bg-petroleo object-cover"
      />

      <section
        aria-live="polite"
        aria-busy={state.kind === 'loading'}
        className="flex flex-col gap-4"
      >
        {state.kind === 'loading' && <Loading />}
        {state.kind === 'success' && view && <ClassifyResult data={state.data} view={view} />}
      </section>

      {state.kind === 'error' && <ErrorNotice code={state.code} message={state.message} />}

      <Actions state={state} view={view} onRetry={retry} onBack={backToCamera} />
    </main>
  );
}

interface ActionsProps {
  state: State;
  view: ResultView | null;
  onRetry: () => void;
  onBack: () => void;
}

function Actions({ state, view, onRetry, onBack }: ActionsProps) {
  return (
    <div className="mt-auto flex flex-col gap-3">
      {actionsFor(state, view, onRetry, onBack).map(({ label, onClick, primary }) => (
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
  );
}

function actionsFor(
  state: State,
  view: ResultView | null,
  retry: () => void,
  backToCamera: () => void,
): Action[] {
  const takeAnother = { label: 'Tomar otra foto', onClick: backToCamera };
  if (state.kind === 'loading') return [{ label: 'Cancelar', onClick: backToCamera }];
  if (state.kind === 'error') {
    if (state.code === 'NOT_A_WASTE') return [{ ...takeAnother, primary: true }];
    return [{ label: 'Reintentar', onClick: retry, primary: true }, takeAnother];
  }
  if (view && isUnsure(view)) {
    return [{ label: 'Repetir foto', onClick: backToCamera, primary: true }];
  }
  if (view?.kind === 'noRule') {
    return [{ label: 'Reintentar', onClick: retry, primary: true }, takeAnother];
  }
  return [{ label: 'Escanear otro residuo', onClick: backToCamera, primary: true }];
}

function isUnsure(view: ResultView): boolean {
  return view.kind === 'unsure' || (view.kind === 'dropOff' && view.unsure);
}

function Loading() {
  return (
    <>
      <h1 tabIndex={-1} className={TITLE}>
        Analizando la foto…
      </h1>
      <div
        role="progressbar"
        aria-label="Analizando la foto"
        className="h-2 w-full overflow-hidden rounded-full bg-bosque/15"
      >
        <div className="h-full w-1/3 animate-progreso rounded-full bg-bosque motion-reduce:animate-none" />
      </div>
    </>
  );
}

function ClassifyResult({ data, view }: { data: ClassifyResponse; view: ResultView }) {
  const { object, material, materialDetail, confidence, alternatives } = data.result;
  const label = MATERIAL_LABELS[material];
  const detail = materialDetail.trim();
  const showDetail = detail !== '' && detail.toLowerCase() !== label.toLowerCase();
  // La IA puede devolver el objeto vacío: el título nunca queda en blanco.
  const title = capitalizeFirst(object.trim()) || label;
  // Solo hipótesis distintas del material principal (el backend ya lo filtra; aquí se garantiza).
  const otherMaterials = alternatives.filter((alt) => alt.material !== material).slice(0, 2);
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 tabIndex={-1} className={TITLE}>
          {title}
        </h1>
        <p className="text-base text-bosque">
          <span className="font-semibold">{label}</span>
          {showDetail && ` · ${detail}`}
        </p>
        <p className="text-sm text-bosque">Certeza: {formatPercent(confidence)}</p>
      </div>
      {isUnsure(view) && <UnsureNotice alternatives={otherMaterials} />}
      {(view.kind === 'binCard' || view.kind === 'dropOff') && <BinCard disposal={view.disposal} />}
      {view.kind === 'noRule' && (
        <p className="text-base font-semibold text-petroleo">
          No pudimos obtener dónde depositarlo; intenta de nuevo.
        </p>
      )}
    </>
  );
}

function UnsureNotice({
  alternatives,
}: {
  alternatives: ClassifyResponse['result']['alternatives'];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border-2 border-bosque bg-white p-4">
      <h2 className="text-xl font-bold text-petroleo">No estoy seguro</h2>
      {alternatives.length > 0 && (
        <>
          <p className="text-base text-bosque">También podría ser:</p>
          <ul className="list-disc pl-5 text-base text-petroleo">
            {alternatives.map((alt, i) => (
              <li key={`${alt.material}-${i}`}>
                {MATERIAL_LABELS[alt.material]} ({formatPercent(alt.confidence)})
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="text-base text-bosque">Toma otra foto con buena luz y el objeto centrado.</p>
    </div>
  );
}

function ErrorNotice({ code, message }: { code: ApiErrorCode; message: string }) {
  return (
    <div role="alert" className="flex flex-col gap-2">
      <h1 tabIndex={-1} className={TITLE}>
        {code === 'NOT_A_WASTE' ? 'No parece un residuo' : 'No pudimos analizar la foto'}
      </h1>
      <p className="text-base text-bosque">{message}</p>
    </div>
  );
}
