import { useEffect, useRef, useState } from 'react';
import type { RequestOptions, ScanRequestInput } from '../../api/client';
import { ApiError, errorMessage, type ApiErrorCode } from '../../api/errors';
import { usePhotoStore, type ScanResponses, type StoredPhoto } from '../camera/photoStore';
import type { ScanMode } from '../camera/scanModeStore';

export type ScanState<T> =
  | { kind: 'loading' }
  | { kind: 'success'; data: T }
  | { kind: 'error'; code: ApiErrorCode; message: string };

export type ScanRequest<T> = (req: ScanRequestInput, opts?: RequestOptions) => Promise<T>;

/**
 * Envía la foto de `photoStore` al modo indicado. Si ya hay una respuesta de ese modo para la
 * misma foto, la reutiliza sin llamar a la IA; «Reintentar» la ignora y pide una nueva.
 */
export function useScan<M extends ScanMode>(mode: M, request: ScanRequest<ScanResponses[M]>) {
  const photo = usePhotoStore((s) => s.photo);
  const clearPhoto = usePhotoStore((s) => s.clear);
  const saveResult = usePhotoStore((s) => s.saveResult);
  const [state, setState] = useState<ScanState<ScanResponses[M]>>(() => initialState(mode, photo));
  const [attempt, setAttempt] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const handledAttemptRef = useRef(0);

  useEffect(() => {
    if (!photo) return;
    // El estado inicial ya trae la respuesta guardada; solo un «Reintentar» nuevo la salta
    // (no cualquier otro cambio de dependencias después de reintentar).
    const retried = attempt !== handledAttemptRef.current;
    handledAttemptRef.current = attempt;
    if (!retried && cachedFor(mode, photo)) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    request({ image: photo.base64, mimeType: photo.mimeType }, { signal: controller.signal }).then(
      // Una respuesta tardía de una petición cancelada (reintento, salida) no pisa el estado actual.
      (data) => {
        if (controller.signal.aborted) return;
        saveResult(mode, photo.id, data);
        setState({ kind: 'success', data });
      },
      (err: unknown) => {
        if (controller.signal.aborted) return;
        const code = err instanceof ApiError ? err.code : 'UNEXPECTED_RESPONSE';
        setState({ kind: 'error', code, message: errorMessage(code) });
      },
    );
    return () => controller.abort();
  }, [mode, request, photo, attempt, saveResult]);

  function retry() {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }

  /** Aborta la petición en curso y vacía el store; la página redirige a la cámara al no haber foto. */
  function backToCamera() {
    controllerRef.current?.abort();
    clearPhoto();
  }

  return { photo, state, retry, backToCamera };
}

function cachedFor<M extends ScanMode>(mode: M, photo: StoredPhoto): ScanResponses[M] | null {
  const cached = usePhotoStore.getState().results[mode];
  return cached?.photoId === photo.id ? cached.data : null;
}

function initialState<M extends ScanMode>(
  mode: M,
  photo: StoredPhoto | null,
): ScanState<ScanResponses[M]> {
  const data = photo && cachedFor(mode, photo);
  return data ? { kind: 'success', data } : { kind: 'loading' };
}
