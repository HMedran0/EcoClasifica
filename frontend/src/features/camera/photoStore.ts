import type { ChatMessage, ClassifyResponse, UpcycleResponse } from '@ecoclasifica/shared';
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

/** Hilos del chat de la foto actual, por `ideaIndex` de su última respuesta de upcycle. */
export type ChatThreads = Partial<Record<number, ChatMessage[]>>;

interface PhotoState {
  photo: StoredPhoto | null;
  results: ScanResults;
  chats: ChatThreads;
  setPhoto: (photo: CompressedPhoto) => void;
  clear: () => void;
  saveResult: <M extends ScanMode>(mode: M, photoId: number, data: ScanResponses[M]) => void;
  saveChat: (ideaIndex: number, messages: ChatMessage[]) => void;
}

let nextPhotoId = 1;

export const usePhotoStore = create<PhotoState>((set, get) => ({
  photo: null,
  results: {},
  chats: {},
  // Cambiar o descartar la foto borra las respuestas guardadas y las conversaciones.
  setPhoto: ({ blob, ...rest }) => {
    revoke(get().photo);
    const photo = { ...rest, id: nextPhotoId++, previewUrl: URL.createObjectURL(blob) };
    set({ photo, results: {}, chats: {} });
  },
  clear: () => {
    revoke(get().photo);
    set({ photo: null, results: {}, chats: {} });
  },
  // Ideas nuevas (p. ej. tras «Reintentar») invalidan los hilos de las anteriores.
  saveResult: (mode, photoId, data) =>
    set((state) => ({
      results: { ...state.results, [mode]: { photoId, data } },
      ...(mode === 'upcycle' ? { chats: {} } : {}),
    })),
  saveChat: (ideaIndex, messages) =>
    set((state) => ({ chats: { ...state.chats, [ideaIndex]: messages } })),
}));

function revoke(photo: StoredPhoto | null): void {
  if (photo) URL.revokeObjectURL(photo.previewUrl);
}
