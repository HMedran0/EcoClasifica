import type { Idea, UpcycleResponse } from '@ecoclasifica/shared';
import { Navigate, useNavigate } from 'react-router';
import { api } from '../../api/client';
import { capitalizeFirst } from '../classify/materialLabels';
import { pendingActions, ScanScreen, TITLE, type ScanAction } from '../scan/ScanScreen';
import { useScan, type ScanRequest } from '../scan/useScan';

type UpcycleResult = UpcycleResponse['result'];

interface IdeasPageProps {
  upcycle?: ScanRequest<UpcycleResponse>;
}

/** HU-03: resultado del Modo Dar Segunda Vida. La guía paso a paso de cada idea llega en HU-10. */
export function IdeasPage({ upcycle = api.upcycle }: IdeasPageProps) {
  const navigate = useNavigate();
  const { photo, state, retry, backToCamera } = useScan('upcycle', upcycle);
  if (!photo) return <Navigate to="/camara" replace />;

  const result = state.kind === 'success' ? state.data.result : null;
  // «Ver dónde depositarlo» reutiliza la foto del store: /resultado la envía a classify.
  const actions =
    pendingActions(state, retry, backToCamera) ??
    successActions(result, () => navigate('/resultado'), backToCamera);

  return (
    <ScanScreen
      mode="upcycle"
      previewUrl={photo.previewUrl}
      state={state}
      loadingLabel="Buscando ideas"
      actions={actions}
    >
      {result && <UpcycleResultView result={result} />}
    </ScanScreen>
  );
}

function successActions(
  result: UpcycleResult | null,
  toClassify: () => void,
  backToCamera: () => void,
): ScanAction[] {
  if (result && !result.canUpcycle) {
    return [
      { label: 'Ver dónde depositarlo', onClick: toClassify, primary: true },
      { label: 'Tomar otra foto', onClick: backToCamera },
    ];
  }
  return [{ label: 'Escanear otro residuo', onClick: backToCamera, primary: true }];
}

function UpcycleResultView({ result }: { result: UpcycleResult }) {
  // La IA puede devolver el nombre vacío: el título nunca queda en blanco.
  const title = capitalizeFirst(result.objectName.trim()) || 'Tu residuo';
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 tabIndex={-1} className={TITLE}>
          {title}
        </h1>
        {result.canUpcycle && (
          <p className="text-base text-bosque">
            Dificultad: <span className="font-semibold">{result.difficulty}</span>
          </p>
        )}
      </div>
      {result.canUpcycle ? (
        <IdeaList ideas={result.ideas} />
      ) : (
        <div className="flex flex-col gap-2 rounded-2xl border-2 border-bosque bg-white p-4">
          <h2 className="text-xl font-bold text-petroleo">Mejor no reutilizarlo</h2>
          <p className="text-base text-bosque">{result.reason}</p>
        </div>
      )}
    </>
  );
}

function IdeaList({ ideas }: { ideas: Idea[] }) {
  return (
    <section aria-labelledby="ideas-title" className="flex flex-col gap-3">
      <h2 id="ideas-title" className="text-xl font-bold text-petroleo">
        Ideas para darle una segunda vida
      </h2>
      <ul className="flex flex-col gap-3">
        {ideas.map((idea) => (
          <IdeaCard key={idea.ideaIndex} idea={idea} />
        ))}
      </ul>
    </section>
  );
}

/** Tarjeta no interactiva hasta HU-10 (guía paso a paso). */
function IdeaCard({ idea }: { idea: Idea }) {
  const extras = idea.extraMaterials.map((m) => m.trim()).filter(Boolean);
  return (
    <li className="flex flex-col gap-2 rounded-2xl border-2 border-bosque/30 bg-white p-4">
      <h3 className="text-lg font-bold text-petroleo">{idea.title}</h3>
      <p className="text-base text-bosque">{idea.description}</p>
      {extras.length > 0 && (
        <p className="text-sm text-bosque">
          <span className="font-semibold">Necesitas además:</span> {extras.join(', ')}
        </p>
      )}
      <p className="text-sm text-bosque italic">Pronto: guía paso a paso</p>
    </li>
  );
}
