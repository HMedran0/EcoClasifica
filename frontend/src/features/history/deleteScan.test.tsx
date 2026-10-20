import type {
  Favorite,
  HistoryDetail,
  HistoryItem,
  HistoryListResponse,
} from '@ecoclasifica/shared';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/errors';
import { fakeSession } from '../../test/supabaseMock';
import { useAuthStore } from '../auth/authStore';
import { usePhotoStore } from '../camera/photoStore';
import { ChatPage, ORPHAN_NOTICE } from '../chat/ChatPage';
import type { ChatRequest, ChatThreadRequest } from '../chat/useChat';
import type { FavoritesApi } from '../favorites/FavoriteButton';
import { FavoritesPage, type FavoritesRequest } from '../favorites/FavoritesPage';
import { clearFavorites, useFavoritesStore } from '../favorites/favoritesStore';
import {
  HistoryDetailPage,
  type DeleteItemRequest,
  type HistoryItemRequest,
} from './HistoryDetailPage';
import { HistoryPage, type DeleteHistoryRequest, type HistoryRequest } from './HistoryPage';

vi.mock('../../lib/supabase', async () => ({
  supabase: (await import('../../test/supabaseMock')).fakeSupabase,
}));

const SCAN_ID = '0e7c3b1a-2f4d-4c6e-9a8b-1d2e3f4a5b6c';
const IDEA_ID = '1f8d4c2b-3a5e-4d7f-8b9c-2e3f4a5b6c7d';
const FAV_ID = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c40';

const detail: HistoryDetail = {
  id: SCAN_ID,
  createdAt: '2026-10-20T17:30:00+00:00',
  imageUrl: null,
  mode: 'upcycle',
  result: {
    canUpcycle: true,
    objectName: 'frasco de vidrio',
    difficulty: 'Fácil',
    ideas: [
      {
        ideaIndex: 0,
        ideaId: IDEA_ID,
        favoriteId: FAV_ID,
        title: 'Portalápices',
        description: 'Decóralo.',
        extraMaterials: ['Pintura'],
      },
      { ideaIndex: 1, title: 'Maceta', description: 'Siembra algo.', extraMaterials: [] },
      { ideaIndex: 2, title: 'Lámpara', description: 'Con luces LED.', extraMaterials: [] },
    ],
  },
};

/** La copia del favorito después de borrar el escaneo: `ideaId` pasa a `null`. */
const orphanCopy: Favorite = {
  id: FAV_ID,
  ideaId: null,
  objectName: 'frasco de vidrio',
  difficulty: 'Fácil',
  title: 'Portalápices',
  description: 'Decóralo.',
  extraMaterials: ['Pintura'],
  createdAt: '2026-10-20T17:31:00.000Z',
};

const item = (n: number): HistoryItem => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  createdAt: '2026-10-20T17:30:00+00:00',
  mode: 'classify',
  objectName: `Objeto ${n}`,
  summary: 'Contenedor blanco (aprovechables)',
  thumbnailUrl: null,
});

const pageOf = (items: HistoryItem[]): HistoryListResponse => ({
  items,
  page: 1,
  pageSize: 20,
  hasMore: false,
});

const favoritesClient: FavoritesApi = {
  addFavorite: vi.fn().mockResolvedValue({ id: FAV_ID }),
  removeFavorite: vi.fn().mockResolvedValue(undefined),
};

