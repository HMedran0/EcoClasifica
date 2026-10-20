import type { HistoryDetail, UpcycleResponse } from '@ecoclasifica/shared';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/errors';
import { fakeSession } from '../../test/supabaseMock';
import { useAuthStore } from '../auth/authStore';
import { usePhotoStore } from '../camera/photoStore';
import { HistoryDetailPage } from '../history/HistoryDetailPage';
import { IdeasPage } from '../upcycle/IdeasPage';
import type { FavoritesApi } from './FavoriteButton';
import { clearFavorites, useFavoritesStore } from './favoritesStore';

const IDEA_IDS = [
  '1f8d4c2b-3a5e-4d7f-8b9c-2e3f4a5b6c70',
  '1f8d4c2b-3a5e-4d7f-8b9c-2e3f4a5b6c71',
  '1f8d4c2b-3a5e-4d7f-8b9c-2e3f4a5b6c72',
] as const;
const FAVORITE_ID = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const SCAN_ID = '0e7c3b1a-2f4d-4c6e-9a8b-1d2e3f4a5b6c';

const storedPhoto = {
  id: 1,
  base64: 'a'.repeat(200),
  mimeType: 'image/jpeg' as const,
  width: 768,
  height: 576,
  bytes: 150,
  previewUrl: 'blob:preview',
};

const ideasResult = (withIds: boolean) => ({
  canUpcycle: true as const,
  objectName: 'frasco de vidrio',
  difficulty: 'Fácil' as const,
  ideas: ['Portalápices', 'Maceta', 'Lámpara'].map((title, ideaIndex) => ({
    ideaIndex,
    ...(withIds ? { ideaId: IDEA_IDS[ideaIndex] } : {}),
    title,
    description: 'd',
    extraMaterials: [],
  })),
});

const savedIdeas: UpcycleResponse = {
  scanId: SCAN_ID,
  mode: 'upcycle',
  result: ideasResult(true),
  saved: true,
};

const unsavedIdeas: UpcycleResponse = {
  scanId: null,
  mode: 'upcycle',
  result: ideasResult(false),
  saved: false,
};

/** Promesa que la prueba resuelve o rechaza cuando quiere (para ver el estado optimista). */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const fakeFavorites = () => ({
  addFavorite: vi.fn<FavoritesApi['addFavorite']>().mockResolvedValue({ id: FAVORITE_ID }),
  removeFavorite: vi.fn<FavoritesApi['removeFavorite']>().mockResolvedValue(undefined),
});

