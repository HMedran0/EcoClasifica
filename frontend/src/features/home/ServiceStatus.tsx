import { useEffect, useState } from 'react';
import { api, type RequestOptions } from '../../api/client';
import { useOnlineStatus } from '../../pwa/useOnlineStatus';

type Status = 'checking' | 'online' | 'unavailable';

const VIEW: Record<Status, { label: string; dot: string }> = {
  checking: { label: 'Comprobando conexión…', dot: 'bg-gray-400' },
  online: { label: 'Servicio disponible', dot: 'bg-hoja' },
  unavailable: { label: 'Servicio no disponible', dot: 'bg-red-600' },
};

interface ServiceStatusProps {
  checkHealth?: (opts?: RequestOptions) => Promise<unknown>;
}

/**
 * Punto de estado contra GET /api/health; en producción también prueba CORS desde Vercel.
 * Sin red no se muestra: el aviso lo da OfflineBanner y no debe haber dos mensajes.
 */
export function ServiceStatus({ checkHealth = api.health }: ServiceStatusProps) {
  // Al volver la red, HealthCheck se monta de nuevo: arranca en «Comprobando…» y repite la consulta.
  return useOnlineStatus() ? <HealthCheck checkHealth={checkHealth} /> : null;
}

function HealthCheck({ checkHealth }: Required<ServiceStatusProps>) {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    const controller = new AbortController();
    checkHealth({ signal: controller.signal }).then(
      () => setStatus('online'),
      () => {
        if (!controller.signal.aborted) setStatus('unavailable');
      },
    );
    return () => controller.abort();
  }, [checkHealth]);

  const { label, dot } = VIEW[status];
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-bosque">
      <span aria-hidden="true" className={`size-2.5 rounded-full ${dot}`} />
      {label}
    </p>
  );
}
