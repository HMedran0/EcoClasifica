import { useOnlineStatus } from './useOnlineStatus';

export const OFFLINE_MESSAGE = 'Sin conexión: escanear requiere internet';

/**
 * Aviso global sin red. El app shell funciona desde el precache, pero escanear necesita la API.
 * Fijo (no sticky) para no sumar altura a las páginas de min-h-dvh.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <p
      role="status"
      className="fixed inset-x-0 top-0 z-10 bg-petroleo px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 text-center text-base font-semibold text-white"
    >
      {OFFLINE_MESSAGE}
    </p>
  );
}
