import type { ClassifyResponse, HistoryDetail } from '@ecoclasifica/shared';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, type RequestOptions } from '../../api/client';
import { ApiError, errorMessage } from '../../api/errors';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ModeBadge } from '../camera/ModeSwitch';
import type { ChatLocationState } from '../chat/ChatPage';
import { toChatIdea } from '../chat/chatIdea';
import { ClassifyResult } from '../classify/ResultPage';
import type { FavoritesApi } from '../favorites/FavoriteButton';
import { setFavorites } from '../favorites/favoritesStore';
import { toResultView } from '../classify/resultView';
import { PRIMARY, SECONDARY, TITLE } from '../scan/ScanScreen';
import { UpcycleResultView } from '../upcycle/IdeasPage';
import { forgetDeleted } from './forgetDeleted';
import { formatScanDate } from './formatDate';
import {
  DELETE_BUTTON,
  DELETE_WARNING,
  SCAN_DELETED,
  type HistoryLocationState,
} from './deleteCopy';
import { useConfirmedDelete } from './useConfirmedDelete';

export type HistoryItemRequest = (id: string, opts?: RequestOptions) => Promise<HistoryDetail>;
export type DeleteItemRequest = (id: string, opts?: RequestOptions) => Promise<void>;

interface HistoryDetailPageProps {
  historyItem?: HistoryItemRequest;
  deleteItem?: DeleteItemRequest;
  favorites?: FavoritesApi;
}

type DetailState =
  | { kind: 'loading' }
  | { kind: 'ready'; detail: HistoryDetail }
  | { kind: 'error'; message: string; retryable: boolean };

/** HU-13: un escaneo guardado, mostrado desde su copia (sin volver a llamar a la IA). */
export function HistoryDetailPage({
  historyItem = api.historyItem,
  deleteItem = api.deleteHistoryItem,
  favorites = api,
}: HistoryDetailPageProps) {
  const { id = '' } = useParams();
  const [attempt, setAttempt] = useState(0);
  // La respuesta guarda a qué petición pertenece: otro id o un reintento vuelven a «cargando».
  const requestKey = `${id}#${attempt}`;
  const [settled, setSettled] = useState<{ key: string; state: DetailState } | null>(null);
  const state: DetailState = settled?.key === requestKey ? settled.state : { kind: 'loading' };
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const key = `${id}#${attempt}`;
    historyItem(id, { signal: controller.signal }).then(
      (detail) => {
        if (controller.signal.aborted) return;
        // El servidor sabe qué ideas son favoritas: alimenta el store que leen los corazones.
        setFavorites(favoriteEntries(detail));
        setSettled({ key, state: { kind: 'ready', detail } });
      },
      (err: unknown) => {
        if (!controller.signal.aborted) setSettled({ key, state: toErrorState(err) });
      },
    );
    return () => controller.abort();
  }, [historyItem, id, attempt]);

  // Al cambiar de estado, el foco pasa al título (igual que en las pantallas de resultado).
  useEffect(() => {
    mainRef.current?.querySelector<HTMLElement>('h1')?.focus();
  }, [state.kind]);

  return (
    <main ref={mainRef} className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-6 py-6">
      {state.kind === 'loading' && (
        <h1 tabIndex={-1} className={TITLE} role="status">
          Cargando el escaneo…
        </h1>
      )}
      {state.kind === 'error' && (
        <div role="alert" className="flex flex-col gap-2">
          <h1 tabIndex={-1} className={TITLE}>
            No pudimos abrir el escaneo
          </h1>
          <p className="text-base text-bosque">{state.message}</p>
        </div>
      )}
      {state.kind === 'ready' && <SavedScan detail={state.detail} favorites={favorites} />}

      <div className="mt-auto flex flex-col gap-3">
        {state.kind === 'ready' && <DeleteScan detail={state.detail} deleteItem={deleteItem} />}
        {state.kind === 'error' && state.retryable && (
          <button type="button" className={PRIMARY} onClick={() => setAttempt((n) => n + 1)}>
            Reintentar
          </button>
        )}
        <Link to="/historial" className={SECONDARY}>
          Volver al historial
        </Link>
      </div>
    </main>
  );
}

