import type { ClassifyResponse } from '@ecoclasifica/shared';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/errors';
import { usePhotoStore } from '../camera/photoStore';
import { ResultPage } from './ResultPage';

const response: ClassifyResponse = {
  scanId: null,
  mode: 'classify',
  result: {
    object: 'Botella',
    material: 'plastico',
    materialDetail: 'Plástico PET',
    confidence: 0.93,
    lowConfidence: false,
    alternatives: [],
  },
  disposal: {
    binCode: 'WHITE',
    binName: 'Caneca blanca',
    colorHex: '#FFFFFF',
    icon: 'recycle',
    instructions: 'Limpia y seca.',
    requiresDropOff: false,
  },
  saved: false,
};

const storedPhoto = {
  base64: 'a'.repeat(200),
  mimeType: 'image/jpeg' as const,
  width: 768,
  height: 576,
  bytes: 150,
  previewUrl: 'blob:preview',
};

function renderPage(classify: NonNullable<Parameters<typeof ResultPage>[0]>['classify']) {
  return render(
    <MemoryRouter initialEntries={['/resultado']}>
      <Routes>
        <Route path="/resultado" element={<ResultPage classify={classify} />} />
        <Route path="/camara" element={<p>Pantalla de cámara</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  URL.revokeObjectURL = vi.fn();
  usePhotoStore.setState({ photo: storedPhoto });
});

describe('ResultPage', () => {
  it('envía la foto y muestra material, contenedor y certeza', async () => {
    const classify = vi.fn().mockResolvedValue(response);
    renderPage(classify);
    expect(screen.getByRole('status')).toHaveTextContent('Analizando la foto');
    expect(await screen.findByText('Plástico PET')).toBeInTheDocument();
    expect(screen.getByText('Caneca blanca')).toBeInTheDocument();
    expect(screen.getByText('93 %')).toBeInTheDocument();
    expect(classify).toHaveBeenCalledWith(
      { image: storedPhoto.base64, mimeType: 'image/jpeg' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('muestra el error en español y permite reintentar', async () => {
    const classify = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('AI_TIMEOUT', 504))
      .mockResolvedValueOnce(response);
    renderPage(classify);
    expect(await screen.findByRole('alert')).toHaveTextContent('El análisis tardó demasiado');

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Caneca blanca')).toBeInTheDocument();
    expect(classify).toHaveBeenCalledTimes(2);
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
    await act(async () => lateResolve(response));
    expect(screen.queryByText('Caneca blanca')).not.toBeInTheDocument();
  });

  it('Tomar otra foto descarta la foto y vuelve a la cámara', async () => {
    renderPage(vi.fn().mockRejectedValue(new ApiError('NETWORK_ERROR')));
    fireEvent.click(await screen.findByRole('button', { name: 'Tomar otra foto' }));
    expect(screen.getByText('Pantalla de cámara')).toBeInTheDocument();
    expect(usePhotoStore.getState().photo).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });

  it('sin foto en el store redirige a la cámara sin llamar a la API', () => {
    usePhotoStore.setState({ photo: null });
    const classify = vi.fn();
    renderPage(classify);
    expect(screen.getByText('Pantalla de cámara')).toBeInTheDocument();
    expect(classify).not.toHaveBeenCalled();
  });
});
