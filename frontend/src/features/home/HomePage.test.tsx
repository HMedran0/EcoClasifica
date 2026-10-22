import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { listenForInstallPrompt } from '../../pwa/installPrompt';
import { setOnline } from '../../test/network';
import { fakeSession } from '../../test/supabaseMock';
import { useAuthStore } from '../auth/authStore';
import { HomePage } from './HomePage';

vi.mock('../../api/client', () => ({
  api: { health: vi.fn().mockResolvedValue({ status: 'ok' }) },
}));

describe('HomePage', () => {
  it('enlaza a la política de privacidad sin sesión (HU-21)', () => {
    useAuthStore.setState({ session: null, ready: true });
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Política de privacidad' })).toHaveAttribute(
      'href',
      '/privacidad',
    );
  });

  it('con sesión enlaza a «Mi historial», «Mis favoritos» y «Mi cuenta»; sin sesión no', () => {
    useAuthStore.setState({ session: null, ready: true });
    const { unmount } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('link', { name: 'Mi historial' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mis favoritos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mi cuenta' })).not.toBeInTheDocument();
    unmount();

    useAuthStore.setState({ session: fakeSession(), ready: true });
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Mi historial' })).toHaveAttribute(
      'href',
      '/historial',
    );
    expect(screen.getByRole('link', { name: 'Mis favoritos' })).toHaveAttribute(
      'href',
      '/favoritos',
    );
    expect(screen.getByRole('link', { name: 'Mi cuenta' })).toHaveAttribute('href', '/cuenta');
    useAuthStore.setState({ session: null, ready: true });
  });

  it('muestra el logo y el nombre con Eco y Clasifica separados por color', () => {
    const { container } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(container.querySelector('img[src="/brand/logo.svg"]')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('EcoClasifica');
    expect(screen.getByText('Eco')).toHaveClass('text-hoja');
    expect(screen.getByText('Clasifica')).toHaveClass('text-petroleo');
  });

  it('enlaza a la cámara con el botón Escanear residuo', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Escanear residuo' })).toHaveAttribute(
      'href',
      '/camara',
    );
  });

  it('muestra el indicador de conexión con el backend', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Servicio disponible')).toBeInTheDocument();
  });

  it('sin conexión deshabilita Escanear residuo e indica que requiere internet', () => {
    setOnline(false);
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    const scan = screen.getByRole('button', { name: 'Escanear residuo' });
    expect(scan).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('link', { name: 'Escanear residuo' })).not.toBeInTheDocument();
    expect(scan).toHaveAccessibleDescription('Escanear requiere internet');
    expect(screen.getByText('Escanear requiere internet')).toBeVisible();
  });

  it('al recuperar la conexión vuelve a enlazar a la cámara', () => {
    setOnline(false);
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    setOnline(true);
    expect(screen.getByRole('link', { name: 'Escanear residuo' })).toHaveAttribute(
      'href',
      '/camara',
    );
    expect(screen.queryByText('Escanear requiere internet')).not.toBeInTheDocument();
  });

  it('muestra «Instalar app» debajo de «Escanear residuo» si el navegador lo permite', () => {
    const stopListening = listenForInstallPrompt();
    try {
      render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>,
      );
      act(() => {
        window.dispatchEvent(
          Object.assign(new Event('beforeinstallprompt'), {
            prompt: () => Promise.resolve(),
            userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
          }),
        );
      });
      const scan = screen.getByRole('link', { name: 'Escanear residuo' });
      const install = screen.getByRole('button', { name: 'Instalar app' });
      expect(scan.compareDocumentPosition(install) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    } finally {
      act(() => {
        stopListening();
      });
    }
  });
});
