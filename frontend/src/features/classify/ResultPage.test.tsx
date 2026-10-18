import type { ClassifyResponse, Disposal } from '@ecoclasifica/shared';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/errors';
import { usePhotoStore } from '../camera/photoStore';
import { ResultPage } from './ResultPage';

const whiteBin: Disposal = {
  binCode: 'WHITE',
  binName: 'Contenedor blanco (aprovechables)',
  colorHex: '#F5F5F5',
  icon: 'bin-white',
  instructions: 'Vacíalo, aplástalo y ponle la tapa.',
  requiresDropOff: false,
};
const dropOff: Disposal = {
  binCode: 'DROP_OFF',
  binName: 'Punto limpio',
  colorHex: '#F9A825',
  icon: 'drop-off',
  instructions: 'Pilas, aceites y bombillas van a un punto de acopio.',
  requiresDropOff: true,
};

function response(
  overrides: Partial<ClassifyResponse['result']> = {},
  disposal: Disposal | null = whiteBin,
): ClassifyResponse {
  return {
    scanId: null,
    mode: 'classify',
    result: {
      object: 'Botella',
      material: 'plastico',
      materialDetail: 'PET',
      confidence: 0.93,
      lowConfidence: false,
      alternatives: [],
      ...overrides,
    },
    disposal,
    saved: false,
  };
}

const unsure = {
  confidence: 0.45,
  lowConfidence: true,
  alternatives: [
    { material: 'vidrio' as const, confidence: 0.3 },
    { material: 'metal' as const, confidence: 0.1 },
  ],
};

const storedPhoto = {
  base64: 'a'.repeat(200),
  mimeType: 'image/jpeg' as const,
  width: 768,
  height: 576,
  bytes: 150,
  previewUrl: 'blob:preview',
};

type Classify = NonNullable<Parameters<typeof ResultPage>[0]>['classify'];

