import type { ChatResponse, UpcycleResponse } from '@ecoclasifica/shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeSession } from '../../test/supabaseMock';
import { useAuthStore } from '../auth/authStore';
import { usePhotoStore } from '../camera/photoStore';
import { ChatPage, type ChatLocationState } from './ChatPage';
import type { ChatRequest, ChatThreadRequest } from './useChat';

// HU-15: con sesión, el chat de una idea guardada retoma su hilo desde /ideas y desde el historial.

const IDEA_ID = '1f8d4c2b-3a5e-4d7f-8b9c-2e3f4a5b6c70';
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

const savedIdeas: UpcycleResponse = {
  scanId: SCAN_ID,
  mode: 'upcycle',
  result: {
    canUpcycle: true,
    objectName: 'frasco de vidrio',
    difficulty: 'Fácil',
    ideas: ['Portalápices', 'Maceta', 'Lámpara'].map((title, ideaIndex) => ({
      ideaIndex,
      ...(ideaIndex === 0 ? { ideaId: IDEA_ID } : {}),
      title,
      description: 'd',
      extraMaterials: [],
    })),
  },
  saved: true,
};

const savedThread = {
  items: [
    { role: 'user' as const, content: '¿Cómo empiezo?' },
    { role: 'assistant' as const, content: 'Lava el frasco.' },
  ],
};

const replyWith = (reply: string): ChatResponse => ({
  reply,
  usage: { promptTokens: 1, completionTokens: 1 },
});

function renderChat(state: ChatLocationState) {
  const chat = vi.fn<ChatRequest>().mockResolvedValue(replyWith('Sécalo bien.'));
  const loadThread = vi.fn<ChatThreadRequest>().mockResolvedValue(savedThread);
  render(
    <MemoryRouter initialEntries={[{ pathname: '/chat', state }]}>
      <Routes>
        <Route path="/chat" element={<ChatPage chat={chat} loadThread={loadThread} />} />
        <Route path="/camara" element={<p>Pantalla de cámara</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return { chat, loadThread };
}

function ask(text: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Tu pregunta' }), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
}

const fromHistory: ChatLocationState = {
  ideaIndex: 0,
  saved: {
    scanId: SCAN_ID,
    ideaId: IDEA_ID,
    idea: { objectName: 'Frasco', title: 'Portalápices', description: 'd', extraMaterials: [] },
  },
};

beforeEach(() => {
  usePhotoStore.setState({
    photo: storedPhoto,
    results: { upcycle: { photoId: storedPhoto.id, data: savedIdeas } },
    chats: {},
  });
  useAuthStore.setState({ session: fakeSession(), ready: true });
});

describe('Chat con hilo guardado (HU-15)', () => {
  it('desde /ideas con sesión: carga el hilo y envía solo la pregunta nueva con ideaId', async () => {
    const { chat, loadThread } = renderChat({ ideaIndex: 0 });

    const thread = await screen.findByRole('list', { name: 'Conversación' });
    expect(within(thread).getAllByRole('listitem')).toHaveLength(2);
    expect(loadThread).toHaveBeenCalledWith(IDEA_ID, expect.anything());

    ask('¿Y después?');
    expect(await screen.findByText('Sécalo bien.', { selector: 'li *' })).toBeInTheDocument();
    expect(chat).toHaveBeenCalledWith(
      expect.objectContaining({
        ideaId: IDEA_ID,
        ideaIndex: 0,
        scanId: SCAN_ID,
        messages: [{ role: 'user', content: '¿Y después?' }],
      }),
      expect.anything(),
    );
    expect(within(thread).getAllByRole('listitem')).toHaveLength(4);
  });

  it('desde el historial con sesión: carga el mismo hilo', async () => {
    const { loadThread } = renderChat(fromHistory);

    expect(await screen.findByRole('list', { name: 'Conversación' })).toBeInTheDocument();
    expect(loadThread).toHaveBeenCalledWith(IDEA_ID, expect.anything());
    expect(screen.getByRole('button', { name: 'Volver al escaneo' })).toBeInTheDocument();
  });

  it('sin sesión: no carga hilo ni envía ideaId (como en HU-11)', async () => {
    useAuthStore.setState({ session: null, ready: true });
    const { chat, loadThread } = renderChat({ ideaIndex: 0 });

    fireEvent.click(screen.getByRole('button', { name: '¿Cómo empiezo?' }));
    expect(await screen.findByText('Sécalo bien.', { selector: 'li *' })).toBeInTheDocument();
    expect(loadThread).not.toHaveBeenCalled();
    expect(chat.mock.calls[0]?.[0]).not.toHaveProperty('ideaId');
  });

  it('una idea sin ideaId (escaneo no guardado) no carga hilo aunque haya sesión', async () => {
    const { chat, loadThread } = renderChat({ ideaIndex: 1 });

    fireEvent.click(screen.getByRole('button', { name: '¿Cómo empiezo?' }));
    expect(await screen.findByText('Sécalo bien.', { selector: 'li *' })).toBeInTheDocument();
    expect(loadThread).not.toHaveBeenCalled();
    expect(chat.mock.calls[0]?.[0]).not.toHaveProperty('ideaId');
  });
});
