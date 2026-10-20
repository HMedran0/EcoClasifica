import type { ChatHistoryResponse, Favorite, FavoritesListResponse } from '@ecoclasifica/shared';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/errors';
import { fakeSession } from '../../test/supabaseMock';
import { useAuthStore } from '../auth/authStore';
import { usePhotoStore } from '../camera/photoStore';
import { ChatPage, ORPHAN_NOTICE } from '../chat/ChatPage';
import type { ChatRequest, ChatThreadRequest } from '../chat/useChat';
import type { FavoritesApi } from './FavoriteButton';
import { FavoritesPage, type FavoritesRequest } from './FavoritesPage';
import { clearFavorites, useFavoritesStore } from './favoritesStore';

const IDEA_ID = '1f8d4c2b-3a5e-4d7f-8b9c-2e3f4a5b6c70';
const FAV_LIVE = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c40';
const FAV_ORPHAN = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c41';

const live: Favorite = {
  id: FAV_LIVE,
  ideaId: IDEA_ID,
  objectName: 'Frasco de vidrio',
  difficulty: 'Fácil',
  title: 'Portalápices',
  description: 'Forra el frasco con cuerda.',
  extraMaterials: ['Cuerda', 'Pegante'],
  createdAt: '2026-10-20T12:01:00.000Z',
};

const orphan: Favorite = {
  id: FAV_ORPHAN,
  ideaId: null,
  objectName: 'Botella',
  difficulty: null,
  title: 'Maceta colgante',
  description: 'Corta la botella por la mitad.',
  extraMaterials: [],
  createdAt: '2026-10-20T12:00:00.000Z',
};

const page = (items: Favorite[], hasMore = false, n = 1): FavoritesListResponse => ({
  items,
  page: n,
  pageSize: 20,
  hasMore,
});

const fakeClient = () => ({
  addFavorite: vi.fn<FavoritesApi['addFavorite']>().mockResolvedValue({ id: FAV_LIVE }),
  removeFavorite: vi.fn<FavoritesApi['removeFavorite']>().mockResolvedValue(undefined),
});

const reply = (text: string) => ({ reply: text, usage: { promptTokens: 1, completionTokens: 1 } });

function renderApp({
  list = vi.fn<FavoritesRequest>().mockResolvedValue(page([live, orphan])),
  client = fakeClient(),
  chat = vi.fn<ChatRequest>().mockResolvedValue(reply('Lava el frasco.')),
  loadThread = vi.fn<ChatThreadRequest>().mockResolvedValue({ items: [] }),
}: {
  list?: FavoritesRequest;
  client?: FavoritesApi;
  chat?: ChatRequest;
  loadThread?: ChatThreadRequest;
} = {}) {
  render(
    <MemoryRouter initialEntries={['/favoritos']}>
      <Routes>
        <Route path="/favoritos" element={<FavoritesPage list={list} client={client} />} />
        <Route path="/chat" element={<ChatPage chat={chat} loadThread={loadThread} />} />
        <Route path="/camara" element={<p>Pantalla de cámara</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return { list, client, chat, loadThread };
}

const card = (title: string) => screen.getByRole('button', { name: title });
const openFavorite = async (title: string) => {
  fireEvent.click(await screen.findByRole('button', { name: title }));
};

beforeEach(() => {
  usePhotoStore.setState({ photo: null, results: {}, chats: {} });
  clearFavorites();
  useAuthStore.setState({ session: fakeSession(), ready: true });
});

describe('Lista de favoritos (HU-15)', () => {
  it('muestra objeto, dificultad, título, descripción y materiales', async () => {
    renderApp();

    const button = await screen.findByRole('button', { name: 'Portalápices' });
    expect(button).toHaveTextContent('Frasco de vidrio · Dificultad: Fácil');
    expect(button).toHaveTextContent('Forra el frasco con cuerda.');
    expect(button).toHaveTextContent('Necesitas además: Cuerda, Pegante');
    expect(card('Maceta colgante')).toHaveTextContent('Botella');
    expect(card('Maceta colgante')).not.toHaveTextContent('Dificultad');
    expect(screen.getAllByRole('button', { name: 'Quitar de favoritos' })).toHaveLength(2);
  });

  it('sin favoritos muestra «Aún no guardas ideas»', async () => {
    renderApp({ list: vi.fn<FavoritesRequest>().mockResolvedValue(page([])) });
    expect(await screen.findByText('Aún no guardas ideas.')).toBeInTheDocument();
  });

  it('pagina con «Cargar más»', async () => {
    const list = vi
      .fn<FavoritesRequest>()
      .mockResolvedValueOnce(page([live], true))
      .mockResolvedValueOnce(page([orphan], false, 2));
    renderApp({ list });

    fireEvent.click(await screen.findByRole('button', { name: 'Cargar más' }));

    expect(await screen.findByRole('button', { name: 'Maceta colgante' })).toBeInTheDocument();
    expect(list).toHaveBeenLastCalledWith(2, expect.anything());
    expect(screen.queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument();
  });

  it('si falla la carga, alerta y «Reintentar»', async () => {
    const list = vi
      .fn<FavoritesRequest>()
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 0))
      .mockResolvedValueOnce(page([live]));
    renderApp({ list });

    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('button', { name: 'Portalápices' })).toBeInTheDocument();
  });

  it('el corazón quita el favorito (también el huérfano) y sale de la lista', async () => {
    const { client } = renderApp();
    await screen.findByRole('button', { name: 'Portalápices' });

    const [liveHeart, orphanHeart] = screen.getAllByRole('button', {
      name: 'Quitar de favoritos',
    });
    await act(async () => fireEvent.click(liveHeart as HTMLElement));
    expect(client.removeFavorite).toHaveBeenCalledWith(FAV_LIVE);
    expect(screen.queryByRole('button', { name: 'Portalápices' })).not.toBeInTheDocument();
    // El corazón de /ideas y del historial también lo sabe.
    expect(useFavoritesStore.getState().byIdea[IDEA_ID]).toBeNull();

    await act(async () => fireEvent.click(orphanHeart as HTMLElement));
    expect(client.removeFavorite).toHaveBeenCalledWith(FAV_ORPHAN);
    expect(await screen.findByText('Aún no guardas ideas.')).toBeInTheDocument();
  });

  it('si quitar falla, el favorito sigue en la lista con un aviso', async () => {
    const client = fakeClient();
    client.removeFavorite.mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 0));
    renderApp({ client });
    await screen.findByRole('button', { name: 'Portalápices' });

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Quitar de favoritos' })[0]!);
    });

    expect(screen.getByRole('button', { name: 'Portalápices' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos quitar la idea');
  });
});