/** HU-14: «Eliminar escaneo» con confirmación; al terminar vuelve a /historial con un aviso. */
function DeleteScan({
  detail,
  deleteItem,
}: {
  detail: HistoryDetail;
  deleteItem: DeleteItemRequest;
}) {
  const navigate = useNavigate();
  const flow = useConfirmedDelete(
    // Si ya no existía (otro dispositivo lo borró), el resultado para el usuario es el mismo.
    () =>
      deleteItem(detail.id).catch((err: unknown) => {
        if (!(err instanceof ApiError && err.code === 'NOT_FOUND')) throw err;
      }),
    () => {
      forgetDeleted({ scanId: detail.id, ideaIds: savedIdeaIds(detail) });
      const state: HistoryLocationState = { notice: SCAN_DELETED };
      navigate('/historial', { state });
    },
  );
  return (
    <>
      <button type="button" className={DELETE_BUTTON} onClick={flow.ask}>
        Eliminar escaneo
      </button>
      {flow.open && (
        <ConfirmDialog
          title="¿Eliminar este escaneo?"
          message={DELETE_WARNING}
          confirmLabel="Eliminar"
          onConfirm={flow.confirm}
          onCancel={flow.cancel}
          busy={flow.busy}
          error={flow.error}
        />
      )}
    </>
  );
}

function savedIdeaIds(detail: HistoryDetail): string[] {
  if (detail.mode !== 'upcycle' || !detail.result.canUpcycle) return [];
  return detail.result.ideas.flatMap((idea) => (idea.ideaId ? [idea.ideaId] : []));
}

function toErrorState(err: unknown): DetailState {
  const code = err instanceof ApiError ? err.code : 'UNEXPECTED_RESPONSE';
  if (code === 'NOT_FOUND') {
    return {
      kind: 'error',
      message: 'No encontramos ese escaneo en tu historial.',
      retryable: false,
    };
  }
  return { kind: 'error', message: errorMessage(code), retryable: true };
}

/** `ideaId → favoriteId` de las ideas guardadas que trae el detalle (HU-12). */
function favoriteEntries(detail: HistoryDetail): Record<string, string | null> {
  if (detail.mode !== 'upcycle' || !detail.result.canUpcycle) return {};
  const entries: Record<string, string | null> = {};
  for (const { ideaId, favoriteId } of detail.result.ideas) {
    if (ideaId && favoriteId !== undefined) entries[ideaId] = favoriteId;
  }
  return entries;
}

function SavedScan({ detail, favorites }: { detail: HistoryDetail; favorites: FavoritesApi }) {
  const navigate = useNavigate();
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        {detail.imageUrl ? (
          <img
            src={detail.imageUrl}
            alt="Tu foto"
            className="size-24 rounded-2xl border-2 border-bosque/30 bg-petroleo object-cover"
          />
        ) : (
          <span aria-hidden="true" className="size-24 rounded-2xl bg-bosque/15" />
        )}
        <div className="flex flex-col items-end gap-2">
          <ModeBadge mode={detail.mode} />
          <time dateTime={detail.createdAt} className="text-sm text-bosque">
            {formatScanDate(detail.createdAt)}
          </time>
        </div>
      </div>
      <section className="flex flex-col gap-4">
        {detail.mode === 'classify' ? (
          <SavedClassify detail={detail} />
        ) : (
          <UpcycleResultView
            result={detail.result}
            favorites={favorites}
            onOpenIdea={(ideaIndex) => {
              const state = chatState(detail, ideaIndex);
              if (state) navigate('/chat', { state });
            }}
          />
        )}
      </section>
    </>
  );
}

function SavedClassify({ detail }: { detail: Extract<HistoryDetail, { mode: 'classify' }> }) {
  // Misma forma que la respuesta original: la vista de resultado se reutiliza tal cual.
  const data: ClassifyResponse = {
    scanId: detail.id,
    mode: 'classify',
    result: detail.result,
    disposal: detail.disposal,
    saved: true,
  };
  return <ClassifyResult data={data} view={toResultView(data)} />;
}

function chatState(
  detail: Extract<HistoryDetail, { mode: 'upcycle' }>,
  ideaIndex: number,
): ChatLocationState | null {
  const { result } = detail;
  if (!result.canUpcycle) return null;
  const idea = result.ideas.find((i) => i.ideaIndex === ideaIndex);
  if (!idea) return null;
  return {
    ideaIndex,
    saved: {
      scanId: detail.id,
      ...(idea.ideaId ? { ideaId: idea.ideaId } : {}),
      idea: toChatIdea(result.objectName, idea),
    },
  };
}
