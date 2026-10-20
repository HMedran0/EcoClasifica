import { useAuthStore } from '../auth/authStore';
import { SECONDARY } from './ScanScreen';
import type { ScanState } from './useScan';

/** Qué aviso muestra `UnsavedNotice`: escaneo sin sesión, guardado fallido o ninguno. */
export function useUnsavedKind<T extends { saved: boolean }>(
  state: ScanState<T>,
): 'anonymous' | 'failed' | null {
  const signedIn = useAuthStore((s) => s.session !== null);
  if (!signedIn || state.kind !== 'success' || state.data.saved) return null;
  return state.withSession ? 'failed' : 'anonymous';
}

/**
 * HU-12: con sesión y `saved: false`. Si el escaneo se hizo sin sesión, ofrece guardarlo; si falló
 * al guardar con sesión, ofrece reintentar. Ambos reenvían la misma foto (ya con el token) por el
 * camino de «Reintentar», que reemplaza la respuesta en caché.
 */
export function UnsavedNotice<T extends { saved: boolean }>({
  state,
  onRetry,
}: {
  state: ScanState<T>;
  onRetry: () => void;
}) {
  const kind = useUnsavedKind(state);
  if (!kind) return null;
  const anonymous = kind === 'anonymous';
  return (
    <div className="flex flex-col gap-2 rounded-2xl border-2 border-bosque/30 bg-white p-4">
      <p className="text-base text-bosque">
        {anonymous
          ? 'Este escaneo se hizo sin sesión y no quedó guardado'
          : 'No pudimos guardar este escaneo'}
      </p>
      <button type="button" className={SECONDARY} onClick={onRetry}>
        {anonymous ? 'Guardar este escaneo' : 'Reintentar'}
      </button>
    </div>
  );
}
