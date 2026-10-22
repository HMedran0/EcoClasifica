import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { BUTTON, SECONDARY } from '../features/scan/ScanScreen';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Mientras se confirma, los botones se desactivan y Esc no cierra. */
  busy?: boolean;
  /** Aviso de un intento fallido; el diálogo sigue abierto para reintentar. */
  error?: string | null;
  /** Confirmación escrita (HU-22): el botón se habilita solo al escribir exactamente este texto. */
  confirmText?: string;
}

/** Botón destructivo: blanco sobre rojo (contraste AA). */
const DANGER = `${BUTTON} bg-red-700 text-lg font-bold text-white disabled:opacity-60`;

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * Confirmación de una acción destructiva (`role="alertdialog"`): el foco empieza en «Cancelar»,
 * queda atrapado dentro, Esc cancela y al cerrar vuelve a donde estaba.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
  error = null,
  confirmText,
}: ConfirmDialogProps) {
  const titleId = useId();
  const messageId = useId();
  const typedId = useId();
  const [typed, setTyped] = useState('');
  const confirmed = confirmText === undefined || typed.trim() === confirmText;
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement;
    cancelRef.current?.focus();
    return () => {
      // Si el botón que lo abrió ya no existe (p. ej. la lista quedó vacía), no se fuerza el foco.
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  // Con los botones desactivados el foco se quedaría en `body`: lo guarda el propio diálogo.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (busy) dialog?.focus();
    else if (!dialog?.contains(document.activeElement)) cancelRef.current?.focus();
  }, [busy]);

  // El foco no sale del diálogo aunque llegue por otra vía (p. ej. un lector de pantalla).
  useEffect(() => {
    const keepInside = (event: FocusEvent) => {
      const dialog = dialogRef.current;
      if (dialog && event.target instanceof Node && !dialog.contains(event.target)) {
        (busy ? dialog : cancelRef.current)?.focus();
      }
    };
    document.addEventListener('focusin', keepInside);
    return () => document.removeEventListener('focusin', keepInside);
  }, [busy]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (!busy) onCancel();
      return;
    }
    if (event.key === 'Tab') trapTab(event);
  }

  function trapTab(event: KeyboardEvent<HTMLDivElement>) {
    const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !dialogRef.current?.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    // Un clic en el fondo no se lleva el foco fuera del diálogo.
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-petroleo/60 p-4 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) event.preventDefault();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onKeyDown={onKeyDown}
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-white p-5 outline-none"
      >
        <h2 id={titleId} className="text-xl font-bold text-petroleo">
          {title}
        </h2>
        <p id={messageId} className="text-base text-bosque">
          {message}
        </p>
        {error && (
          <p role="alert" className="text-base font-semibold text-red-700">
            {error}
          </p>
        )}
        {confirmText !== undefined && (
          <div className="flex flex-col gap-2">
            <label htmlFor={typedId} className="text-base font-semibold text-petroleo">
              Escribe {confirmText} para confirmar
            </label>
            <input
              id={typedId}
              type="text"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              disabled={busy}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="min-h-tactil rounded-2xl border-2 border-bosque px-4 text-base text-petroleo"
            />
          </div>
        )}
        <div className="flex flex-col gap-3">
          <button
            ref={cancelRef}
            type="button"
            className={SECONDARY}
            onClick={onCancel}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={DANGER}
            onClick={onConfirm}
            disabled={busy || !confirmed}
          >
            {busy ? 'Eliminando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
