import { create } from 'zustand';
import type { CompressedPhoto } from './compressImage';

/** Foto lista para enviar; el JPEG original solo vive en la object URL de la vista previa. */
export type StoredPhoto = Omit<CompressedPhoto, 'blob'> & { previewUrl: string };

interface PhotoState {
  photo: StoredPhoto | null;
  setPhoto: (photo: CompressedPhoto) => void;
  clear: () => void;
}

export const usePhotoStore = create<PhotoState>((set, get) => ({
  photo: null,
  setPhoto: ({ blob, ...rest }) => {
    revoke(get().photo);
    set({ photo: { ...rest, previewUrl: URL.createObjectURL(blob) } });
  },
  clear: () => {
    revoke(get().photo);
    set({ photo: null });
  },
}));

function revoke(photo: StoredPhoto | null): void {
  if (photo) URL.revokeObjectURL(photo.previewUrl);
}
