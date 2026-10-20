import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstallButton } from './InstallButton';
import { listenForInstallPrompt } from './installPrompt';

type Outcome = 'accepted' | 'dismissed';

function fireInstallPrompt(outcome: Outcome = 'accepted') {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome, platform: 'web' }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

function mockStandalone(matches: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({ matches, media: query })),
  );
}

const installButton = () => screen.queryByRole('button', { name: 'Instalar app' });

describe('InstallButton', () => {
  let stopListening: () => void;

  beforeEach(() => {
    stopListening = listenForInstallPrompt();
  });

  afterEach(() => {
    act(() => {
      stopListening();
    });
    vi.unstubAllGlobals();
  });

  it('no se muestra si el navegador no ofrece la instalación', () => {
    render(<InstallButton />);
    expect(installButton()).not.toBeInTheDocument();
  });

  it('aparece cuando el navegador emite beforeinstallprompt y evita su aviso propio', () => {
    render(<InstallButton />);
    const event = fireInstallPrompt();
    expect(event.defaultPrevented).toBe(true);
    expect(installButton()).toBeInTheDocument();
  });

  it('captura el evento aunque llegue antes de montar la portada', () => {
    fireInstallPrompt();
    render(<InstallButton />);
    expect(installButton()).toBeInTheDocument();
  });

  it('al tocarlo abre el cuadro de instalación y desaparece', async () => {
    render(<InstallButton />);
    const event = fireInstallPrompt('accepted');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Instalar app' }));
      await event.userChoice;
    });
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(installButton()).not.toBeInTheDocument();
  });

  it('si el usuario cancela, desaparece y no vuelve a ofrecerse en la sesión', async () => {
    render(<InstallButton />);
    const event = fireInstallPrompt('dismissed');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Instalar app' }));
      await event.userChoice;
    });
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(installButton()).not.toBeInTheDocument();

    fireInstallPrompt();
    expect(installButton()).not.toBeInTheDocument();
  });

  it('se oculta cuando la app se instala desde el menú del navegador', () => {
    render(<InstallButton />);
    fireInstallPrompt();
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(installButton()).not.toBeInTheDocument();
  });

  it('no se muestra si la app ya corre instalada (display-mode standalone)', () => {
    mockStandalone(true);
    render(<InstallButton />);
    fireInstallPrompt();
    expect(installButton()).not.toBeInTheDocument();
  });

  it('es un botón secundario con objetivo táctil de 48 px', () => {
    mockStandalone(false);
    render(<InstallButton />);
    fireInstallPrompt();
    const button = screen.getByRole('button', { name: 'Instalar app' });
    expect(button).toHaveClass('min-h-tactil', 'border-2');
    expect(button).not.toHaveClass('bg-lima');
  });
});
