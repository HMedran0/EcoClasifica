import type { ChatMessage, ChatResponse, UpcycleResponse } from '@ecoclasifica/shared';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/errors';
import { usePhotoStore } from '../camera/photoStore';
import { IdeasPage } from '../upcycle/IdeasPage';
import { ChatPage, STARTERS } from './ChatPage';
import type { ChatRequest } from './useChat';

const storedPhoto = {
  id: 1,
  base64: 'a'.repeat(200),
  mimeType: 'image/jpeg' as const,
  width: 768,
  height: 576,
  bytes: 150,
  previewUrl: 'blob:preview',
};

const ideas: UpcycleResponse = {
  scanId: null,
  mode: 'upcycle',
  result: {
    canUpcycle: true,
    objectName: 'frasco de vidrio',
    difficulty: 'Fácil',
    ideas: [
      {
        ideaIndex: 0,
        title: 'Portalápices',
        description: 'Decóralo.',
        extraMaterials: ['Pintura', ' '],
      },
      { ideaIndex: 1, title: 'Maceta', description: 'Siembra una suculenta.', extraMaterials: [] },
      { ideaIndex: 2, title: 'Lámpara', description: 'Con luces LED.', extraMaterials: [] },
    ],
  },
  saved: false,
};

const replyWith = (reply: string): ChatResponse => ({
  reply,
  usage: { promptTokens: 200, completionTokens: 50 },
});

const answering = (reply = '1. Lava el frasco.\n2. Sécalo bien.') =>
  vi.fn<ChatRequest>().mockResolvedValue(replyWith(reply));

const upcycleNever = vi.fn(() => new Promise<UpcycleResponse>(() => {}));

