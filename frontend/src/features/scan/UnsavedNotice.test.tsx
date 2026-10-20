import type { ClassifyResponse, UpcycleResponse } from '@ecoclasifica/shared';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate, useSearchParams } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../../api/client';
import { fakeSession } from '../../test/supabaseMock';
import { useAuthStore } from '../auth/authStore';
import { usePhotoStore } from '../camera/photoStore';
import { ResultPage } from '../classify/ResultPage';
import type { FavoritesApi } from '../favorites/FavoriteButton';
import { clearFavorites } from '../favorites/favoritesStore';
import { IdeasPage } from '../upcycle/IdeasPage';

const SCAN_ID = '0e7c3b1a-2f4d-4c6e-9a8b-1d2e3f4a5b6c';
const IDEA_IDS = [
  '1f8d4c2b-3a5e-4d7f-8b9c-2e3f4a5b6c70',
  '1f8d4c2b-3a5e-4d7f-8b9c-2e3f4a5b6c71',
  '1f8d4c2b-3a5e-4d7f-8b9c-2e3f4a5b6c72',
] as const;

const storedPhoto = {
  id: 1,
  base64: 'a'.repeat(200),
  mimeType: 'image/jpeg' as const,
  width: 768,
  height: 576,
  bytes: 150,
  previewUrl: 'blob:preview',
};

const upcycleResponse = (saved: boolean): UpcycleResponse => ({
  scanId: saved ? SCAN_ID : null,
  mode: 'upcycle',
  result: {
    canUpcycle: true,
    objectName: 'frasco de vidrio',
    difficulty: 'Fácil',
    ideas: ['Portalápices', 'Maceta', 'Lámpara'].map((title, ideaIndex) => ({
      ideaIndex,
      ...(saved ? { ideaId: IDEA_IDS[ideaIndex] } : {}),
      title,
      description: 'd',
      extraMaterials: [],
    })),
  },
  saved,
});

const classifyResponse = (saved: boolean): ClassifyResponse => ({
  scanId: saved ? SCAN_ID : null,
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
  saved,
});

const jsonResponse = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

/** Cliente real con `fetch` simulado: el token sale de la sesión del store, como en la app. */
function apiWith(...responses: unknown[]) {
  const fetchFn = vi.fn<typeof fetch>();
  for (const data of responses) fetchFn.mockResolvedValueOnce(jsonResponse(data));
  const client = createApiClient({
    baseUrl: 'https://api.test',
    fetchFn,
    getToken: async () => useAuthStore.getState().session?.access_token ?? null,
  });
  const authOf = (call: number) =>
    new Headers(fetchFn.mock.calls[call]?.[1]?.headers).get('Authorization');
  return { client, fetchFn, authOf };
}

const noFavorites: FavoritesApi = { addFavorite: vi.fn(), removeFavorite: vi.fn() };

/** Simula iniciar sesión y volver a `?volver=`. */
function FakeLogin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return (
    <button
      type="button"
      onClick={() => {
        useAuthStore.setState({ session: fakeSession(), ready: true });
        navigate(params.get('volver') ?? '/');
      }}
    >
      Entrar
    </button>
  );
}

function renderAt(path: string, client: ReturnType<typeof apiWith>['client']) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/ideas"
          element={<IdeasPage upcycle={client.upcycle} favorites={noFavorites} />}
        />
        <Route path="/resultado" element={<ResultPage classify={client.classify} />} />
        <Route path="/entrar" element={<FakeLogin />} />
      </Routes>
    </MemoryRouter>,
  );
}

const SAVE_BUTTON = { name: 'Guardar este escaneo' };

beforeEach(() => {
  URL.revokeObjectURL = vi.fn();
  usePhotoStore.setState({ photo: storedPhoto, results: {}, chats: {} });
  useAuthStore.setState({ session: null, ready: true });
  clearFavorites();
});

