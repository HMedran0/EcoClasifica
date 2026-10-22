import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeAuth, resetFakeAuth } from '../../test/supabaseMock';
import { useAuthStore } from './authStore';
import { RESET_RATE_LIMITED, RESET_SENT } from './ForgotPasswordForm';
import { LoginPage } from './LoginPage';

vi.mock('../../lib/supabase', async () => ({
  supabase: (await import('../../test/supabaseMock')).fakeSupabase,
}));

const ORIGIN = window.location.origin;

function renderLogin(entry = '/entrar') {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/entrar" element={<LoginPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const openForgot = () =>
  fireEvent.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
const requestLink = (email: string) => {
  fireEvent.change(screen.getByLabelText('Correo'), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));
};
const failWith = (error: Error) =>
  fakeAuth.resetPasswordForEmail.mockResolvedValue({ data: null, error });

beforeEach(() => {
  resetFakeAuth();
  useAuthStore.setState({ session: null, ready: true });
});

describe('Recuperar contraseña', () => {
  it('pide el enlace con regreso a /restablecer y muestra el mensaje neutro', async () => {
    renderLogin();
    openForgot();
    requestLink(' ana@ejemplo.com ');

    expect(await screen.findByRole('status')).toHaveTextContent(RESET_SENT);
    expect(fakeAuth.resetPasswordForEmail).toHaveBeenCalledWith('ana@ejemplo.com', {
      redirectTo: `${ORIGIN}/restablecer`,
    });
  });

  it('muestra el mismo mensaje aunque la cuenta no exista', async () => {
    failWith(new AuthApiError('User not found', 404, 'user_not_found'));
    renderLogin();
    openForgot();
    requestLink('nadie@ejemplo.com');

    expect(await screen.findByRole('status')).toHaveTextContent(RESET_SENT);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/not found/)).not.toBeInTheDocument();
  });

  it.each(['over_email_send_rate_limit', 'over_request_rate_limit'])(
    'con límite de envíos (%s) pide esperar sin decir si la cuenta existe',
    async (code) => {
      failWith(new AuthApiError('For security purposes, wait 60 seconds', 429, code));
      renderLogin();
      openForgot();
      requestLink('ana@ejemplo.com');

      expect(await screen.findByRole('alert')).toHaveTextContent(RESET_RATE_LIMITED);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    },
  );

  it('sin internet lo dice en español', async () => {
    failWith(new AuthRetryableFetchError('Failed to fetch', 0));
    renderLogin();
    openForgot();
    requestLink('ana@ejemplo.com');
    expect(await screen.findByRole('alert')).toHaveTextContent(/No hay conexión/);
  });

  it('valida el correo sin llamar a Supabase', async () => {
    renderLogin();
    openForgot();
    requestLink('ana@');
    expect(await screen.findByRole('alert')).toHaveTextContent(/correo válido/);
    expect(fakeAuth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('?recuperar=1 abre el formulario directamente y se puede volver', () => {
    renderLogin('/entrar?recuperar=1');
    expect(screen.getByRole('heading', { name: 'Recuperar contraseña' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a iniciar sesión' }));
    expect(screen.getByRole('tab', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });
});
