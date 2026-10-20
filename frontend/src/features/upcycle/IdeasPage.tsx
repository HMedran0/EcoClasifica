import type { Idea, UpcycleResponse } from '@ecoclasifica/shared';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { api } from '../../api/client';
import { useAuthStore } from '../auth/authStore';
import { RETURN_PARAM } from '../auth/returnPath';
import type { ChatLocationState } from '../chat/ChatPage';
import { capitalizeFirst } from '../classify/materialLabels';
import { FavoriteButton, useFavorite, type FavoritesApi } from '../favorites/FavoriteButton';
import { pendingActions, ScanScreen, TITLE, type ScanAction } from '../scan/ScanScreen';
import { UnsavedNotice } from '../scan/UnsavedNotice';
import { useScan, type ScanRequest } from '../scan/useScan';

type UpcycleResult = UpcycleResponse['result'];

interface IdeasPageProps {
  upcycle?: ScanRequest<UpcycleResponse>;
  favorites?: FavoritesApi;
}

/** HU-03: resultado del Modo Dar Segunda Vida. Cada idea abre su chat paso a paso (HU-10). */
export function IdeasPage({ upcycle = api.upcycle, favorites = api }: IdeasPageProps) {
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
          favorites={favorites}
          onOpenIdea={(ideaIndex) =>
            navigate('/chat', { state: { ideaIndex } satisfies ChatLocationState })
          }
        />
      )}
      <UnsavedNotice state={state} onRetry={retry} />
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

/** Vista de las ideas; también la usa el detalle del historial (HU-13). */
export function UpcycleResultView({
  result,
  onOpenIdea,
  favorites = api,
}: {
  result: UpcycleResult;
  onOpenIdea: (ideaIndex: number) => void;
  favorites?: FavoritesApi;
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
        <IdeaList ideas={result.ideas} onOpenIdea={onOpenIdea} favorites={favorites} />
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
  favorites,
}: {
  ideas: Idea[];
  onOpenIdea: (ideaIndex: number) => void;
  favorites: FavoritesApi;
}) {
  const signedIn = useAuthStore((s) => s.session !== null);
  const authReady = useAuthStore((s) => s.ready);
  return (
    <section aria-labelledby="ideas-title" className="flex flex-col gap-3">
      <h2 id="ideas-title" className="text-xl font-bold text-petroleo">
        Ideas para darle una segunda vida
      </h2>
      {authReady && !signedIn && <LoginForFavorites />}
      <ul className="flex flex-col gap-3">
        {ideas.map((idea) => (
          <IdeaCard
            key={idea.ideaIndex}
            idea={idea}
            onOpen={() => onOpenIdea(idea.ideaIndex)}
            favorites={signedIn ? favorites : null}
          />
        ))}
      </ul>
    </section>
  );
}

/** HU-12: sin sesión no hay corazón; el enlace vuelve a esta misma pantalla tras entrar. */
function LoginForFavorites() {
  const { pathname, search } = useLocation();
  const back = encodeURIComponent(`${pathname}${search}`);
  return (
    <Link
      to={`/entrar?${RETURN_PARAM}=${back}`}
      className="flex min-h-tactil items-center text-base font-semibold text-petroleo underline"
    >
      Inicia sesión para guardar tus ideas favoritas
    </Link>
  );
}

/**
 * HU-10: la tarjeta entera es un botón que abre el chat con la idea cargada. HU-12: el corazón es
 * un botón hermano (no anidado), solo con sesión y si la idea se guardó (tiene `ideaId`).
 */
function IdeaCard({
  idea,
  onOpen,
  favorites,
}: {
  idea: Idea;
  onOpen: () => void;
  favorites: FavoritesApi | null;
}) {
  const extras = idea.extraMaterials.map((m) => m.trim()).filter(Boolean);
  const id = `idea-${idea.ideaIndex}`;
  const heartId = favorites ? idea.ideaId : undefined;
  // Un botón solo admite contenido en línea: `span` en bloque en vez de encabezados y párrafos.
  return (
    <li className="relative flex flex-col gap-1">
      <button
        type="button"
        onClick={onOpen}
        aria-labelledby={`${id}-title`}
        aria-describedby={extras.length > 0 ? `${id}-desc ${id}-extras` : `${id}-desc`}
        className={`flex min-h-tactil w-full flex-col gap-2 rounded-2xl border-2 border-bosque/30 bg-white p-4 text-left ${heartId ? 'pr-16' : ''}`}
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
      {heartId && favorites && (
        <IdeaHeart ideaId={heartId} initial={idea.favoriteId ?? null} client={favorites} />
      )}
    </li>
  );
}

function IdeaHeart({
  ideaId,
  initial,
  client,
}: {
  ideaId: string;
  initial: string | null;
  client: FavoritesApi;
}) {
  const { pressed, pending, error, toggle } = useFavorite(ideaId, initial, client);
  return (
    <>
      <FavoriteButton
        pressed={pressed}
        pending={pending}
        onToggle={() => void toggle()}
        className="absolute top-2 right-2"
      />
      {error && (
        <p role="alert" className="text-sm font-semibold text-petroleo">
          {error}
        </p>
      )}
    </>
  );
}