describe('Abrir el chat desde un favorito (HU-15)', () => {
  it('con la idea existente: retoma el hilo guardado y envía solo la pregunta nueva', async () => {
    const thread: ChatHistoryResponse = {
      items: [
        { role: 'user', content: '¿Cómo empiezo?' },
        { role: 'assistant', content: 'Lava el frasco.' },
      ],
    };
    const loadThread = vi.fn<ChatThreadRequest>().mockResolvedValue(thread);
    const chat = vi.fn<ChatRequest>().mockResolvedValue(reply('Ahora fórralo.'));
    renderApp({ loadThread, chat });

    await openFavorite('Portalápices');

    const conversation = await screen.findByRole('list', { name: 'Conversación' });
    expect(within(conversation).getAllByRole('listitem')).toHaveLength(2);
    expect(loadThread).toHaveBeenCalledWith(IDEA_ID, expect.anything());
    expect(screen.queryByText(ORPHAN_NOTICE)).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'Tu pregunta' }), {
      target: { value: '¿Y luego?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByText('Ahora fórralo.', { selector: 'li *' })).toBeInTheDocument();
    expect(chat).toHaveBeenCalledWith(
      expect.objectContaining({
        ideaId: IDEA_ID,
        messages: [{ role: 'user', content: '¿Y luego?' }],
      }),
      expect.anything(),
    );
  });

  it('si falla cargar el hilo, no deja enviar y «Reintentar» lo vuelve a pedir', async () => {
    const loadThread = vi
      .fn<ChatThreadRequest>()
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 0))
      .mockResolvedValueOnce({ items: [{ role: 'user', content: 'Hola' }] });
    renderApp({ loadThread });

    await openFavorite('Portalápices');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos cargar la conversación guardada',
    );
    expect(screen.queryByRole('button', { name: STARTER })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(loadThread).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('list', { name: 'Conversación' })).toBeInTheDocument();
  });

  it('con el escaneo borrado: contexto desde la copia, conversación vacía, sin guardar y aviso', async () => {
    const chat = vi.fn<ChatRequest>().mockResolvedValue(reply('Corta la botella.'));
    const { loadThread } = renderApp({ chat });

    await openFavorite('Maceta colgante');

    expect(await screen.findByText(ORPHAN_NOTICE)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Maceta colgante' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Conversación' })).not.toBeInTheDocument();
    expect(loadThread).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: STARTER }));
    expect(await screen.findByText('Corta la botella.', { selector: 'li *' })).toBeInTheDocument();
    const [body] = chat.mock.calls[0]!;
    expect(body).not.toHaveProperty('ideaId');
    expect(body.idea).toEqual({
      objectName: 'Botella',
      title: 'Maceta colgante',
      description: 'Corta la botella por la mitad.',
      extraMaterials: [],
    });
  });

  it('«Volver a mis favoritos» regresa a la lista', async () => {
    renderApp();
    await openFavorite('Maceta colgante');

    fireEvent.click(await screen.findByRole('button', { name: 'Volver a mis favoritos' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Mis favoritos' }),
    ).toBeInTheDocument();
  });
});

const STARTER = '¿Cómo empiezo?';