function renderApp({
  start = `/historial/${SCAN_ID}`,
  historyItem = vi.fn<HistoryItemRequest>().mockResolvedValue(detail),
  deleteItem = vi.fn<DeleteItemRequest>().mockResolvedValue(undefined),
  history = vi.fn<HistoryRequest>().mockResolvedValue(pageOf([])),
  deleteAll = vi.fn<DeleteHistoryRequest>().mockResolvedValue({ deleted: 0 }),
  favorites = vi.fn<FavoritesRequest>().mockResolvedValue({ ...pageOf([]), items: [orphanCopy] }),
  chat = vi.fn<ChatRequest>(),
  loadThread = vi.fn<ChatThreadRequest>().mockResolvedValue({ items: [] }),
} = {}) {
  render(
    <MemoryRouter initialEntries={[start]}>
      <Routes>
        <Route
          path="/historial"
          element={<HistoryPage history={history} deleteAll={deleteAll} />}
        />
        <Route
          path="/historial/:id"
          element={
            <HistoryDetailPage
              historyItem={historyItem}
              deleteItem={deleteItem}
              favorites={favoritesClient}
            />
          }
        />
        <Route
          path="/favoritos"
          element={<FavoritesPage list={favorites} client={favoritesClient} />}
        />
        <Route path="/chat" element={<ChatPage chat={chat} loadThread={loadThread} />} />
      </Routes>
    </MemoryRouter>,
  );
  return { deleteItem, history, deleteAll, loadThread };
}

const openDelete = async (name: string) => {
  fireEvent.click(await screen.findByRole('button', { name }));
  return screen.getByRole('alertdialog');
};

beforeEach(() => {
  clearFavorites();
  useAuthStore.setState({ session: fakeSession(), ready: true });
  usePhotoStore.setState({
    photo: null,
    results: {},
    chats: {
      [`idea:${IDEA_ID}`]: [{ role: 'user', content: '¿Cómo empiezo?' }],
      [`historial:${SCAN_ID}:1`]: [{ role: 'user', content: 'Hola' }],
    },
  });
});

describe('Eliminar escaneo desde el detalle (HU-14)', () => {
  it('pregunta con el texto acordado y el foco en «Cancelar»', async () => {
    renderApp();
    const dialog = await openDelete('Eliminar escaneo');
    expect(dialog).toHaveAccessibleName('¿Eliminar este escaneo?');
    expect(dialog).toHaveAccessibleDescription(
      'No se puede deshacer. Tus ideas favoritas se conservarán.',
    );
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  it('cancelar (o Esc) no borra nada', async () => {
    const { deleteItem } = renderApp();
    fireEvent.click(
      within(await openDelete('Eliminar escaneo')).getByRole('button', { name: 'Cancelar' }),
    );
    fireEvent.keyDown(await openDelete('Eliminar escaneo'), { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(deleteItem).not.toHaveBeenCalled();
    expect(screen.getByText('Portalápices')).toBeInTheDocument();
  });

  it('confirmar borra, limpia los stores y vuelve a /historial con «Escaneo eliminado»', async () => {
    const { deleteItem } = renderApp();
    const dialog = await openDelete('Eliminar escaneo');
    // El detalle alimentó el corazón con el favorito del servidor.
    expect(useFavoritesStore.getState().byIdea).toEqual({ [IDEA_ID]: FAV_ID });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }));

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('Escaneo eliminado');
    await waitFor(() => expect(notice).toHaveFocus());
    expect(deleteItem).toHaveBeenCalledWith(SCAN_ID);
    expect(screen.getByRole('heading', { name: 'Mi historial' })).toBeInTheDocument();
    expect(useFavoritesStore.getState().byIdea).toEqual({});
    expect(usePhotoStore.getState().chats).toEqual({});
  });

  it('si ya no existía (404), el resultado es el mismo', async () => {
    renderApp({
      deleteItem: vi.fn<DeleteItemRequest>().mockRejectedValue(new ApiError('NOT_FOUND', 404)),
    });
    fireEvent.click(
      within(await openDelete('Eliminar escaneo')).getByRole('button', { name: 'Eliminar' }),
    );
    expect(await screen.findByText('Escaneo eliminado')).toBeInTheDocument();
  });

  it('si falla, el diálogo sigue abierto con el motivo y no se limpia nada', async () => {
    renderApp({
      deleteItem: vi.fn<DeleteItemRequest>().mockRejectedValue(new ApiError('NETWORK_ERROR')),
    });
    const dialog = await openDelete('Eliminar escaneo');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }));

    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(useFavoritesStore.getState().byIdea).toEqual({ [IDEA_ID]: FAV_ID });
    expect(Object.keys(usePhotoStore.getState().chats)).toHaveLength(2);
  });

  it('después, el favorito huérfano abre el chat desde la copia con el aviso de HU-15', async () => {
    const { loadThread } = renderApp();
    fireEvent.click(
      within(await openDelete('Eliminar escaneo')).getByRole('button', { name: 'Eliminar' }),
    );
    await screen.findByText('Escaneo eliminado');

    // El servidor devuelve ahora la copia con `ideaId: null`.
    render(
      <MemoryRouter initialEntries={['/favoritos']}>
        <Routes>
          <Route
            path="/favoritos"
            element={
              <FavoritesPage
                list={vi
                  .fn<FavoritesRequest>()
                  .mockResolvedValue({ ...pageOf([]), items: [orphanCopy] })}
                client={favoritesClient}
              />
            }
          />
          <Route path="/chat" element={<ChatPage chat={vi.fn()} loadThread={loadThread} />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Portalápices' }));

    expect(await screen.findByText(ORPHAN_NOTICE)).toBeInTheDocument();
    // Ni hilo del servidor ni el que había en memoria de la idea borrada.
    expect(loadThread).not.toHaveBeenCalled();
    expect(screen.queryByRole('list', { name: 'Conversación' })).not.toBeInTheDocument();
  });
});

