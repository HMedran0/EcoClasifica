import type { ClassifyResponse, UpcycleResponse } from '@ecoclasifica/shared';
import { create } from 'zustand';
import type { CompressedPhoto } from './compressImage';
import type { ScanMode } from './scanModeStore';

/** Foto lista para enviar; el JPEG original solo vive en la object URL de la vista previa. */
export type StoredPhoto = Omit<CompressedPhoto, 'blob'> & { id: number; previewUrl: string };

export interface ScanResponses {
  classify: ClassifyResponse;
  upcycle: UpcycleResponse;
}

/** Última respuesta de cada modo y la foto a la que corresponde (evita repetir la llamada a la IA). */
export type ScanResults = { [M in ScanMode]?: { photoId: number; data: ScanResponses[M] } };

interface PhotoState {
  photo: StoredPhoto | null;
  results: ScanResults;
  setPhoto: (photo: CompressedPhoto) => void;
  clear: () => void;
  saveResult: <M extends ScanMode>(mode: M, photoId: number, data: ScanResponses[M]) => void;
}

let nextPhotoId = 1;

export const usePhotoStore = create<PhotoState>((set, get) => ({
  photo: null,
  results: {},
  // Cambiar o descartar la foto borra las respuestas guardadas.
  setPhoto: ({ blob, ...rest }) => {
    revoke(get().photo);
    const photo = { ...rest, id: nextPhotoId++, previewUrl: URL.createObjectURL(blob) };
    set({ photo, results: {} });
  },
  clear: () => {
    revoke(get().photo);
    set({ photo: null, results: {} });
  },
  saveResult: (mode, photoId, data) =>
    set((state) => ({ results: { ...state.results, [mode]: { photoId, data } } })),
}));

function revoke(photo: StoredPhoto | null): void {
  if (photo) URL.revokeObjectURL(photo.previewUrl);
}
