import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraPage } from './CameraPage';
import { PhotoError, type CompressedPhoto } from './compressImage';
import { usePhotoStore } from './photoStore';
import { useScanModeStore } from './scanModeStore';
import { CAMERA_CONSTRAINTS } from './useCamera';

const fakePhoto: CompressedPhoto = {
  base64: 'a'.repeat(200),
  mimeType: 'image/jpeg',
  width: 768,
  height: 576,
  bytes: 150,
  blob: new Blob(['x'], { type: 'image/jpeg' }),
};

const fakePhotoStored = {
  id: 1,
  base64: fakePhoto.base64,
  mimeType: fakePhoto.mimeType,
  width: fakePhoto.width,
  height: fakePhoto.height,
  bytes: fakePhoto.bytes,
};

const stopTrack = vi.fn();
let lastTrack = new EventTarget();
function fakeStream(): MediaStream {
  const track = Object.assign(new EventTarget(), { stop: stopTrack });
  lastTrack = track;
  return { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream;
}

function mockGetUserMedia(impl: () => Promise<MediaStream>) {
  const getUserMedia = vi.fn(impl);
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  });
  return getUserMedia;
}

function renderPage(props: Parameters<typeof CameraPage>[0] = {}) {
  return render(
    <MemoryRouter initialEntries={['/camara']}>
      <Routes>
        <Route path="/camara" element={<CameraPage {...props} />} />
        <Route path="/resultado" element={<p>Pantalla de resultado</p>} />
        <Route path="/ideas" element={<p>Pantalla de ideas</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  usePhotoStore.setState({ photo: null, results: {} });
  useScanModeStore.setState({ mode: 'classify' });
  stopTrack.mockClear();
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'mediaDevices');
});

