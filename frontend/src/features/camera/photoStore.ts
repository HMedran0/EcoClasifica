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
  /** HU-14: olvida lo que dependía de escaneos borrados (la foto se conserva). */
  forgetScans: (target: ForgottenScans) => void;
}

/** Un escaneo con las ideas que tenía guardadas, o todo el historial. */
export type ForgottenScans = { scanId: string; ideaIds: string[] } | 'all';

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
  forgetScans: (target) => set((state) => withoutScans(state, target)),
}));

/**
 * Quita la respuesta en caché si era de un escaneo borrado (con los hilos de la foto actual, si
 * era la de upcycle), los hilos `historial:<scanId>:…` y los `idea:<ideaId>` de sus ideas.
 */
function withoutScans(
  { results, chats }: Pick<PhotoState, 'results' | 'chats'>,
  target: ForgottenScans,
): Pick<PhotoState, 'results' | 'chats'> {
  const gone = (scanId: string | null) =>
    scanId !== null && (target === 'all' || scanId === target.scanId);
  const ideaIds = new Set(target === 'all' ? [] : target.ideaIds);
  const { classify, upcycle } = results;
  const dropUpcycle = upcycle !== undefined && gone(upcycle.data.scanId);
  if (dropUpcycle && upcycle.data.result.canUpcycle) {
    for (const idea of upcycle.data.result.ideas) if (idea.ideaId) ideaIds.add(idea.ideaId);
  }
  const keep = (key: string) => {
    if (key.startsWith('historial:')) return !gone(key.split(':')[1] ?? null);
    if (key.startsWith('idea:')) return target !== 'all' && !ideaIds.has(key.slice('idea:'.length));
    // Los de un favorito se arman desde su copia, que se conserva.
    if (key.startsWith('favorito:')) return true;
    return !dropUpcycle;
  };
  return {
    results: {
      ...(classify && !gone(classify.data.scanId) ? { classify } : {}),
      ...(upcycle && !dropUpcycle ? { upcycle } : {}),
    },
    chats: Object.fromEntries(Object.entries(chats).filter(([key]) => keep(key))),
  };
}

/** Los hilos de ideas del historial no dependen de la foto actual: sobreviven a ideas nuevas. */
function historyThreads(chats: ChatThreads): ChatThreads {
  return Object.fromEntries(Object.entries(chats).filter(([key]) => key.startsWith('historial:')));
}

function revoke(photo: StoredPhoto | null): void {
  if (photo) URL.revokeObjectURL(photo.previewUrl);
}