function renderIdeas(response: UpcycleResponse, favorites: FavoritesApi = fakeFavorites()) {
  const upcycle = vi.fn().mockResolvedValue(response);
  render(
    <MemoryRouter initialEntries={['/ideas']}>
      <Routes>
        <Route path="/ideas" element={<IdeasPage upcycle={upcycle} favorites={favorites} />} />
        <Route
          path="/chat"
          element={
            <>
              <p>Pantalla de chat</p>
              <Link to="/ideas">Volver a las ideas</Link>
            </>
          }
        />
        <Route path="/entrar" element={<p>Pantalla de entrar</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return { upcycle };
}

const heart = (name: 'Guardar en favoritos' | 'Quitar de favoritos') =>
  screen.getAllByRole('button', { name })[0] as HTMLElement;

const signIn = () => useAuthStore.setState({ session: fakeSession(), ready: true });

beforeEach(() => {
  URL.revokeObjectURL = vi.fn();
  usePhotoStore.setState({ photo: storedPhoto, results: {} });
  clearFavorites();
  signIn();
});

describe('Corazón en /ideas (HU-12)', () => {
  it('con sesión y escaneo guardado: un corazón de 48 px por idea, sin marcar', async () => {
    renderIdeas(savedIdeas);
    await screen.findByRole('heading', { level: 1, name: 'Frasco de vidrio' });

    const hearts = screen.getAllByRole('button', { name: 'Guardar en favoritos' });
    expect(hearts).toHaveLength(3);
    expect(hearts[0]).toHaveAttribute('aria-pressed', 'false');
    expect(hearts[0]).toHaveClass('min-h-tactil', 'min-w-tactil');
  });

  it('marca de forma optimista y queda guardado al responder', async () => {
    const favorites = fakeFavorites();
    const pending = deferred<{ id: string }>();
    favorites.addFavorite.mockReturnValue(pending.promise);
    renderIdeas(savedIdeas, favorites);
    await screen.findByRole('heading', { level: 1, name: 'Frasco de vidrio' });

    fireEvent.click(heart('Guardar en favoritos'));

    const pressed = heart('Quitar de favoritos');
    expect(pressed).toHaveAttribute('aria-pressed', 'true');
    expect(pressed).toHaveAttribute('aria-busy', 'true');
    expect(pressed).toBeDisabled();
    expect(favorites.addFavorite).toHaveBeenCalledWith(IDEA_IDS[0]);

    await act(async () => pending.resolve({ id: FAVORITE_ID }));
    expect(heart('Quitar de favoritos')).toBeEnabled();
    expect(heart('Quitar de favoritos')).toHaveAttribute('aria-busy', 'false');
    expect(useFavoritesStore.getState().byIdea[IDEA_IDS[0]]).toBe(FAVORITE_ID);
  });

  it('si falla, revierte el corazón y avisa en español', async () => {
    const favorites = fakeFavorites();
    favorites.addFavorite.mockRejectedValue(new ApiError('NETWORK_ERROR'));
    renderIdeas(savedIdeas, favorites);
    await screen.findByRole('heading', { level: 1, name: 'Frasco de vidrio' });

    fireEvent.click(heart('Guardar en favoritos'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos guardar la idea en tus favoritos. Inténtalo de nuevo.',
    );
    expect(screen.getAllByRole('button', { name: 'Guardar en favoritos' })).toHaveLength(3);
    expect(useFavoritesStore.getState().byIdea[IDEA_IDS[0]]).toBeUndefined();
  });

  it('quitar revierte a marcado si falla', async () => {
    const favorites = fakeFavorites();
    favorites.removeFavorite.mockRejectedValue(new ApiError('INTERNAL_ERROR', 500));
    useFavoritesStore.setState({ byIdea: { [IDEA_IDS[0]]: FAVORITE_ID } });
    renderIdeas(savedIdeas, favorites);
    await screen.findByRole('heading', { level: 1, name: 'Frasco de vidrio' });

    fireEvent.click(heart('Quitar de favoritos'));
    expect(heart('Guardar en favoritos')).toHaveAttribute('aria-pressed', 'false');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos quitar la idea de tus favoritos.',
    );
    expect(heart('Quitar de favoritos')).toHaveAttribute('aria-pressed', 'true');
    expect(favorites.removeFavorite).toHaveBeenCalledWith(FAVORITE_ID);
  });

  it('doble toque rápido: una sola petición', async () => {
    const favorites = fakeFavorites();
    const pending = deferred<{ id: string }>();
    favorites.addFavorite.mockReturnValue(pending.promise);
    renderIdeas(savedIdeas, favorites);
    await screen.findByRole('heading', { level: 1, name: 'Frasco de vidrio' });

    const button = heart('Guardar en favoritos');
    fireEvent.click(button);
    fireEvent.click(button);
    await act(async () => pending.resolve({ id: FAVORITE_ID }));

    expect(favorites.addFavorite).toHaveBeenCalledTimes(1);
    expect(favorites.removeFavorite).not.toHaveBeenCalled();
  });

  it('tocar el corazón no abre el chat; tocar la tarjeta sí', async () => {
    renderIdeas(savedIdeas);
    await screen.findByRole('heading', { level: 1, name: 'Frasco de vidrio' });

    fireEvent.click(heart('Guardar en favoritos'));
    expect(screen.queryByText('Pantalla de chat')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Portalápices' }));
    expect(await screen.findByText('Pantalla de chat')).toBeInTheDocument();
  });

  it('marcar, ir al chat y volver: el corazón sigue lleno', async () => {
    const { upcycle } = renderIdeas(savedIdeas);
    await screen.findByRole('heading', { level: 1, name: 'Frasco de vidrio' });

    fireEvent.click(heart('Guardar en favoritos'));
    await waitFor(() => expect(heart('Quitar de favoritos')).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: 'Portalápices' }));
    fireEvent.click(await screen.findByRole('link', { name: 'Volver a las ideas' }));

    await screen.findByRole('heading', { level: 1, name: 'Frasco de vidrio' });
    expect(screen.getAllByRole('button', { name: 'Quitar de favoritos' })).toHaveLength(1);
    // La respuesta salió de la caché: el corazón lo pinta el store, no una respuesta nueva.
    expect(upcycle).toHaveBeenCalledTimes(1);
  });

  it('sin sesión: sin corazones y enlace para entrar que vuelve a /ideas', async () => {
    useAuthStore.setState({ session: null, ready: true });
    renderIdeas(savedIdeas);
    await screen.findByRole('heading', { level: 1, name: 'Frasco de vidrio' });

    expect(screen.queryByRole('button', { name: /favoritos/ })).not.toBeInTheDocument();
    const link = screen.getByRole('link', {
      name: 'Inicia sesión para guardar tus ideas favoritas',
    });
    expect(link).toHaveAttribute('href', '/entrar?volver=%2Fideas');
  });

  it('con sesión pero saved: false: sin corazón ni enlace', async () => {
    renderIdeas(unsavedIdeas);
    await screen.findByRole('heading', { level: 1, name: 'Frasco de vidrio' });

    expect(screen.queryByRole('button', { name: /favoritos/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Inicia sesión/ })).not.toBeInTheDocument();
  });

  it('cerrar sesión vacía el store', () => {
    useFavoritesStore.setState({ byIdea: { [IDEA_IDS[0]]: FAVORITE_ID } });
    useAuthStore.setState({ session: null, ready: true });
    expect(useFavoritesStore.getState().byIdea).toEqual({});
  });

  it('cerrar sesión con la petición en vuelo no reescribe el store', async () => {
    const favorites = fakeFavorites();
    const pending = deferred<{ id: string }>();
    favorites.addFavorite.mockReturnValue(pending.promise);
    renderIdeas(savedIdeas, favorites);
    await screen.findByRole('heading', { level: 1, name: 'Frasco de vidrio' });

    fireEvent.click(heart('Guardar en favoritos'));
    act(() => useAuthStore.setState({ session: null, ready: true }));
    await act(async () => pending.resolve({ id: FAVORITE_ID }));

    expect(useFavoritesStore.getState().byIdea).toEqual({});
  });

  it('renovar el token del mismo usuario no vacía el store', () => {
    useFavoritesStore.setState({ byIdea: { [IDEA_IDS[0]]: FAVORITE_ID } });
    useAuthStore.setState({ session: { ...fakeSession(), access_token: 'otro' }, ready: true });
    expect(useFavoritesStore.getState().byIdea[IDEA_IDS[0]]).toBe(FAVORITE_ID);
  });
});

describe('Corazón en el detalle del historial (HU-12)', () => {
  const detail: HistoryDetail = {
    id: SCAN_ID,
    createdAt: '2026-10-20T17:30:00+00:00',
    imageUrl: null,
    mode: 'upcycle',
    result: {
      ...ideasResult(true),
      ideas: ideasResult(true).ideas.map((idea) => ({
        ...idea,
        favoriteId: idea.ideaIndex === 1 ? FAVORITE_ID : null,
      })),
    },
  };

  const renderDetail = (favorites: FavoritesApi = fakeFavorites()) =>
    render(
      <MemoryRouter initialEntries={[`/historial/${SCAN_ID}`]}>
        <Routes>
          <Route
            path="/historial/:id"
            element={
              <HistoryDetailPage
                historyItem={vi.fn().mockResolvedValue(detail)}
                favorites={favorites}
              />
            }
          />
          <Route path="/chat" element={<p>Pantalla de chat</p>} />
        </Routes>
      </MemoryRouter>,
    );

  it('el favoriteId del detalle pinta el corazón y alimenta el store', async () => {
    renderDetail();
    await screen.findByRole('heading', { level: 1, name: 'Frasco de vidrio' });

    expect(screen.getByRole('button', { name: 'Quitar de favoritos' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getAllByRole('button', { name: 'Guardar en favoritos' })).toHaveLength(2);
    expect(useFavoritesStore.getState().byIdea).toEqual({
      [IDEA_IDS[0]]: null,
      [IDEA_IDS[1]]: FAVORITE_ID,
      [IDEA_IDS[2]]: null,
    });
  });

  it('quitar desde el detalle actualiza el store y no abre el chat', async () => {
    const favorites = fakeFavorites();
    renderDetail(favorites);
    await screen.findByRole('heading', { level: 1, name: 'Frasco de vidrio' });

    fireEvent.click(screen.getByRole('button', { name: 'Quitar de favoritos' }));

    await waitFor(() => expect(useFavoritesStore.getState().byIdea[IDEA_IDS[1]]).toBeNull());
    expect(favorites.removeFavorite).toHaveBeenCalledWith(FAVORITE_ID);
    expect(screen.queryByText('Pantalla de chat')).not.toBeInTheDocument();
  });
});