function renderApp(
  chat: ChatRequest,
  entry: { pathname: string; state?: unknown } = { pathname: '/ideas' },
) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/ideas" element={<IdeasPage upcycle={upcycleNever} />} />
        <Route path="/chat" element={<ChatPage chat={chat} />} />
        <Route path="/camara" element={<p>Pantalla de cámara</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const openChat = (chat: ChatRequest, ideaIndex = 0) =>
  renderApp(chat, { pathname: '/chat', state: { ideaIndex } });

const input = () => screen.getByRole('textbox', { name: 'Tu pregunta' });
const conversation = () => screen.getByRole('list', { name: 'Conversación' });

function ask(text: string) {
  fireEvent.change(input(), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
}

beforeEach(() => {
  URL.revokeObjectURL = vi.fn();
  URL.createObjectURL = vi.fn(() => 'blob:new');
  usePhotoStore.setState({
    photo: storedPhoto,
    results: { upcycle: { photoId: storedPhoto.id, data: ideas } },
    chats: {},
  });
});

describe('ChatPage', () => {
  it('se abre desde la tarjeta de /ideas con objeto, idea y materiales', () => {
    renderApp(answering());
    fireEvent.click(screen.getByRole('button', { name: 'Portalápices' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Portalápices' })).toHaveFocus();
    expect(screen.getByText('Frasco de vidrio')).toBeInTheDocument();
    expect(screen.getByText(/Necesitas además:/).parentElement).toHaveTextContent(
      'Necesitas además: Pintura',
    );
    for (const text of STARTERS) {
      expect(screen.getByRole('button', { name: text })).toBeInTheDocument();
    }
  });

  it('sin idea cargada redirige a la cámara', () => {
    usePhotoStore.setState({ results: {} });
    openChat(answering());
    expect(screen.getByText('Pantalla de cámara')).toBeInTheDocument();
  });

  it.each([
    ['sin estado de navegación', { pathname: '/chat' }],
    ['con una idea que no existe', { pathname: '/chat', state: { ideaIndex: 7 } }],
  ])('redirige a la cámara %s', (_case, entry) => {
    renderApp(answering(), entry);
    expect(screen.getByText('Pantalla de cámara')).toBeInTheDocument();
  });

  it('una sugerencia envía la pregunta con la idea y muestra la respuesta', async () => {
    const chat = answering();
    openChat(chat);
    fireEvent.click(screen.getByRole('button', { name: '¿Cómo empiezo?' }));

    expect(screen.getByRole('status')).toHaveTextContent('Escribiendo…');
    expect(await within(conversation()).findByText('Lava el frasco.')).toBeInTheDocument();
    expect(chat).toHaveBeenCalledWith(
      {
        ideaIndex: 0,
        idea: {
          objectName: 'Frasco de vidrio',
          title: 'Portalápices',
          description: 'Decóralo.',
          extraMaterials: ['Pintura'],
        },
        messages: [{ role: 'user', content: '¿Cómo empiezo?' }],
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.queryByRole('button', { name: '¿Cómo empiezo?' })).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('anuncia la respuesta nueva y la pinta como lista numerada, nunca como HTML', async () => {
    openChat(answering('Necesitas:\n1. <b>Tijeras</b>\n2. Pegamento'));
    ask('¿Qué necesito?');

    const list = await within(conversation()).findByRole('list');
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['<b>Tijeras</b>', 'Pegamento']);
    expect(document.querySelector('b')).toBeNull();
    const live = document.querySelector('[aria-live="polite"]');
    expect(live).toHaveTextContent('Necesitas: 1. <b>Tijeras</b> 2. Pegamento');
    expect(input()).toHaveValue('');
  });

  it('envía solo los últimos 10 mensajes', async () => {
    const history: ChatMessage[] = Array.from({ length: 12 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `M${i}`,
    }));
    usePhotoStore.setState({ chats: { 0: history } });
    const chat = answering();
    openChat(chat);
    ask('Pregunta 13');
    await within(conversation()).findByText('Sécalo bien.');

    const sent = chat.mock.calls[0]?.[0].messages ?? [];
    expect(sent).toHaveLength(10);
    expect(sent[0]).toEqual({ role: 'assistant', content: 'M3' });
    expect(sent.at(-1)).toEqual({ role: 'user', content: 'Pregunta 13' });
    // El hilo visible sí conserva todo.
    expect(conversation().children).toHaveLength(14);
  });

  it('error: muestra Reintentar sin perder la pregunta y al reintentar responde', async () => {
    const chat = vi
      .fn<ChatRequest>()
      .mockRejectedValueOnce(new ApiError('AI_TIMEOUT', 504))
      .mockResolvedValueOnce(replyWith('Empieza lavando el frasco.'));
    openChat(chat);
    ask('¿Cómo empiezo?');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('La respuesta tardó demasiado. Intenta de nuevo.');
    expect(within(conversation()).getByText('¿Cómo empiezo?')).toBeInTheDocument();

    fireEvent.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    expect(
      await within(conversation()).findByText('Empieza lavando el frasco.'),
    ).toBeInTheDocument();
    expect(chat).toHaveBeenCalledTimes(2);
    expect(chat.mock.calls[1]?.[0].messages).toEqual([{ role: 'user', content: '¿Cómo empiezo?' }]);
    expect(within(conversation()).getAllByText('¿Cómo empiezo?')).toHaveLength(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('un error no borra lo que se está escribiendo', async () => {
    openChat(vi.fn<ChatRequest>().mockRejectedValue(new ApiError('NETWORK_ERROR')));
    ask('Primera');
    await screen.findByRole('alert');
    fireEvent.change(input(), { target: { value: 'Borrador a medias' } });
    expect(screen.getByRole('alert')).toHaveTextContent('No hay conexión con el servidor.');
    expect(input()).toHaveValue('Borrador a medias');
  });

  it('UNSAFE_REQUEST: muestra el motivo sin Reintentar', async () => {
    openChat(vi.fn<ChatRequest>().mockRejectedValue(new ApiError('UNSAFE_REQUEST', 422)));
    ask('Hola');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Esa idea no es segura');
    expect(within(alert).queryByRole('button')).not.toBeInTheDocument();
  });

  it('QUOTA_EXCEEDED: muestra el límite del servidor sin Reintentar (HU-20)', async () => {
    const message =
      'Llegaste al límite de hoy: 100 mensajes de chat. Se reinicia a medianoche (hora de Colombia).';
    openChat(
      vi.fn<ChatRequest>().mockRejectedValue(new ApiError('QUOTA_EXCEEDED', 429, 'r1', message)),
    );
    ask('Hola');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(message);
    expect(within(alert).queryByRole('button')).not.toBeInTheDocument();
  });

  it('SERVICE_PAUSED: «Servicio en pausa por hoy» sin Reintentar', async () => {
    openChat(vi.fn<ChatRequest>().mockRejectedValue(new ApiError('SERVICE_PAUSED', 503)));
    ask('Hola');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Servicio en pausa por hoy');
    expect(within(alert).queryByRole('button')).not.toBeInTheDocument();
  });

  it('conserva el hilo al volver a /ideas y regresar', async () => {
    renderApp(answering());
    fireEvent.click(screen.getByRole('button', { name: 'Portalápices' }));
    ask('¿Cómo empiezo?');
    await within(conversation()).findByText('Lava el frasco.');

    fireEvent.click(screen.getByRole('button', { name: 'Volver a las ideas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Maceta' }));
    expect(screen.queryByRole('list', { name: 'Conversación' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Volver a las ideas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Portalápices' }));
    expect(within(conversation()).getByText('¿Cómo empiezo?')).toBeInTheDocument();
    expect(within(conversation()).getByText('Lava el frasco.')).toBeInTheDocument();
    expect(upcycleNever).not.toHaveBeenCalled();
  });

  it('salir antes de la respuesta deja la pregunta con Reintentar', () => {
    const pending = vi.fn<ChatRequest>(() => new Promise<ChatResponse>(() => {}));
    renderApp(pending);
    fireEvent.click(screen.getByRole('button', { name: 'Portalápices' }));
    ask('¿Cómo empiezo?');
    fireEvent.click(screen.getByRole('button', { name: 'Volver a las ideas' }));
    expect(pending.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Portalápices' }));
    expect(screen.getByRole('alert')).toHaveTextContent('La respuesta se interrumpió.');
    expect(within(conversation()).getByText('¿Cómo empiezo?')).toBeInTheDocument();
  });

  it('cambiar de foto borra las conversaciones', async () => {
    openChat(answering());
    ask('¿Cómo empiezo?');
    await within(conversation()).findByText('Lava el frasco.');
    expect(usePhotoStore.getState().chats[0]).toHaveLength(2);

    act(() => usePhotoStore.getState().setPhoto({ ...storedPhoto, blob: new Blob() }));
    expect(usePhotoStore.getState().chats).toEqual({});
  });

  it('ideas nuevas para la misma foto borran los hilos anteriores', () => {
    usePhotoStore.setState({ chats: { 0: [{ role: 'user', content: 'Hola' }] } });
    usePhotoStore.getState().saveResult('upcycle', storedPhoto.id, ideas);
    expect(usePhotoStore.getState().chats).toEqual({});
  });

  it('no envía mensajes vacíos', () => {
    const chat = answering();
    openChat(chat);
    fireEvent.change(input(), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    fireEvent.submit(input().closest('form')!);
    expect(chat).not.toHaveBeenCalled();
  });
});
