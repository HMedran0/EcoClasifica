import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

const MESSAGE = 'No se puede deshacer. Tus ideas favoritas se conservarán.';

function Harness({
  onConfirm = vi.fn(),
  busy = false,
  error = null,
}: {
  onConfirm?: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Eliminar escaneo
      </button>
      {open && (
        <ConfirmDialog
          title="¿Eliminar este escaneo?"
          message={MESSAGE}
          confirmLabel="Eliminar"
          onConfirm={onConfirm}
          onCancel={() => setOpen(false)}
          busy={busy}
          error={error}
        />
      )}
    </>
  );
}

function openDialog(props: Parameters<typeof Harness>[0] = {}) {
  render(<Harness {...props} />);
  const opener = screen.getByRole('button', { name: 'Eliminar escaneo' });
  opener.focus();
  fireEvent.click(opener);
  return { opener, dialog: screen.getByRole('alertdialog') };
}

describe('ConfirmDialog', () => {
  it('es un alertdialog modal con título y descripción accesibles', () => {
    const { dialog } = openDialog();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('¿Eliminar este escaneo?');
    expect(dialog).toHaveAccessibleDescription(MESSAGE);
  });

  it('el foco inicial va a «Cancelar», no al botón destructivo', () => {
    openDialog();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  it('confirmar llama a onConfirm', () => {
    const onConfirm = vi.fn();
    openDialog({ onConfirm });
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cancelar cierra sin confirmar y devuelve el foco al botón que lo abrió', () => {
    const onConfirm = vi.fn();
    const { opener } = openDialog({ onConfirm });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(opener).toHaveFocus();
  });

  it('Esc cancela y devuelve el foco', () => {
    const onConfirm = vi.fn();
    const { opener, dialog } = openDialog({ onConfirm });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(opener).toHaveFocus();
  });

  it('atrapa el foco: Tab desde el último vuelve al primero y Shift+Tab al revés', () => {
    const { dialog } = openDialog();
    const cancel = screen.getByRole('button', { name: 'Cancelar' });
    const confirm = screen.getByRole('button', { name: 'Eliminar' });

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(confirm).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(cancel).toHaveFocus();
  });

  it('mientras confirma, desactiva los botones y Esc no cierra', () => {
    const { dialog } = openDialog({ busy: true });
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Eliminando…' })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('muestra el error de un intento fallido como alerta', () => {
    openDialog({ error: 'Sin conexión.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Sin conexión.');
  });
});

describe('ConfirmDialog: foco mientras confirma', () => {
  it('con los botones desactivados, el foco queda en el diálogo y Esc sigue ignorándose', () => {
    const { dialog } = openDialog({ busy: true });
    expect(dialog).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(dialog).toBeInTheDocument();
  });

  it('si el foco intenta salir, vuelve a «Cancelar»', () => {
    const { opener } = openDialog();
    opener.focus();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });
});
