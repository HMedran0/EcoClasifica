import type { Idea, UpcycleResponse } from '@ecoclasifica/shared';
import { Navigate, useNavigate } from 'react-router';
import { api } from '../../api/client';
import type { ChatLocationState } from '../chat/ChatPage';
import { capitalizeFirst } from '../classify/materialLabels';
import { pendingActions, ScanScreen, TITLE, type ScanAction } from '../scan/ScanScreen';
import { useScan, type ScanRequest } from '../scan/useScan';

type UpcycleResult = UpcycleResponse['result'];

interface IdeasPageProps {
  upcycle?: ScanRequest<UpcycleResponse>;
}

/** HU-03: resultado del Modo Dar Segunda Vida. Cada idea abre su chat paso a paso (HU-10). */
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
      {result && (
        <UpcycleResultView
          result={result}
          onOpenIdea={(ideaIndex) =>
            navigate('/chat', { state: { ideaIndex } satisfies ChatLocationState })
          }
        />
      )}
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

function UpcycleResultView({
  result,
  onOpenIdea,
}: {
  result: UpcycleResult;
  onOpenIdea: (ideaIndex: number) => void;
}) {
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
        <IdeaList ideas={result.ideas} onOpenIdea={onOpenIdea} />
      ) : (
        <div className="flex flex-col gap-2 rounded-2xl border-2 border-bosque bg-white p-4">
          <h2 className="text-xl font-bold text-petroleo">Mejor no reutilizarlo</h2>
          <p className="text-base text-bosque">{result.reason}</p>
        </div>
      )}
    </>
  );
}

function IdeaList({
  ideas,
  onOpenIdea,
}: {
  ideas: Idea[];
  onOpenIdea: (ideaIndex: number) => void;
}) {
  return (
    <section aria-labelledby="ideas-title" className="flex flex-col gap-3">
      <h2 id="ideas-title" className="text-xl font-bold text-petroleo">
        Ideas para darle una segunda vida
      </h2>
      <ul className="flex flex-col gap-3">
        {ideas.map((idea) => (
          <IdeaCard key={idea.ideaIndex} idea={idea} onOpen={() => onOpenIdea(idea.ideaIndex)} />
        ))}
      </ul>
    </section>
  );
}

/** HU-10: la tarjeta entera es un botón que abre el chat con la idea cargada. */
function IdeaCard({ idea, onOpen }: { idea: Idea; onOpen: () => void }) {
  const extras = idea.extraMaterials.map((m) => m.trim()).filter(Boolean);
  const id = `idea-${idea.ideaIndex}`;
  // Un botón solo admite contenido en línea: `span` en bloque en vez de encabezados y párrafos.
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-labelledby={`${id}-title`}
        aria-describedby={extras.length > 0 ? `${id}-desc ${id}-extras` : `${id}-desc`}
        className="flex min-h-tactil w-full flex-col gap-2 rounded-2xl border-2 border-bosque/30 bg-white p-4 text-left"
      >
        <span id={`${id}-title`} className="text-lg font-bold text-petroleo">
          {idea.title}
        </span>

        <span id={`${id}-desc`} className="text-base text-bosque">
          {idea.description}
        </span>
        {extras.length > 0 && (
          <span id={`${id}-extras`} className="text-sm text-bosque">
            <span className="font-semibold">Necesitas además:</span> {extras.join(', ')}
          </span>
        )}
        <span aria-hidden="true" className="text-sm font-semibold text-petroleo underline">
          Ver cómo hacerla →
        </span>
      </button>
    </li>
  );
}
