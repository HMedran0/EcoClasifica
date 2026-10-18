import type { ClassifyResponse } from '@ecoclasifica/shared';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import { api, type RequestOptions, type ScanRequestInput } from '../../api/client';
import { ApiError, errorMessage } from '../../api/errors';
import { usePhotoStore } from '../camera/photoStore';

type State =
  | { kind: 'loading' }
  | { kind: 'success'; data: ClassifyResponse }
  | { kind: 'error'; message: string };

const BUTTON =
  'flex min-h-tactil w-full items-center justify-center rounded-2xl px-6 text-base font-semibold';

interface ResultPageProps {
  classify?: (req: ScanRequestInput, opts?: RequestOptions) => Promise<ClassifyResponse>;
}

/** Resultado provisional: envía la foto del store y lo muestra en texto simple (HU-17 la rediseña). */
export function ResultPage({ classify = api.classify }: ResultPageProps) {
  const photo = usePhotoStore((s) => s.photo);
  const clearPhoto = usePhotoStore((s) => s.clear);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!photo) return;
    const controller = new AbortController();
    classify({ image: photo.base64, mimeType: photo.mimeType }, { signal: controller.signal }).then(
      // Una respuesta tardía de una petición cancelada (reintento, salida) no pisa el estado actual.
      (data) => {
        if (!controller.signal.aborted) setState({ kind: 'success', data });
      },
      (err: unknown) => {
        if (controller.signal.aborted) return;
        const message = err instanceof ApiError ? err.message : errorMessage('UNEXPECTED_RESPONSE');
        setState({ kind: 'error', message });
      },
    );
    return () => controller.abort();
  }, [classify, photo, attempt]);

  if (!photo) return <Navigate to="/camara" replace />;

  function retry() {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }

  return (
    <main
      className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-6 py-6"
      aria-label="Resultado"
    >
      <img
        src={photo.previewUrl}
        alt="Foto enviada"
        className="max-h-64 w-full rounded-2xl bg-petroleo object-contain"
      />
      {state.kind === 'loading' && (
        <p role="status" className="text-base text-bosque">
          Analizando la foto…
        </p>
      )}
      {state.kind === 'success' && <ClassifyResult data={state.data} />}
      {state.kind === 'error' && (
        <>
          <p role="alert" className="text-base font-semibold text-red-700">
            {state.message}
          </p>
          <button type="button" className={`${BUTTON} bg-lima text-petroleo`} onClick={retry}>
            Reintentar
          </button>
        </>
      )}
      {/* Al vaciar el store, el `Navigate` de arriba lleva a la cámara. */}
      <button
        type="button"
        className={`${BUTTON} border-2 border-bosque text-bosque`}
        onClick={clearPhoto}
      >
        Tomar otra foto
      </button>
    </main>
  );
}

function ClassifyResult({ data }: { data: ClassifyResponse }) {
  const { result, disposal } = data;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base text-petroleo">
      <dt className="font-semibold">Objeto</dt>
      <dd>{result.object}</dd>
      <dt className="font-semibold">Material</dt>
      <dd>{result.materialDetail}</dd>
      <dt className="font-semibold">Contenedor</dt>
      <dd>{disposal ? disposal.binName : 'No estamos seguros: revisa el material.'}</dd>
      <dt className="font-semibold">Certeza</dt>
      <dd>{Math.round(result.confidence * 100)} %</dd>
    </dl>
  );
}
