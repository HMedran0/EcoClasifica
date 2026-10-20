import type { ClassifyResponse } from '@ecoclasifica/shared';
import { Navigate } from 'react-router';
import { api } from '../../api/client';
import { pendingActions, ScanScreen, TITLE, type ScanAction } from '../scan/ScanScreen';
import { useScan, type ScanRequest } from '../scan/useScan';
import { BinCard } from './BinCard';
import { capitalizeFirst, formatPercent, MATERIAL_LABELS } from './materialLabels';
import { toResultView, type ResultView } from './resultView';

interface ResultPageProps {
  classify?: ScanRequest<ClassifyResponse>;
}

/** HU-17: resultado del Modo Clasificar a partir de la foto de `photoStore`. */
export function ResultPage({ classify = api.classify }: ResultPageProps) {
  const { photo, state, retry, backToCamera } = useScan('classify', classify);
  if (!photo) return <Navigate to="/camara" replace />;

  const view = state.kind === 'success' ? toResultView(state.data) : null;
  const actions =
    pendingActions(state, retry, backToCamera) ?? successActions(view, retry, backToCamera);

  return (
    <ScanScreen
      mode="classify"
      previewUrl={photo.previewUrl}
      state={state}
      loadingLabel="Analizando la foto"
      actions={actions}
    >
      {state.kind === 'success' && view && <ClassifyResult data={state.data} view={view} />}
    </ScanScreen>
  );
}

function successActions(
  view: ResultView | null,
  retry: () => void,
  backToCamera: () => void,
): ScanAction[] {
  if (view && isUnsure(view)) {
    return [{ label: 'Repetir foto', onClick: backToCamera, primary: true }];
  }
  if (view?.kind === 'noRule') {
    return [
      { label: 'Reintentar', onClick: retry, primary: true },
      { label: 'Tomar otra foto', onClick: backToCamera },
    ];
  }
  return [{ label: 'Escanear otro residuo', onClick: backToCamera, primary: true }];
}

function isUnsure(view: ResultView): boolean {
  return view.kind === 'unsure' || (view.kind === 'dropOff' && view.unsure);
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
