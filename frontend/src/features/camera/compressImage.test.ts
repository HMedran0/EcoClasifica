import { describe, expect, it, vi } from 'vitest';
import {
  compressImage,
  encodeWithinBudget,
  fitWithin,
  MAX_BYTES,
  PhotoError,
  type CompressDeps,
  type Drawable,
} from './compressImage';

const jpegOfSize = (bytes: number) => new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });

function fakeDeps(
  width: number,
  height: number,
  sizes: number[] = [1000],
): CompressDeps & {
  release: ReturnType<typeof vi.fn>;
  createEncoder: ReturnType<typeof vi.fn>;
} {
  const release = vi.fn();
  const drawable: Drawable = { source: {} as CanvasImageSource, width, height, release };
  let call = 0;
  return {
    release,
    decodeFile: vi.fn().mockResolvedValue(drawable),
    createEncoder: vi.fn(() => async () => jpegOfSize(sizes[Math.min(call++, sizes.length - 1)]!)),
  };
}

describe('fitWithin', () => {
  it('reduce una foto horizontal a 768 px de ancho', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 768, height: 576 });
  });

  it('reduce una foto vertical a 768 px de alto', () => {
    expect(fitWithin(3000, 4000)).toEqual({ width: 576, height: 768 });
  });

  it('no agranda una imagen pequeña', () => {
    expect(fitWithin(640, 480)).toEqual({ width: 640, height: 480 });
  });
});

describe('encodeWithinBudget', () => {
  it('usa calidad 0,7 si el resultado ya cabe', async () => {
    const encode = vi.fn().mockResolvedValue(jpegOfSize(MAX_BYTES));
    await encodeWithinBudget(encode);
    expect(encode.mock.calls).toEqual([[0.7]]);
  });

  it('baja de 0,1 en 0,1 hasta que cabe', async () => {
    const encode = vi
      .fn()
      .mockResolvedValueOnce(jpegOfSize(MAX_BYTES + 1))
      .mockResolvedValueOnce(jpegOfSize(200_000));
    const blob = await encodeWithinBudget(encode);
    expect(encode.mock.calls).toEqual([[0.7], [0.6]]);
    expect(blob.size).toBe(200_000);
  });

  it('se detiene en 0,5 aunque siga pasando del límite', async () => {
    const encode = vi.fn().mockResolvedValue(jpegOfSize(MAX_BYTES + 1));
    const blob = await encodeWithinBudget(encode);
    expect(encode.mock.calls).toEqual([[0.7], [0.6], [0.5]]);
    expect(blob.size).toBe(MAX_BYTES + 1);
  });
});

describe('compressImage', () => {
  it('devuelve Base64 sin prefijo, tipo, dimensiones y bytes', async () => {
    const deps = fakeDeps(3000, 4000, [MAX_BYTES + 5, 1200]);
    const photo = await compressImage(new Blob(['x']), deps);
    expect(deps.createEncoder).toHaveBeenCalledWith(expect.anything(), 576, 768);
    expect(photo).toMatchObject({ mimeType: 'image/jpeg', width: 576, height: 768, bytes: 1200 });
    expect(photo.base64).toBe(btoa('\0'.repeat(1200)));
    expect(photo.base64).not.toMatch(/^data:/);
    expect(deps.release).toHaveBeenCalled();
  });

  it('un archivo que no se puede decodificar da un mensaje en español', async () => {
    const deps: CompressDeps = {
      decodeFile: vi.fn().mockRejectedValue(new DOMException('bad', 'InvalidStateError')),
      createEncoder: vi.fn(),
    };
    const result = compressImage(new Blob(['no es una imagen']), deps);
    await expect(result).rejects.toBeInstanceOf(PhotoError);
    await expect(result).rejects.toThrow('No pudimos abrir esa imagen');
    expect(deps.createEncoder).not.toHaveBeenCalled();
  });

  it('una imagen sin dimensiones también es inválida', async () => {
    const deps = fakeDeps(0, 0);
    await expect(compressImage(new Blob(['x']), deps)).rejects.toThrow('No pudimos abrir');
    expect(deps.release).toHaveBeenCalled();
  });
});
