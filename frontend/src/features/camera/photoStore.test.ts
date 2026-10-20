import type { UpcycleResponse } from '@ecoclasifica/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePhotoStore } from './photoStore';

const compressed = {
  base64: 'a'.repeat(200),
  mimeType: 'image/jpeg' as const,
  width: 768,
  height: 576,
  bytes: 150,
  blob: new Blob(['x'], { type: 'image/jpeg' }),
};

const saved: UpcycleResponse = {
  scanId: null,
  mode: 'upcycle',
  result: { canUpcycle: false, objectName: 'Pila', reason: 'Peligroso.' },
  saved: false,
};

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  usePhotoStore.setState({ photo: null, results: {} });
});

describe('photoStore', () => {
  it('cada foto nueva tiene otra identidad y borra las respuestas guardadas', () => {
    const { setPhoto, saveResult } = usePhotoStore.getState();
    setPhoto(compressed);
    const firstId = usePhotoStore.getState().photo!.id;
    saveResult('upcycle', firstId, saved);
    expect(usePhotoStore.getState().results.upcycle).toEqual({ photoId: firstId, data: saved });

    setPhoto(compressed);
    expect(usePhotoStore.getState().photo!.id).not.toBe(firstId);
    expect(usePhotoStore.getState().results).toEqual({});
  });

  it('descartar la foto borra las respuestas guardadas', () => {
    const { setPhoto, saveResult, clear } = usePhotoStore.getState();
    setPhoto(compressed);
    saveResult('upcycle', usePhotoStore.getState().photo!.id, saved);
    clear();
    expect(usePhotoStore.getState()).toMatchObject({ photo: null, results: {} });
  });
});
