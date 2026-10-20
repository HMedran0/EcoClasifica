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

/**
 * Última respuesta de cada modo y la foto a la que corresponde (evita repetir la llamada a la IA).
 * `withSession`: si la petición salió con sesión (distingue «hecho sin sesión» de «falló al guardar»).
 */
export type ScanResults = {
  [M in ScanMode]?: { photoId: number; data: ScanResponses[M]; withSession?: boolean };
};

/**
 * Hilos del chat en memoria. Los de la foto actual van por `ideaIndex` de su última respuesta de
 * upcycle; los de ideas del historial, por `historial:<scanId>:<ideaIndex>` (HU-13).
 */
export type ChatThreads = Partial<Record<string, ChatMessage[]>>;

interface PhotoState {
  photo: StoredPhoto | null;
  results: ScanResults;
  chats: ChatThreads;
  setPhoto: (photo: CompressedPhoto) => void;
  clear: () => void;
  saveResult: <M extends ScanMode>(
    mode: M,
    photoId: number,
    data: ScanResponses[M],
    withSession?: boolean,
  ) => void;
  saveChat: (threadKey: string, messages: ChatMessage[]) => void;
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
  saveResult: (mode, photoId, data, withSession = false) =>
    set((state) => ({
      results: { ...state.results, [mode]: { photoId, data, withSession } },
      ...(mode === 'upcycle' ? { chats: historyThreads(state.chats) } : {}),
    })),
  saveChat: (threadKey, messages) =>
    set((state) => ({ chats: { ...state.chats, [threadKey]: messages } })),
}));

/** Los hilos de ideas del historial no dependen de la foto actual: sobreviven a ideas nuevas. */
function historyThreads(chats: ChatThreads): ChatThreads {
  return Object.fromEntries(Object.entries(chats).filter(([key]) => key.startsWith('historial:')));
}

function revoke(photo: StoredPhoto | null): void {
  if (photo) URL.revokeObjectURL(photo.previewUrl);
}
