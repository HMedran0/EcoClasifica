import type { DeleteHistoryResponse, HistoryItem, HistoryListResponse } from '@ecoclasifica/shared';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { api, type RequestOptions } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { usePagedList } from '../../lib/usePagedList';
import { ModeBadge } from '../camera/ModeSwitch';
import { PRIMARY, SECONDARY, TITLE } from '../scan/ScanScreen';
import { DELETE_BUTTON, DELETE_WARNING, historyDeleted } from './deleteCopy';
import { forgetDeleted } from './forgetDeleted';
import { formatScanDate } from './formatDate';
import { useConfirmedDelete } from './useConfirmedDelete';

export type HistoryRequest = (page: number, opts?: RequestOptions) => Promise<HistoryListResponse>;
export type DeleteHistoryRequest = (opts?: RequestOptions) => Promise<DeleteHistoryResponse>;

interface HistoryPageProps {
  history?: HistoryRequest;
  deleteAll?: DeleteHistoryRequest;
}

/** HU-13: escaneos guardados, más recientes primero, de 20 en 20. HU-14: borrar todo. */
export function HistoryPage({
  history = api.history,
  deleteAll = api.deleteHistory,
}: HistoryPageProps) {
  const { state, loadingMore, moreError, load, loadMore } = usePagedList(history);
  const [notice, setNotice] = useNotice();
  const flow = useConfirmedDelete(
    () => deleteAll(),
    ({ deleted }) => {
      forgetDeleted('all');
      setNotice(historyDeleted(deleted));
      load();
    },
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-6 py-6">
      <h1 className={TITLE}>Mi historial</h1>
      <Notice text={notice} />

      {state.kind === 'loading' && (
        <p role="status" className="text-base text-bosque">
          Cargando tu historial…
        </p>
      )}
      {state.kind === 'error' && (
        <div role="alert" className="flex flex-col gap-3">
          <p className="text-base text-bosque">{state.message}</p>
          <button type="button" className={PRIMARY} onClick={load}>
            Reintentar
          </button>
        </div>
      )}
      {state.kind === 'ready' && state.items.length === 0 && (
        <p className="text-base text-bosque">Aún no tienes escaneos guardados.</p>
      )}
      {state.kind === 'ready' && state.items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {state.items.map((item) => (
            <HistoryRow key={item.id} item={item} />
          ))}
        </ul>
      )}

      {moreError && (
        <p role="alert" className="text-base font-semibold text-red-700">
          {moreError}
        </p>
      )}
      <div className="mt-auto flex flex-col gap-3">
        {state.kind === 'ready' && state.hasMore && (
          <button type="button" className={PRIMARY} onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Cargando…' : 'Cargar más'}
          </button>
        )}
        {state.kind === 'ready' && state.items.length > 0 && (
          <button type="button" className={DELETE_BUTTON} onClick={flow.ask}>
            Eliminar todo mi historial
          </button>
        )}
        <Link to="/" className={SECONDARY}>
          Volver al inicio
        </Link>
      </div>
      {flow.open && (
        <ConfirmDialog
          title="¿Eliminar todo tu historial?"
          message={DELETE_WARNING}
          confirmLabel="Eliminar todo"
          onConfirm={flow.confirm}
          onCancel={flow.cancel}
          busy={flow.busy}
          error={flow.error}
        />
      )}
    </main>
  );
}

/**
 * Aviso tras borrar: llega del detalle por el estado de navegación o se fija aquí. Se quita del
 * estado de navegación para que no reaparezca al volver atrás o recargar.
 */
function useNotice() {
  const { pathname, state } = useLocation();
  const navigate = useNavigate();
  const fromState = readNotice(state);
  const [notice, setNotice] = useState(fromState);

  useEffect(() => {
    if (fromState) navigate(pathname, { replace: true, state: null });
  }, [fromState, navigate, pathname]);

  return [notice, setNotice] as const;
}

function readNotice(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || !('notice' in state)) return null;
  const { notice } = state as { notice: unknown };
  return typeof notice === 'string' ? notice : null;
}

/** El foco va al aviso: el botón que abrió el diálogo ya no existe o es de otra pantalla. */
function Notice({ text }: { text: string | null }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (text) ref.current?.focus();
  }, [text]);
  if (!text) return null;
  return (
    <p
      ref={ref}
      tabIndex={-1}
      role="status"
      className="rounded-2xl border-2 border-bosque/30 bg-white p-3 text-base font-semibold text-bosque outline-none"
    >
      {text}
    </p>
  );
}

function HistoryRow({ item }: { item: HistoryItem }) {
  return (
    <li>
      <Link
        to={`/historial/${item.id}`}
        className="flex min-h-tactil items-center gap-3 rounded-2xl border-2 border-bosque/30 bg-white p-3"
      >
        {item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt=""
            loading="lazy"
            className="size-16 shrink-0 rounded-xl bg-petroleo object-cover"
          />
        ) : (
          <span aria-hidden="true" className="size-16 shrink-0 rounded-xl bg-bosque/15" />
        )}
        {/* `div`: `ModeBadge` es un párrafo y no cabe dentro de un `span`. */}
        <div className="flex min-w-0 flex-col items-start gap-1">
          <ModeBadge mode={item.mode} />
          <span className="max-w-full truncate text-lg font-bold text-petroleo">
            {item.objectName}
          </span>
          <span className="text-sm text-bosque">{item.summary}</span>
          <time dateTime={item.createdAt} className="text-sm text-bosque">
            {formatScanDate(item.createdAt)}
          </time>
        </div>
      </Link>
    </li>
  );
}