describe('Escaneo no guardado (HU-12)', () => {
  it('anónimo → inicia sesión → vuelve a /ideas → «Guardar este escaneo» → aparece el corazón', async () => {
    const { client, fetchFn, authOf } = apiWith(upcycleResponse(false), upcycleResponse(true));
    renderAt('/ideas', client);
    await screen.findByRole('heading', { level: 1, name: 'Frasco de vidrio' });
    expect(authOf(0)).toBeNull();
    expect(screen.queryByRole('button', SAVE_BUTTON)).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('link', { name: 'Inicia sesión para guardar tus ideas favoritas' }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Entrar' }));

    // De vuelta en /ideas, la respuesta sale de la caché: aún sin corazón, con el aviso.
    await screen.findByRole('heading', { level: 1, name: 'Frasco de vidrio' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Este escaneo se hizo sin sesión y no quedó guardado')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Guardar en favoritos' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', SAVE_BUTTON));

    expect(await screen.findAllByRole('button', { name: 'Guardar en favoritos' })).toHaveLength(3);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn.mock.calls[1]?.[0]).toBe('https://api.test/api/v1/scan/upcycle');
    expect(authOf(1)).toBe('Bearer token-de-prueba');
    expect(screen.queryByRole('button', SAVE_BUTTON)).not.toBeInTheDocument();
    // La respuesta guardada reemplaza a la anónima en la caché.
    expect(usePhotoStore.getState().results.upcycle).toMatchObject({
      data: { saved: true },
      withSession: true,
    });
  });

  it('con sesión, si falló al guardar: «No pudimos guardar este escaneo» con «Reintentar»', async () => {
    useAuthStore.setState({ session: fakeSession(), ready: true });
    const { client, fetchFn, authOf } = apiWith(upcycleResponse(false), upcycleResponse(true));
    renderAt('/ideas', client);

    expect(await screen.findByText('No pudimos guardar este escaneo')).toBeVisible();
    expect(screen.queryByRole('button', SAVE_BUTTON)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findAllByRole('button', { name: 'Guardar en favoritos' })).toHaveLength(3);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(authOf(1)).toBe('Bearer token-de-prueba');
  });

  it('sin sesión no muestra el aviso', async () => {
    const { client } = apiWith(upcycleResponse(false));
    renderAt('/ideas', client);
    await screen.findByRole('heading', { level: 1, name: 'Frasco de vidrio' });
    expect(screen.queryByText(/no quedó guardado|No pudimos guardar/)).not.toBeInTheDocument();
  });

  it('con el escaneo guardado no muestra el aviso', async () => {
    useAuthStore.setState({ session: fakeSession(), ready: true });
    const { client } = apiWith(upcycleResponse(true));
    renderAt('/ideas', client);
    await screen.findAllByRole('button', { name: 'Guardar en favoritos' });
    expect(screen.queryByText(/no quedó guardado|No pudimos guardar/)).not.toBeInTheDocument();
  });

  it('en /resultado: anónimo y luego con sesión ofrece guardarlo y reenvía con el token', async () => {
    const { client, fetchFn, authOf } = apiWith(classifyResponse(false), classifyResponse(true));
    renderAt('/resultado', client);
    await screen.findByRole('heading', { level: 1, name: 'Botella de agua' });
    expect(screen.queryByRole('button', SAVE_BUTTON)).not.toBeInTheDocument();

    act(() => useAuthStore.setState({ session: fakeSession(), ready: true }));
    fireEvent.click(await screen.findByRole('button', SAVE_BUTTON));

    await waitFor(() => expect(usePhotoStore.getState().results.classify?.data.saved).toBe(true));
    await screen.findByRole('heading', { level: 1, name: 'Botella de agua' });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn.mock.calls[1]?.[0]).toBe('https://api.test/api/v1/scan/classify');
    expect(authOf(1)).toBe('Bearer token-de-prueba');
    expect(screen.queryByRole('button', SAVE_BUTTON)).not.toBeInTheDocument();
  });
});
