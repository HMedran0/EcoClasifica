import { create } from 'zustand';

export type ScanMode = 'classify' | 'upcycle';

export const MODE_LABELS: Record<ScanMode, string> = {
  classify: 'Clasificar',
  upcycle: 'Dar segunda vida',
};

interface ScanModeState {
  mode: ScanMode;
  setMode: (mode: ScanMode) => void;
}

/**
 * HU-03: modo de escaneo. Solo en memoria: al abrir la app empieza en Clasificar y durante la
 * sesión conserva la última elección.
 */
export const useScanModeStore = create<ScanModeState>((set) => ({
  mode: 'classify',
  setMode: (mode) => set({ mode }),
}));
