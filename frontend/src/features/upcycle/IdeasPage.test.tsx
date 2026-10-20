import type { ClassifyResponse, UpcycleResponse } from '@ecoclasifica/shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/errors';
import { usePhotoStore } from '../camera/photoStore';
import { ResultPage } from '../classify/ResultPage';
import { IdeasPage } from './IdeasPage';

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
        extraMaterials: ['Pintura'],
      },
      { ideaIndex: 1, title: 'Maceta', description: 'Siembra una suculenta.', extraMaterials: [] },
      {
        ideaIndex: 2,
        title: 'Lámpara',
        description: 'Con luces LED.',
        extraMaterials: ['Luces LED', 'Cinta'],
      },
    ],
  },
  saved: false,
};

const cannot: UpcycleResponse = {
  scanId: null,
  mode: 'upcycle',
  result: { canUpcycle: false, objectName: 'pila', reason: 'Es un residuo peligroso.' },
  saved: false,
};

const classified: ClassifyResponse = {
  scanId: null,
  mode: 'classify',
  result: {
    object: 'Pila',
    material: 'peligroso',
    materialDetail: '',
    confidence: 0.9,
    lowConfidence: false,
    alternatives: [],
  },
  disposal: {
    binCode: 'DROP_OFF',
    binName: 'Punto limpio',
    colorHex: '#F9A825',
    icon: 'drop-off',
    instructions: 'Llévala a un punto de acopio.',
    requiresDropOff: true,
  },
  saved: false,
};

type Upcycle = NonNullable<Parameters<typeof IdeasPage>[0]>['upcycle'];

function renderPage(upcycle: Upcycle, classify = vi.fn().mockResolvedValue(classified)) {
  return render(
    <MemoryRouter initialEntries={['/ideas']}>
      <Routes>
        <Route path="/ideas" element={<IdeasPage upcycle={upcycle} />} />
        <Route path="/resultado" element={<ResultPage classify={classify} />} />
        <Route path="/camara" element={<p>Pantalla de cámara</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const liveRegion = () => document.querySelector('[aria-live="polite"]') as HTMLElement;

beforeEach(() => {
  URL.revokeObjectURL = vi.fn();
  usePhotoStore.setState({ photo: storedPhoto, results: {} });
});

describe('IdeasPage', () => {
  it('muestra objeto, dificultad y 3 ideas no interactivas', async () => {
    const upcycle = vi.fn().mockResolvedValue(ideas);
    renderPage(upcycle);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Frasco de vidrio' }),
    ).toBeVisible();
    expect(screen.getByText('Modo Dar segunda vida')).toBeInTheDocument();
    expect(screen.getByText('Fácil')).toBeInTheDocument();

    const cards = within(liveRegion()).getAllByRole('listitem');
    expect(cards).toHaveLength(3);
    expect(within(cards[0]!).getByRole('heading', { name: 'Portalápices' })).toBeInTheDocument();
    expect(cards[0]).toHaveTextContent('Necesitas además: Pintura');
    expect(cards[1]).not.toHaveTextContent('Necesitas además');
    expect(cards[2]).toHaveTextContent('Luces LED, Cinta');
    expect(screen.getAllByText('Pronto: guía paso a paso')).toHaveLength(3);
    expect(within(liveRegion()).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Escanear otro residuo' })).toBeInTheDocument();
    expect(upcycle).toHaveBeenCalledWith(
      { image: storedPhoto.base64, mimeType: 'image/jpeg' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('canUpcycle false: motivo y «Ver dónde depositarlo» clasifica la misma foto', async () => {
    const classify = vi.fn().mockResolvedValue(classified);
    renderPage(vi.fn().mockResolvedValue(cannot), classify);
    expect(await screen.findByText('Es un residuo peligroso.')).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ver dónde depositarlo' }));
    expect(await screen.findByRole('heading', { name: 'Llevar a punto limpio' })).toBeVisible();
    expect(screen.getByText('Modo Clasificar')).toBeInTheDocument();
    expect(classify).toHaveBeenCalledWith(
      { image: storedPhoto.base64, mimeType: 'image/jpeg' },
      expect.anything(),
    );
    expect(usePhotoStore.getState().photo).toBe(storedPhoto);
  });

  it('montar /ideas dos veces con la misma foto llama a upcycle una sola vez', async () => {
    const upcycle = vi.fn().mockResolvedValue(cannot);
    const first = renderPage(upcycle);
    await screen.findByText('Es un residuo peligroso.');
    first.unmount();

    renderPage(upcycle);
    expect(screen.getByText('Es un residuo peligroso.')).toBeInTheDocument();
    expect(upcycle).toHaveBeenCalledTimes(1);

    // Ida y vuelta a /resultado tampoco repite la llamada.
    fireEvent.click(screen.getByRole('button', { name: 'Ver dónde depositarlo' }));
    await screen.findByRole('heading', { name: 'Llevar a punto limpio' });
    expect(upcycle).toHaveBeenCalledTimes(1);
  });

  it('no reutiliza la respuesta de otra foto', () => {
    usePhotoStore.setState({ results: { upcycle: { photoId: 99, data: cannot } } });
    const upcycle = vi.fn(() => new Promise<UpcycleResponse>(() => undefined));
    renderPage(upcycle);
    expect(screen.getByRole('progressbar', { name: 'Buscando ideas' })).toBeInTheDocument();
    expect(upcycle).toHaveBeenCalledTimes(1);
  });

  it('NOT_A_WASTE: alerta «No parece un residuo» y Tomar otra foto', async () => {
    renderPage(vi.fn().mockRejectedValue(new ApiError('NOT_A_WASTE', 422)));
    expect(await screen.findByRole('alert')).toHaveTextContent('No parece un residuo');
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tomar otra foto' }));
    expect(screen.getByText('Pantalla de cámara')).toBeInTheDocument();
    expect(usePhotoStore.getState()).toMatchObject({ photo: null, results: {} });
  });

  it('sin conexión: mismo mensaje que /resultado y Reintentar', async () => {
    const upcycle = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR'))
      .mockResolvedValueOnce(ideas);
    renderPage(upcycle);
    expect(await screen.findByRole('alert')).toHaveTextContent('No hay conexión con el servidor');

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { name: 'Frasco de vidrio' })).toBeInTheDocument();
    expect(upcycle).toHaveBeenCalledTimes(2);
  });

  it('mientras carga, Cancelar aborta y vuelve a la cámara', () => {
    let signal: AbortSignal | undefined;
    const upcycle = vi.fn((_req: unknown, opts?: { signal?: AbortSignal }) => {
      signal = opts?.signal;
      return new Promise<UpcycleResponse>(() => undefined);
    });
    renderPage(upcycle);
    expect(screen.getByRole('progressbar', { name: 'Buscando ideas' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(signal?.aborted).toBe(true);
    expect(screen.getByText('Pantalla de cámara')).toBeInTheDocument();
    expect(usePhotoStore.getState().photo).toBeNull();
  });
});
