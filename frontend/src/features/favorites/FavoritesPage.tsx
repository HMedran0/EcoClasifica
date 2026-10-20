import type { Favorite, FavoritesListResponse } from '@ecoclasifica/shared';
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, type RequestOptions } from '../../api/client';
import { usePagedList } from '../../lib/usePagedList';
import type { ChatLocationState } from '../chat/ChatPage';
import { toChatIdea } from '../chat/chatIdea';
import { PRIMARY, SECONDARY, TITLE } from '../scan/ScanScreen';
import { FavoriteButton, useFavorite, type FavoritesApi } from './FavoriteButton';
import { setFavorites, useFavoritesStore } from './favoritesStore';

export type FavoritesRequest = (
  page: number,
  opts?: RequestOptions,
) => Promise<FavoritesListResponse>;

interface FavoritesPageProps {
  list?: FavoritesRequest;
  client?: FavoritesApi;
}

/**
 * Clave del corazón en el store. Un favorito cuyo escaneo se borró no tiene `ideaId`: usa una
 * propia que solo sirve para quitarlo (desde aquí no se vuelve a guardar).
 */
const heartKey = (favorite: Favorite) => favorite.ideaId ?? `favorito:${favorite.id}`;

/** HU-15: ideas guardadas, más recientes primero, de 20 en 20. Cada una retoma su chat. */
export function FavoritesPage({ list = api.favorites, client = api }: FavoritesPageProps) {
  const { state, loadingMore, moreError, load, loadMore } = usePagedList(list);
  const byIdea = useFavoritesStore((s) => s.byIdea);
  const items = state.kind === 'ready' ? state.items : null;

  // Lo que dice el servidor es la verdad para los corazones de /ideas y del historial.
  useEffect(() => {
    if (items) setFavorites(Object.fromEntries(items.map((f) => [heartKey(f), f.id])));
  }, [items]);

  // Al quitar uno (confirmado por el servidor), sale de la lista.
  const visible = items?.filter((f) => byIdea[heartKey(f)] !== null) ?? [];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-6 py-6">
      <h1 className={TITLE}>Mis favoritos</h1>

      {state.kind === 'loading' && (
        <p role="status" className="text-base text-bosque">
          Cargando tus favoritos…
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
      {state.kind === 'ready' && visible.length === 0 && !state.hasMore && (
        <p className="text-base text-bosque">Aún no guardas ideas.</p>
      )}
      {visible.length > 0 && (
        <ul className="flex flex-col gap-3">
          {visible.map((favorite) => (
            <FavoriteCard key={favorite.id} favorite={favorite} client={client} />
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

/** Como en /ideas: la tarjeta abre el chat y el corazón es un botón hermano (no anidado). */
function FavoriteCard({ favorite, client }: { favorite: Favorite; client: FavoritesApi }) {
  const navigate = useNavigate();
  const { pressed, pending, error, toggle } = useFavorite(heartKey(favorite), favorite.id, client);
  const extras = favorite.extraMaterials.map((m) => m.trim()).filter(Boolean);
  const id = `favorito-${favorite.id}`;

  function open() {
    const state: ChatLocationState = {
      favorite: {
        id: favorite.id,
        ideaId: favorite.ideaId,
        idea: toChatIdea(favorite.objectName, favorite),
      },
    };
    navigate('/chat', { state });
  }

  // Un botón solo admite contenido en línea: `span` en bloque en vez de encabezados y párrafos.
  return (
    <li className="relative flex flex-col gap-1">
      <button
        type="button"
        onClick={open}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-object ${id}-desc${extras.length > 0 ? ` ${id}-extras` : ''}`}
        className="flex min-h-tactil w-full flex-col gap-2 rounded-2xl border-2 border-bosque/30 bg-white p-4 pr-16 text-left"
      >
        <span id={`${id}-object`} className="text-sm text-bosque">
          {favorite.objectName}
          {favorite.difficulty && ` · Dificultad: ${favorite.difficulty}`}
        </span>
        <span id={`${id}-title`} className="text-lg font-bold text-petroleo">
          {favorite.title}
        </span>
        <span id={`${id}-desc`} className="text-base text-bosque">
          {favorite.description}
        </span>
        {extras.length > 0 && (
          <span id={`${id}-extras`} className="text-sm text-bosque">
            <span className="font-semibold">Necesitas además:</span> {extras.join(', ')}
          </span>
        )}
        <span aria-hidden="true" className="text-sm font-semibold text-petroleo underline">
          Retomar el chat →
        </span>
      </button>
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
    </li>
  );
}
