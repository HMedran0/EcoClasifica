import type { HistoryItem, HistoryListResponse } from '@ecoclasifica/shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/errors';
import { fakeSession } from '../../test/supabaseMock';
import { useAuthStore } from '../auth/authStore';
import { RequireAuth } from '../auth/RequireAuth';
import { HistoryPage, type HistoryRequest } from './HistoryPage';

vi.mock('../../lib/supabase', async () => ({
  supabase: (await import('../../test/supabaseMock')).fakeSupabase,
}));

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const item = (n: number, overrides: Partial<HistoryItem> = {}): HistoryItem => ({
  id: uuid(n),
  createdAt: '2026-10-20T17:30:00+00:00',
  mode: 'classify',
  objectName: `Objeto ${n}`,
  summary: 'Contenedor blanco (aprovechables)',
  thumbnailUrl: `https://firmado.test/${n}.jpg`,
  ...overrides,
});

const pageOf = (items: HistoryItem[], page = 1, hasMore = false): HistoryListResponse => ({
  items,
  page,
  pageSize: 20,
  hasMore,
});

function LoginStub() {
  const { search } = useLocation();
  return <p data-testid="entrar">{new URLSearchParams(search).get('volver')}</p>;
}

function renderPage(history: HistoryRequest) {
  return render(
    <MemoryRouter initialEntries={['/historial']}>
      <Routes>
        <Route
          path="/historial"
          element={
            <RequireAuth>
              <HistoryPage history={history} />
            </RequireAuth>
          }
        />
        <Route path="/historial/:id" element={<p>Detalle</p>} />
        <Route path="/entrar" element={<LoginStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => useAuthStore.setState({ session: fakeSession(), ready: true }));

describe('HistoryPage', () => {
  it('sin sesión lleva a /entrar y no pide el historial', () => {
    useAuthStore.setState({ session: null, ready: true });
    const history = vi.fn<HistoryRequest>();
    renderPage(history);
    expect(screen.getByTestId('entrar')).toHaveTextContent('/historial');
    expect(history).not.toHaveBeenCalled();
  });

  it('lista miniatura, modo, objeto, resumen y fecha en es-CO', async () => {
    const history = vi
      .fn<HistoryRequest>()
      .mockResolvedValue(
        pageOf([item(1), item(2, { mode: 'upcycle', summary: '3 ideas', thumbnailUrl: null })]),
      );
    const { container } = renderPage(history);

    const rows = await screen.findAllByRole('listitem');
    expect(rows).toHaveLength(2);
    const first = within(rows[0]!);
    expect(first.getByText('Objeto 1')).toBeInTheDocument();
    expect(first.getByText('Modo Clasificar')).toBeInTheDocument();
    expect(first.getByText('Contenedor blanco (aprovechables)')).toBeInTheDocument();
    const date = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
    expect(first.getByText(date.format(new Date('2026-10-20T17:30:00Z')))).toBeInTheDocument();
    expect(first.getByRole('link')).toHaveAttribute('href', `/historial/${uuid(1)}`);
    expect(container.querySelector('img[src="https://firmado.test/1.jpg"]')).toBeInTheDocument();

    const second = within(rows[1]!);
    expect(second.getByText('3 ideas')).toBeInTheDocument();
    expect(second.getByText(/Modo /)).not.toHaveTextContent('Clasificar');
    expect(history).toHaveBeenCalledWith(1, expect.anything());
    expect(screen.queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument();
  });

  it('sin escaneos muestra el estado vacío', async () => {
    renderPage(vi.fn<HistoryRequest>().mockResolvedValue(pageOf([])));
    expect(await screen.findByText('Aún no tienes escaneos guardados.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('«Cargar más» trae la siguiente página y la añade a la lista', async () => {
    const first = Array.from({ length: 20 }, (_, i) => item(i + 1));
    const history = vi
      .fn<HistoryRequest>()
      .mockResolvedValueOnce(pageOf(first, 1, true))
      // El primero ya estaba (se guardó uno nuevo entre páginas): no se repite.
      .mockResolvedValueOnce(pageOf([item(20), item(21)], 2, false));
    renderPage(history);

    fireEvent.click(await screen.findByRole('button', { name: 'Cargar más' }));

    expect(await screen.findByText('Objeto 21')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(21);
    expect(history).toHaveBeenLastCalledWith(2, expect.anything());
    expect(screen.queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument();
  });

  it('si falla «Cargar más», conserva la lista y avisa', async () => {
    const history = vi
      .fn<HistoryRequest>()
      .mockResolvedValueOnce(pageOf([item(1)], 1, true))
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR'));
    renderPage(history);

    fireEvent.click(await screen.findByRole('button', { name: 'Cargar más' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Revisa tu internet');
    expect(screen.getByText('Objeto 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cargar más' })).toBeEnabled();
  });

  it('si falla la primera carga, permite reintentar', async () => {
    const history = vi
      .fn<HistoryRequest>()
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR'))
      .mockResolvedValueOnce(pageOf([item(1)]));
    renderPage(history);

    expect(await screen.findByRole('alert')).toHaveTextContent('Revisa tu internet');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Objeto 1')).toBeInTheDocument();
    expect(history).toHaveBeenCalledTimes(2);
  });
});
