import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router';
import {
  compressImage,
  compressVideoFrame,
  PhotoError,
  type CompressedPhoto,
} from './compressImage';
import { ModeSwitch } from './ModeSwitch';
import { usePhotoStore } from './photoStore';
import { useScanModeStore } from './scanModeStore';
import { useCamera, type CameraStatus } from './useCamera';

const GENERIC_ERROR = 'No pudimos preparar la foto. Intenta de nuevo.';

const CAMERA_MESSAGE: Record<Exclude<CameraStatus, 'live'>, string> = {
  starting: 'Abriendo la cámara…',
  denied:
    'Necesitamos permiso para usar la cámara. Puedes activarlo en los ajustes del navegador o elegir una foto de la galería.',
  unavailable: 'No pudimos abrir la cámara de este dispositivo. Elige una foto de la galería.',
  stopped: 'La cámara está apagada.',
  ended: 'Se perdió la conexión con la cámara. Vuelve a intentarlo o elige una foto de la galería.',
};

const PRIMARY_BUTTON =
  'flex min-h-tactil w-full items-center justify-center rounded-2xl bg-lima px-6 text-lg font-bold text-petroleo';
const SECONDARY_BUTTON =
  'flex min-h-tactil w-full items-center justify-center rounded-2xl border-2 border-bosque px-6 text-base font-semibold text-bosque';

interface CameraPageProps {
  compressFrame?: (video: HTMLVideoElement) => Promise<CompressedPhoto>;
  compressFile?: (file: File) => Promise<CompressedPhoto>;
}

/** HU-02/HU-03: vista previa con la cámara trasera, interruptor de modo y galería como alternativa. */
export function CameraPage({
  compressFrame = compressVideoFrame,
  compressFile = compressImage,
}: CameraPageProps) {
  const navigate = useNavigate();
  const { videoRef, status, start: startCamera, stop: stopCamera } = useCamera();
  const photo = usePhotoStore((s) => s.photo);
  const setPhoto = usePhotoStore((s) => s.setPhoto);
  const clearPhoto = usePhotoStore((s) => s.clear);
  const mode = useScanModeStore((s) => s.mode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Si el usuario sale mientras se comprime, la foto no debe quedar en el store.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    clearPhoto(); // Se entra siempre sin foto (desde la portada o «Tomar otra foto»).
    return () => {
      mounted.current = false;
    };
  }, [clearPhoto]);

  async function prepare(task: () => Promise<CompressedPhoto>) {
    setBusy(true);
    setError(null);
    try {
      const compressed = await task();
      if (!mounted.current) return;
      setPhoto(compressed);
      stopCamera(); // Con foto no hace falta la cámara: se apaga y se reabre al pulsar Repetir.
    } catch (err) {
      setError(err instanceof PhotoError ? err.message : GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  }

  function handleCapture() {
    const video = videoRef.current;
    if (video) void prepare(() => compressFrame(video));
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // Permite volver a elegir el mismo archivo.
    if (file) void prepare(() => compressFile(file));
  }

  function handleRetake() {
    clearPhoto();
    startCamera();
  }

  const live = status === 'live';
  const ended = status === 'ended';

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-6 py-6">
      <h1 className="text-2xl font-extrabold text-petroleo">
        {photo ? '¿Usamos esta foto?' : 'Toma una foto del residuo'}
      </h1>

      {/* Visible con cámara y con vista previa: el modo se puede cambiar antes de usar la foto. */}
      <ModeSwitch />

      {/* Siempre montado: `useCamera` necesita el elemento para conectar el flujo al reabrir. */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        aria-label="Vista previa de la cámara"
        className={`aspect-[3/4] w-full rounded-2xl bg-petroleo object-cover ${live && !photo ? '' : 'hidden'}`}
      />

      {photo ? (
        <>
          <img
            src={photo.previewUrl}
            alt="Foto tomada"
            className="aspect-[3/4] w-full rounded-2xl bg-petroleo object-contain"
          />
          <div className="flex gap-3">
            <button type="button" className={SECONDARY_BUTTON} onClick={handleRetake}>
              Repetir
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON}
              onClick={() => navigate(mode === 'upcycle' ? '/ideas' : '/resultado')}
            >
              Usar foto
            </button>
          </div>
        </>
      ) : (
        <>
          {!live && (
            <p role={status === 'starting' ? 'status' : 'alert'} className="text-base text-bosque">
              {CAMERA_MESSAGE[status]}
            </p>
          )}
          {busy && (
            <p role="status" className="text-base text-bosque">
              Preparando la foto…
            </p>
          )}
          {error && (
            <p role="alert" className="text-base font-semibold text-red-700">
              {error}
            </p>
          )}
          {live && (
            <button
              type="button"
              className={PRIMARY_BUTTON}
              onClick={handleCapture}
              disabled={busy}
            >
              Tomar foto
            </button>
          )}
          {ended && (
            <button type="button" className={PRIMARY_BUTTON} onClick={startCamera}>
              Reintentar cámara
            </button>
          )}
          <label
            className={`${live || ended ? SECONDARY_BUTTON : PRIMARY_BUTTON} cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-bosque`}
          >
            Elegir de la galería
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleFile}
              disabled={busy}
            />
          </label>
        </>
      )}
    </main>
  );
}