describe('CameraPage', () => {
  it('con permiso concedido pide la cámara trasera y muestra la vista previa', async () => {
    const getUserMedia = mockGetUserMedia(() => Promise.resolve(fakeStream()));
    renderPage();
    expect(await screen.findByRole('button', { name: 'Tomar foto' })).toBeInTheDocument();
    expect(getUserMedia).toHaveBeenCalledWith(CAMERA_CONSTRAINTS);
    expect(CAMERA_CONSTRAINTS.video).toEqual({ facingMode: { ideal: 'environment' } });
    expect(screen.getByLabelText('Vista previa de la cámara')).not.toHaveClass('hidden');
    // La galería sigue disponible como opción secundaria.
    expect(screen.getByLabelText('Elegir de la galería')).toHaveAttribute('accept', 'image/*');
  });

  it('apaga la cámara al salir de la pantalla', async () => {
    mockGetUserMedia(() => Promise.resolve(fakeStream()));
    const { unmount } = renderPage();
    await screen.findByRole('button', { name: 'Tomar foto' });
    unmount();
    expect(stopTrack).toHaveBeenCalled();
  });

  it('con permiso negado explica el motivo y ofrece la galería', async () => {
    mockGetUserMedia(() => Promise.reject(new DOMException('denied', 'NotAllowedError')));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Necesitamos permiso');
    expect(screen.queryByRole('button', { name: 'Tomar foto' })).not.toBeInTheDocument();
    const input = screen.getByLabelText('Elegir de la galería');
    expect(input).toHaveAttribute('type', 'file');
    expect(input).not.toHaveAttribute('capture');
  });

  it('sin soporte de cámara ofrece la galería', () => {
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos abrir la cámara');
    expect(screen.getByLabelText('Elegir de la galería')).toBeInTheDocument();
  });

  it('al capturar muestra la foto con Repetir y Usar foto', async () => {
    const getUserMedia = mockGetUserMedia(() => Promise.resolve(fakeStream()));
    const compressFrame = vi.fn().mockResolvedValue(fakePhoto);
    renderPage({ compressFrame });
    fireEvent.click(await screen.findByRole('button', { name: 'Tomar foto' }));

    expect(await screen.findByAltText('Foto tomada')).toHaveAttribute('src', 'blob:preview');
    expect(compressFrame).toHaveBeenCalledWith(screen.getByLabelText('Vista previa de la cámara'));
    expect(screen.getByRole('button', { name: 'Repetir' })).toBeInTheDocument();
    // Con foto, la cámara queda apagada.
    expect(stopTrack).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Repetir' }));
    expect(screen.queryByAltText('Foto tomada')).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
    expect(await screen.findByRole('button', { name: 'Tomar foto' })).toBeInTheDocument();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('si el sistema corta la cámara ofrece reintentar o usar la galería', async () => {
    const getUserMedia = mockGetUserMedia(() => Promise.resolve(fakeStream()));
    renderPage();
    await screen.findByRole('button', { name: 'Tomar foto' });

    act(() => {
      lastTrack.dispatchEvent(new Event('ended'));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Se perdió la conexión con la cámara');
    expect(screen.queryByRole('button', { name: 'Tomar foto' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Elegir de la galería')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar cámara' }));
    expect(await screen.findByRole('button', { name: 'Tomar foto' })).toBeInTheDocument();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('empieza sin foto aunque quede una en el store', () => {
    usePhotoStore.setState({ photo: { ...fakePhotoStored, previewUrl: 'blob:vieja' } });
    renderPage();
    expect(screen.queryByAltText('Foto tomada')).not.toBeInTheDocument();
    expect(usePhotoStore.getState().photo).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:vieja');
  });

  it('Usar foto guarda la foto comprimida y va al resultado', async () => {
    const compressFile = vi.fn().mockResolvedValue(fakePhoto);
    renderPage({ compressFile });
    const file = new File(['img'], 'residuo.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Elegir de la galería'), { target: { files: [file] } });

    fireEvent.click(await screen.findByRole('button', { name: 'Usar foto' }));
    expect(compressFile).toHaveBeenCalledWith(file);
    expect(screen.getByText('Pantalla de resultado')).toBeInTheDocument();
    const stored = usePhotoStore.getState().photo;
    expect(stored).toMatchObject({ base64: fakePhoto.base64, previewUrl: 'blob:preview' });
    expect(stored).not.toHaveProperty('blob');
  });

  it('no guarda la foto si el usuario sale mientras se comprime', async () => {
    let resolve: (photo: CompressedPhoto) => void = () => undefined;
    const compressFile = vi.fn(() => new Promise<CompressedPhoto>((r) => (resolve = r)));
    const { unmount } = renderPage({ compressFile });
    fireEvent.change(screen.getByLabelText('Elegir de la galería'), {
      target: { files: [new File(['img'], 'residuo.jpg')] },
    });
    unmount();
    await act(async () => resolve(fakePhoto));
    expect(usePhotoStore.getState().photo).toBeNull();
  });

  it('muestra en español el error de una imagen inválida', async () => {
    const compressFile = vi.fn().mockRejectedValue(new PhotoError('No pudimos abrir esa imagen.'));
    renderPage({ compressFile });
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Elegir de la galería'), {
        target: { files: [new File(['x'], 'x.txt')] },
      });
    });
    expect(screen.getByText('No pudimos abrir esa imagen.')).toBeInTheDocument();
  });

  describe('modo de escaneo (HU-03)', () => {
    const modeRadio = (name: string) => screen.getByRole('radio', { name });

    async function choosePhoto() {
      fireEvent.change(screen.getByLabelText('Elegir de la galería'), {
        target: { files: [new File(['img'], 'residuo.jpg', { type: 'image/jpeg' })] },
      });
      return screen.findByRole('button', { name: 'Usar foto' });
    }

    it('Clasificar está activo por defecto en un grupo accesible', () => {
      expect(useScanModeStore.getInitialState().mode).toBe('classify');
      mockGetUserMedia(() => Promise.reject(new DOMException('', 'NotAllowedError')));
      renderPage();
      expect(screen.getByRole('group', { name: 'Modo de escaneo' })).toBeInTheDocument();
      expect(modeRadio('Clasificar')).toBeChecked();
      expect(modeRadio('Dar segunda vida')).not.toBeChecked();
    });

    it('el interruptor cambia el modo y lo anuncia como marcado', () => {
      mockGetUserMedia(() => Promise.reject(new DOMException('', 'NotAllowedError')));
      renderPage();
      fireEvent.click(modeRadio('Dar segunda vida'));
      expect(modeRadio('Dar segunda vida')).toBeChecked();
      expect(modeRadio('Clasificar')).not.toBeChecked();
      expect(useScanModeStore.getState().mode).toBe('upcycle');
    });

    it('conserva la última elección durante la sesión', () => {
      mockGetUserMedia(() => Promise.reject(new DOMException('', 'NotAllowedError')));
      const first = renderPage();
      fireEvent.click(modeRadio('Dar segunda vida'));
      first.unmount();

      renderPage();
      expect(modeRadio('Dar segunda vida')).toBeChecked();
    });

    it('el modo sigue visible en la vista previa y Dar segunda vida lleva a /ideas', async () => {
      mockGetUserMedia(() => Promise.reject(new DOMException('', 'NotAllowedError')));
      renderPage({ compressFile: vi.fn().mockResolvedValue(fakePhoto) });
      fireEvent.click(modeRadio('Dar segunda vida'));
      const usePhoto = await choosePhoto();

      expect(screen.getByAltText('Foto tomada')).toBeInTheDocument();
      expect(modeRadio('Dar segunda vida')).toBeChecked();
      fireEvent.click(usePhoto);
      expect(screen.getByText('Pantalla de ideas')).toBeInTheDocument();
    });

    it('en la vista previa aún se puede volver a Clasificar', async () => {
      mockGetUserMedia(() => Promise.reject(new DOMException('', 'NotAllowedError')));
      useScanModeStore.setState({ mode: 'upcycle' });
      renderPage({ compressFile: vi.fn().mockResolvedValue(fakePhoto) });
      const usePhoto = await choosePhoto();
      fireEvent.click(modeRadio('Clasificar'));
      fireEvent.click(usePhoto);
      expect(screen.getByText('Pantalla de resultado')).toBeInTheDocument();
    });
  });
});
