import type { HistoryItem, HistoryListResponse } from '@ecoclasifica/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, type RequestOptions } from '../../api/client';
import { ApiError, errorMessage } from '../../api/errors';
import { ModeBadge } from '../camera/ModeSwitch';
import { PRIMARY, SECONDARY, TITLE } from '../scan/ScanScreen';
import { formatScanDate } from './formatDate';

export type HistoryRequest = (page: number, opts?: RequestOptions) => Promise<HistoryListResponse>;

interface HistoryPageProps {
  history?: HistoryRequest;
}

type ListState =
  | { kind: 'loading' }
  | { kind: 'ready'; items: HistoryItem[]; page: number; hasMore: boolean }
  | { kind: 'error'; message: string };

/** HU-13: escaneos guardados, más recientes primero, de 20 en 20. */
export function HistoryPage({ history = api.history }: HistoryPageProps) {
  const { state, loadingMore, moreError, load, loadMore } = useHistoryList(history);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-6 py-6">
      <h1 className={TITLE}>Mi historial</h1>

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
        <Link to="/" className={SECONDARY}>
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}

function useHistoryList(history: HistoryRequest) {
  const [state, setState] = useState<ListState>({ kind: 'loading' });
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const fetchPage = useCallback(
    (page: number) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      return history(page, { signal: controller.signal }).then(
        (data) => (controller.signal.aborted ? null : data),
        (err: unknown) => {
          if (controller.signal.aborted) return null;
          throw err;
        },
      );
    },
    [history],
  );

  // `attempt` cambia con «Reintentar»: vuelve a pedir la primera página.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    fetchPage(1).then(
      (data) => {
        if (data) setState({ kind: 'ready', ...data });
      },
      (err: unknown) => setState({ kind: 'error', message: toMessage(err) }),
    );
    return () => controllerRef.current?.abort();
  }, [fetchPage, attempt]);

  function load() {
    setState({ kind: 'loading' });
    setMoreError(null);
    setAttempt((n) => n + 1);
  }

  function loadMore() {
    if (state.kind !== 'ready' || loadingMore) return;
    setLoadingMore(true);
    setMoreError(null);
    fetchPage(state.page + 1)
      .then(
        (data) => {
          if (!data) return;
          // Por id: si entre páginas se guardó un escaneo nuevo, no se repite el que se desplazó.
          setState((prev) => {
            if (prev.kind !== 'ready') return prev;
            const seen = new Set(prev.items.map((i) => i.id));
            const items = [...prev.items, ...data.items.filter((i) => !seen.has(i.id))];
            return { kind: 'ready', items, page: data.page, hasMore: data.hasMore };
          });
        },
        (err: unknown) => setMoreError(toMessage(err)),
      )
      .finally(() => setLoadingMore(false));
  }

  return { state, loadingMore, moreError, load, loadMore };
}

function toMessage(err: unknown): string {
  return errorMessage(err instanceof ApiError ? err.code : 'UNEXPECTED_RESPONSE');
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
