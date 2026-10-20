import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeAuth, fakeSession, resetFakeAuth } from '../../test/supabaseMock';
import { AccountStatus } from './AccountStatus';
import { useAuthStore } from './authStore';

vi.mock('../../lib/supabase', async () => ({
  supabase: (await import('../../test/supabaseMock')).fakeSupabase,
}));

const renderStatus = () =>
  render(
    <MemoryRouter>
      <AccountStatus />
    </MemoryRouter>,
  );

beforeEach(() => resetFakeAuth());

describe('AccountStatus', () => {
  it('sin sesión enlaza a «Iniciar sesión»', () => {
    useAuthStore.setState({ session: null, ready: true });
    renderStatus();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/entrar');
  });

  it('con sesión de correo muestra el correo y «Cerrar sesión»', async () => {
    useAuthStore.setState({ session: fakeSession(), ready: true });
    renderStatus();
    expect(screen.getByText('ana@ejemplo.com')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(fakeAuth.signOut).toHaveBeenCalled();
  });

  it('con Google muestra el nombre', () => {
    const session = fakeSession({ user_metadata: { full_name: 'Ana Pérez' } });
    useAuthStore.setState({ session, ready: true });
    renderStatus();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
  });

  it('mientras carga la sesión no muestra nada', () => {
    useAuthStore.setState({ session: null, ready: false });
    const { container } = renderStatus();
    expect(container).toBeEmptyDOMElement();
  });
});
