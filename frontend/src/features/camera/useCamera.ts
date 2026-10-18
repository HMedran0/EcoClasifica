import { useCallback, useEffect, useRef, useState } from 'react';

/** `stopped`: la apagamos nosotros (hay foto); `ended`: la cortó el sistema. */
export type CameraStatus = 'starting' | 'live' | 'stopped' | 'ended' | 'denied' | 'unavailable';

/** Cámara trasera por defecto; `ideal` permite seguir con la frontal en equipos sin trasera. */
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: { facingMode: { ideal: 'environment' } },
  audio: false,
};

/** Abre la cámara al montar y la apaga al desmontar (también si el permiso llega tarde). */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Cada apertura o cierre invalida las solicitudes de `getUserMedia` que sigan pendientes.
  const generationRef = useRef(0);
  const [status, setStatus] = useState<CameraStatus>(() =>
    hasGetUserMedia() ? 'starting' : 'unavailable',
  );

  const release = useCallback(() => {
    generationRef.current++;
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) stopTracks(stream);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const open = useCallback(() => {
    if (!hasGetUserMedia()) return;
    release();
    const generation = generationRef.current;
    navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS).then(
      (stream) => {
        if (generation !== generationRef.current) return stopTracks(stream);
        streamRef.current = stream;
        stream.getVideoTracks().forEach((track) =>
          track.addEventListener('ended', () => {
            if (streamRef.current !== stream) return;
            release();
            setStatus('ended');
          }),
        );
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStatus('live');
      },
      (err: unknown) => {
        if (generation !== generationRef.current) return;
        setStatus(isPermissionDenied(err) ? 'denied' : 'unavailable');
      },
    );
  }, [release]);

  useEffect(() => {
    open();
    return release;
  }, [open, release]);

  /** Apaga todas las pistas (al tener foto): libera la cámara y su indicador. */
  const stop = useCallback(() => {
    release();
    setStatus('stopped');
  }, [release]);

  /** Vuelve a abrir la cámara (Repetir, Reintentar cámara). */
  const start = useCallback(() => {
    if (!hasGetUserMedia()) return setStatus('unavailable');
    setStatus('starting');
    open();
  }, [open]);

  return { videoRef, status, start, stop };
}

function hasGetUserMedia(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

function stopTracks(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}

function isPermissionDenied(err: unknown): boolean {
  const name = typeof err === 'object' && err !== null && 'name' in err ? err.name : null;
  return name === 'NotAllowedError' || name === 'SecurityError';
}
