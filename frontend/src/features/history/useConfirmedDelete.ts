import { useState } from 'react';
import { ApiError, errorMessage } from '../../api/errors';

/**
 * Estado del diálogo «¿Eliminar…?»: abre, confirma (con `busy` mientras tanto) y, si falla,
 * deja el diálogo abierto con el motivo para reintentar.
 */
export function useConfirmedDelete<T>(action: () => Promise<T>, onDone: (result: T) => void) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      setOpen(false);
      onDone(result);
    } catch (err) {
      setError(errorMessage(err instanceof ApiError ? err.code : 'UNEXPECTED_RESPONSE'));
    } finally {
      setBusy(false);
    }
  }

  return {
    open,
    busy,
    error,
    ask: () => setOpen(true),
    cancel: () => {
      setOpen(false);
      setError(null);
    },
    confirm,
  };
}
