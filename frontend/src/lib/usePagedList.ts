import { useCallback, useEffect, useRef, useState } from 'react';
import type { RequestOptions } from '../api/client';
import { ApiError, errorMessage } from '../api/errors';

export interface Page<T> {
  items: T[];
  page: number;
  hasMore: boolean;
}

export type PageRequest<T> = (page: number, opts?: RequestOptions) => Promise<Page<T>>;

export type ListState<T> =
  | { kind: 'loading' }
  | { kind: 'ready'; items: T[]; page: number; hasMore: boolean }
  | { kind: 'error'; message: string };

/**
 * Lista paginada de 20 en 20 (historial, favoritos): primera página al montar, «Reintentar» y
 * «Cargar más». Las páginas se unen por `id` para no repetir filas desplazadas entre páginas.
 */
export function usePagedList<T extends { id: string }>(fetcher: PageRequest<T>) {
  const [state, setState] = useState<ListState<T>>({ kind: 'loading' });
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const fetchPage = useCallback(
    (page: number) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      return fetcher(page, { signal: controller.signal }).then(
        (data) => (controller.signal.aborted ? null : data),
        (err: unknown) => {
          if (controller.signal.aborted) return null;
          throw err;
        },
      );
    },
    [fetcher],
  );

  // `attempt` cambia con «Reintentar»: vuelve a pedir la primera página.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    fetchPage(1).then(
      (data) => {
        if (data) setState({ kind: 'ready', ...pick(data) });
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
          // Por id: si entre páginas se guardó una fila nueva, no se repite la que se desplazó.
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

const pick = <T>({ items, page, hasMore }: Page<T>): Page<T> => ({ items, page, hasMore });

function toMessage(err: unknown): string {
  return errorMessage(err instanceof ApiError ? err.code : 'UNEXPECTED_RESPONSE');
}
