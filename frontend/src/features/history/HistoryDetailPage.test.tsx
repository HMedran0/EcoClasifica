import type { ChatResponse, HistoryDetail } from '@ecoclasifica/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/errors';
import { usePhotoStore } from '../camera/photoStore';
import { ChatPage } from '../chat/ChatPage';
import type { ChatRequest } from '../chat/useChat';
import { HistoryDetailPage, type HistoryItemRequest } from './HistoryDetailPage';

const SCAN_ID = '0e7c3b1a-2f4d-4c6e-9a8b-1d2e3f4a5b6c';
const IDEA_ID = '1f8d4c2b-3a5e-4d7f-8b9c-2e3f4a5b6c7d';

const classifyDetail: HistoryDetail = {
  id: SCAN_ID,
  createdAt: '2026-10-20T17:30:00+00:00',
  imageUrl: 'https://firmado.test/foto.jpg',
  mode: 'classify',
  result: {
    object: 'botella de agua',
    material: 'plastico',
    materialDetail: 'PET',
    confidence: 0.92,
    lowConfidence: false,
    alternatives: [],
  },
  disposal: {
    binCode: 'WHITE',
    binName: 'Contenedor blanco (aprovechables)',
    colorHex: '#F5F5F5',
    icon: 'bin-white',
    instructions: 'Limpio y seco.',
    requiresDropOff: false,
  },
};

const upcycleDetail: HistoryDetail = {
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
        title: 'Portalápices',
        description: 'Decóralo.',
        extraMaterials: ['Pintura'],
      },
      { ideaIndex: 1, title: 'Maceta', description: 'Siembra algo.', extraMaterials: [] },
      { ideaIndex: 2, title: 'Lámpara', description: 'Con luces LED.', extraMaterials: [] },
    ],
  },
};

const resolving = (detail: HistoryDetail) => vi.fn<HistoryItemRequest>().mockResolvedValue(detail);

function renderDetail(historyItem: HistoryItemRequest, chat: ChatRequest = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={[`/historial/${SCAN_ID}`]}>
      <Routes>
        <Route path="/historial" element={<p>Lista del historial</p>} />
        <Route path="/historial/:id" element={<HistoryDetailPage historyItem={historyItem} />} />
        <Route path="/chat" element={<ChatPage chat={chat} />} />
        <Route path="/camara" element={<p>Pantalla de cámara</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  usePhotoStore.setState({ photo: null, results: {}, chats: {} });
});

describe('HistoryDetailPage', () => {
  it('muestra el resultado guardado de Clasificar con su contenedor e imagen', async () => {
    const historyItem = resolving(classifyDetail);
    renderDetail(historyItem);

    expect(await screen.findByRole('heading', { name: 'Botella de agua' })).toBeInTheDocument();
    expect(screen.getByText('Contenedor blanco (aprovechables)')).toBeInTheDocument();
    expect(screen.getByText('Modo Clasificar')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Tu foto' })).toHaveAttribute(
      'src',
      'https://firmado.test/foto.jpg',
    );
    expect(historyItem).toHaveBeenCalledTimes(1);
    expect(historyItem).toHaveBeenCalledWith(SCAN_ID, expect.anything());
  });

  it('muestra las ideas guardadas y abre el chat de una idea sin foto actual', async () => {
    const chat = vi.fn<ChatRequest>().mockResolvedValue({
      reply: '1. Lava el frasco.',
      usage: { promptTokens: 1, completionTokens: 1 },
    } satisfies ChatResponse);
    renderDetail(resolving(upcycleDetail), chat);

    expect(await screen.findByRole('heading', { name: 'Frasco de vidrio' })).toBeInTheDocument();
    expect(screen.getByText('Maceta')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Portalápices' }));

    fireEvent.change(await screen.findByRole('textbox', { name: 'Tu pregunta' }), {
      target: { value: '¿Cómo empiezo?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByText('Lava el frasco.')).toBeInTheDocument();
    expect(chat).toHaveBeenCalledWith(
      expect.objectContaining({
        scanId: SCAN_ID,
        ideaIndex: 0,
        idea: expect.objectContaining({ objectName: 'Frasco de vidrio', title: 'Portalápices' }),
      }),
      expect.anything(),
    );
    // El hilo no se mezcla con los de la foto actual.
    expect(Object.keys(usePhotoStore.getState().chats)).toEqual([`historial:${SCAN_ID}:0`]);

    fireEvent.click(screen.getByRole('button', { name: 'Volver al escaneo' }));
    expect(await screen.findByRole('heading', { name: 'Frasco de vidrio' })).toBeInTheDocument();
  });

  it('un escaneo inexistente o ajeno muestra «no encontrado» sin reintentar', async () => {
    renderDetail(vi.fn<HistoryItemRequest>().mockRejectedValue(new ApiError('NOT_FOUND', 404)));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No encontramos ese escaneo en tu historial.',
    );
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Volver al historial' }));
    expect(screen.getByText('Lista del historial')).toBeInTheDocument();
  });

  it('ante un error de red permite reintentar', async () => {
    const historyItem = vi
      .fn<HistoryItemRequest>()
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR'))
      .mockResolvedValueOnce(classifyDetail);
    renderDetail(historyItem);

    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { name: 'Botella de agua' })).toBeInTheDocument();
    expect(historyItem).toHaveBeenCalledTimes(2);
  });
});