describe('Eliminar todo mi historial (HU-14)', () => {
  it('con el historial vacío no se ofrece', async () => {
    renderApp({ start: '/historial' });
    expect(await screen.findByText('Aún no tienes escaneos guardados.')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Eliminar todo mi historial' }),
    ).not.toBeInTheDocument();
  });

  it('pide confirmar con «Eliminar todo» y el foco en «Cancelar»', async () => {
    renderApp({
      start: '/historial',
      history: vi.fn<HistoryRequest>().mockResolvedValue(pageOf([item(1)])),
    });
    const dialog = await openDelete('Eliminar todo mi historial');
    expect(within(dialog).getByRole('button', { name: 'Eliminar todo' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  it('confirmar borra, limpia todo, recarga la lista y avisa cuántos escaneos se borraron', async () => {
    const history = vi
      .fn<HistoryRequest>()
      .mockResolvedValueOnce(pageOf([item(1), item(2), item(3)]))
      .mockResolvedValue(pageOf([]));
    const { deleteAll } = renderApp({
      start: '/historial',
      history,
      deleteAll: vi.fn<DeleteHistoryRequest>().mockResolvedValue({ deleted: 3 }),
    });
    useFavoritesStore.setState({ byIdea: { [IDEA_ID]: FAV_ID } });

    const dialog = await openDelete('Eliminar todo mi historial');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Eliminar todo' }));

    const notice = await screen.findByText('Historial eliminado (3 escaneos)');
    await waitFor(() => expect(notice).toHaveFocus());
    expect(await screen.findByText('Aún no tienes escaneos guardados.')).toBeInTheDocument();
    expect(deleteAll).toHaveBeenCalledTimes(1);
    expect(history).toHaveBeenCalledTimes(2);
    expect(useFavoritesStore.getState().byIdea).toEqual({});
    expect(usePhotoStore.getState().chats).toEqual({});
    expect(
      screen.queryByRole('button', { name: 'Eliminar todo mi historial' }),
    ).not.toBeInTheDocument();
  });

  it('con un solo escaneo el aviso va en singular', async () => {
    renderApp({
      start: '/historial',
      history: vi
        .fn<HistoryRequest>()
        .mockResolvedValueOnce(pageOf([item(1)]))
        .mockResolvedValue(pageOf([])),
      deleteAll: vi.fn<DeleteHistoryRequest>().mockResolvedValue({ deleted: 1 }),
    });
    fireEvent.click(
      within(await openDelete('Eliminar todo mi historial')).getByRole('button', {
        name: 'Eliminar todo',
      }),
    );
    expect(await screen.findByText('Historial eliminado (1 escaneo)')).toBeInTheDocument();
  });
});