function renderPage(classify: Classify) {
  return render(
    <MemoryRouter initialEntries={['/resultado']}>
      <Routes>
        <Route path="/resultado" element={<ResultPage classify={classify} />} />
        <Route path="/camara" element={<p>Pantalla de cámara</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const liveRegion = () => document.querySelector('[aria-live="polite"]') as HTMLElement;

beforeEach(() => {
  URL.revokeObjectURL = vi.fn();
  usePhotoStore.setState({ photo: storedPhoto });
});

describe('ResultPage', () => {
  it('con certeza suficiente muestra foto, objeto, material, certeza y contenedor', async () => {
    const classify = vi.fn().mockResolvedValue(response());
    renderPage(classify);
    expect(await screen.findByRole('heading', { name: 'Botella' })).toBeInTheDocument();

    const live = within(liveRegion());
    expect(screen.getByAltText('Tu foto')).toHaveAttribute('src', 'blob:preview');
    expect(live.getByText('Plástico')).toBeInTheDocument();
    expect(live.getByText(/· PET/)).toBeInTheDocument();
    expect(live.getByText('Certeza: 93 %')).toBeInTheDocument();
    expect(live.getByRole('heading', { name: whiteBin.binName })).toBeInTheDocument();
    expect(live.getByText(whiteBin.instructions)).toBeInTheDocument();
    expect(live.getByTestId('bin-swatch')).toHaveStyle({ backgroundColor: '#F5F5F5' });
    expect(screen.getByRole('button', { name: 'Escanear otro residuo' })).toBeInTheDocument();
    expect(classify).toHaveBeenCalledWith(
      { image: storedPhoto.base64, mimeType: 'image/jpeg' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('punto limpio: «Llevar a punto limpio» con su instrucción y sin contenedor doméstico', async () => {
    renderPage(vi.fn().mockResolvedValue(response({ material: 'peligroso' }, dropOff)));
    expect(await screen.findByRole('heading', { name: 'Llevar a punto limpio' })).toBeVisible();
    expect(screen.getByText(dropOff.instructions)).toBeInTheDocument();
    expect(screen.queryByText('Deposítalo en')).not.toBeInTheDocument();
    expect(screen.queryByText('No estoy seguro')).not.toBeInTheDocument();
  });

  it('punto limpio con baja certeza: aviso y alternativas encima de la tarjeta', async () => {
    renderPage(vi.fn().mockResolvedValue(response({ material: 'peligroso', ...unsure }, dropOff)));
    const notice = await screen.findByRole('heading', { name: 'No estoy seguro' });
    const card = screen.getByRole('heading', { name: 'Llevar a punto limpio' });
    // El aviso va antes que la tarjeta en el orden del documento.
    expect(notice.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Vidrio (30 %)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Repetir foto' })).toBeInTheDocument();
  });

  it('baja certeza: «No estoy seguro», hasta 2 alternativas y Repetir foto', async () => {
    renderPage(vi.fn().mockResolvedValue(response(unsure, null)));
    expect(await screen.findByRole('heading', { name: 'No estoy seguro' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Vidrio (30 %)',
      'Metal (10 %)',
    ]);
    expect(screen.queryByTestId('bin-swatch')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Repetir foto' }));
    expect(screen.getByText('Pantalla de cámara')).toBeInTheDocument();
    expect(usePhotoStore.getState().photo).toBeNull();
  });

  it('sin regla: material y «No pudimos obtener dónde depositarlo» con Reintentar', async () => {
    const classify = vi
      .fn()
      .mockResolvedValueOnce(response({}, null))
      .mockResolvedValueOnce(response());
    renderPage(classify);
    expect(await screen.findByText(/No pudimos obtener dónde depositarlo/)).toBeInTheDocument();
    expect(screen.getByText('Plástico')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { name: whiteBin.binName })).toBeInTheDocument();
    expect(classify).toHaveBeenCalledTimes(2);
  });

  it('NOT_A_WASTE: alerta «No parece un residuo» y Tomar otra foto', async () => {
    renderPage(vi.fn().mockRejectedValue(new ApiError('NOT_A_WASTE', 422)));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No parece un residuo');
    expect(liveRegion()).not.toContainElement(alert);
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tomar otra foto' }));
    expect(screen.getByText('Pantalla de cámara')).toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });

  it('otros errores: alerta en español y Reintentar', async () => {
    const classify = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('AI_TIMEOUT', 504))
      .mockResolvedValueOnce(response());
    renderPage(classify);
    expect(await screen.findByRole('alert')).toHaveTextContent('El análisis tardó demasiado');

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { name: 'Botella' })).toBeInTheDocument();
    expect(classify).toHaveBeenCalledTimes(2);
  });

  it('mientras carga muestra progreso y Cancelar aborta y vuelve a la cámara', () => {
    let signal: AbortSignal | undefined;
    const classify = vi.fn((_req: unknown, opts?: { signal?: AbortSignal }) => {
      signal = opts?.signal;
      return new Promise<ClassifyResponse>(() => undefined);
    });
    renderPage(classify);
    expect(screen.getByRole('progressbar', { name: 'Analizando la foto' })).toBeInTheDocument();
    expect(liveRegion()).toHaveAttribute('aria-busy', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(signal?.aborted).toBe(true);
    expect(screen.getByText('Pantalla de cámara')).toBeInTheDocument();
    expect(usePhotoStore.getState().photo).toBeNull();
  });

  it('ignora la respuesta tardía de una petición cancelada', async () => {
    let lateResolve: (r: ClassifyResponse) => void = () => undefined;
    const classify = vi
      .fn()
      .mockImplementationOnce(() => new Promise<ClassifyResponse>((r) => (lateResolve = r)))
      .mockRejectedValueOnce(new ApiError('AI_TIMEOUT', 504));
    renderPage(classify);
    // Una foto nueva relanza el efecto y cancela la primera petición.
    act(() => usePhotoStore.setState({ photo: { ...storedPhoto, base64: 'b'.repeat(200) } }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El análisis tardó demasiado');
    await act(async () => lateResolve(response()));
    expect(screen.queryByRole('heading', { name: 'Botella' })).not.toBeInTheDocument();
  });

  it('sin detalle ni objeto: sin separador colgando y con el material como título', async () => {
    renderPage(vi.fn().mockResolvedValue(response({ object: ' ', materialDetail: '' })));
    expect(await screen.findByRole('heading', { level: 1, name: 'Plástico' })).toBeInTheDocument();
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });

  it('no repite el material principal entre las alternativas', async () => {
    const alternatives = [
      { material: 'plastico' as const, confidence: 0.3 },
      { material: 'vidrio' as const, confidence: 0.2 },
    ];
    renderPage(vi.fn().mockResolvedValue(response({ ...unsure, alternatives }, null)));
    await screen.findByRole('heading', { name: 'No estoy seguro' });
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Vidrio (20 %)']);
  });

  it('al cambiar de estado el foco pasa al título', async () => {
    renderPage(vi.fn().mockRejectedValue(new ApiError('AI_TIMEOUT', 504)));
    const title = await screen.findByRole('heading', { name: 'No pudimos analizar la foto' });
    expect(title).toHaveFocus();
  });

  it('sin foto en el store redirige a la cámara sin llamar a la API', () => {
    usePhotoStore.setState({ photo: null });
    const classify = vi.fn();
    renderPage(classify);
    expect(screen.getByText('Pantalla de cámara')).toBeInTheDocument();
    expect(classify).not.toHaveBeenCalled();
  });
});
