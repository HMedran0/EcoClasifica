import { useRef, useState } from 'react';
import { api, type RequestOptions } from '../../api/client';
import { ApiError } from '../../api/errors';
import { useAuthStore } from '../auth/authStore';
import { setFavorites, useFavoritesStore } from './favoritesStore';

export interface FavoritesApi {
  addFavorite: (ideaId: string, opts?: RequestOptions) => Promise<{ id: string }>;
  removeFavorite: (favoriteId: string, opts?: RequestOptions) => Promise<void>;
}

const ADD_FAILED = 'No pudimos guardar la idea en tus favoritos. Inténtalo de nuevo.';
const REMOVE_FAILED = 'No pudimos quitar la idea de tus favoritos. Inténtalo de nuevo.';

/**
 * HU-12: estado del corazón de una idea guardada. Lee primero del store compartido; si la idea
 * aún no está ahí, usa el `favoriteId` que trajo la respuesta. Optimista: se marca al tocar y se
 * revierte si falla. Mientras hay una petición en curso no admite otra (no se cruzan POST y DELETE).
 */
export function useFavorite(
  ideaId: string,
  initial: string | null = null,
  client: FavoritesApi = api,
) {
  const stored = useFavoritesStore((s) => s.byIdea[ideaId]);
  const favoriteId = stored === undefined ? initial : stored;
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function toggle() {
    if (inFlight.current) return;
    inFlight.current = true;
    const adding = favoriteId === null;
    setOptimistic(adding);
    setError(null);
    // Si la sesión cambia con la petición en vuelo, su resultado no debe volver al store vaciado.
    const owner = currentUserId();
    const remember = (value: string | null) => {
      if (currentUserId() === owner) setFavorites({ [ideaId]: value });
    };
    try {
      if (favoriteId === null) {
        const favorite = await client.addFavorite(ideaId);
        remember(favorite.id);
      } else {
        await client.removeFavorite(favoriteId).catch((err: unknown) => {
          // Ya no existía (quitada en otro dispositivo): el resultado es el mismo.
          if (!(err instanceof ApiError && err.code === 'NOT_FOUND')) throw err;
        });
        remember(null);
      }
    } catch {
      setError(adding ? ADD_FAILED : REMOVE_FAILED);
    } finally {
      inFlight.current = false;
      setOptimistic(null);
    }
  }

  return {
    pressed: optimistic ?? favoriteId !== null,
    pending: optimistic !== null,
    error,
    toggle,
  };
}

const currentUserId = () => useAuthStore.getState().session?.user.id ?? null;

/** Corazón de 48 px. Es un botón propio, fuera de la tarjeta: tocarlo no abre el chat. */
export function FavoriteButton({
  pressed,
  pending,
  onToggle,
  className = '',
}: {
  pressed: boolean;
  pending: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-busy={pending}
      aria-label={pressed ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      disabled={pending}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={`flex min-h-tactil min-w-tactil items-center justify-center rounded-full text-petroleo disabled:opacity-60 ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-7"
        fill={pressed ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      >
        <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.6 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.6 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" />
      </svg>
    </button>
  );
}
