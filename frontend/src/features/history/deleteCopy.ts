import { BUTTON } from '../scan/ScanScreen';

/** HU-14: textos y estilo compartidos por «Eliminar escaneo» y «Eliminar todo mi historial». */
export const DELETE_WARNING = 'No se puede deshacer. Tus ideas favoritas se conservarán.';
export const SCAN_DELETED = 'Escaneo eliminado';
export const DELETE_BUTTON = `${BUTTON} border-2 border-red-700 text-red-700`;

export const historyDeleted = (count: number) =>
  `Historial eliminado (${count} ${count === 1 ? 'escaneo' : 'escaneos'})`;

/** Estado con el que se vuelve a /historial tras borrar. */
export interface HistoryLocationState {
  notice: string;
}
