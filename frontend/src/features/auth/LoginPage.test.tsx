import { AuthApiError } from '@supabase/supabase-js';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeAuth, fakeSession, resetFakeAuth } from '../../test/supabaseMock';
import { useAuthStore } from './authStore';
import { LoginPage } from './LoginPage';

vi.mock('../../lib/supabase', async () => ({
  supabase: (await import('../../test/supabaseMock')).fakeSupabase,
}));

const ORIGIN = window.location.origin;

function CurrentPath() {
  const { pathname } = useLocation();
  return <p data-testid="ruta">{pathname}</p>;
}

function renderLogin(entry = '/entrar') {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/entrar" element={<LoginPage />} />
        <Route path="*" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>,
  );
}

const fill = (email: string, password: string) => {
  fireEvent.change(screen.getByLabelText('Correo'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } });
};
const openSignup = () => fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
const submit = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

beforeEach(() => {
  resetFakeAuth();
  useAuthStore.setState({ session: null, ready: true });
});

describe('LoginPage: crear cuenta', () => {
  it('pide 8 caracteres o más sin llamar a Supabase', async () => {
    renderLogin();
    openSignup();
    fill('ana@ejemplo.com', '1234567');
    submit('Crear cuenta');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La contraseña debe tener al menos 8 caracteres.',
    );
    expect(fakeAuth.signUp).not.toHaveBeenCalled();
  });

  it('valida el correo en español', async () => {
    renderLogin();
    openSignup();
    fill('ana@', '12345678');
    submit('Crear cuenta');
    expect(await screen.findByRole('alert')).toHaveTextContent(/correo válido/);
  });

  it('tras registrarse avisa que enviamos el correo de verificación', async () => {
    renderLogin('/entrar?volver=%2Fhistorial');
    openSignup();
    fill(' ana@ejemplo.com ', '12345678');
    submit('Crear cuenta');

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Te enviamos un correo para verificar tu cuenta',
    );
    expect(fakeAuth.signUp).toHaveBeenCalledWith({
      email: 'ana@ejemplo.com',
      password: '12345678',
      options: { emailRedirectTo: `${ORIGIN}/historial` },
    });
  });

  it('traduce el error de Supabase y no muestra el texto en inglés', async () => {
    fakeAuth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError('Password should be stronger', 422, 'weak_password'),
    });
    renderLogin();
    openSignup();
    fill('ana@ejemplo.com', '12345678');
    submit('Crear cuenta');

    expect(await screen.findByRole('alert')).toHaveTextContent(/contraseña es muy débil/);
    expect(screen.queryByText(/stronger/)).not.toBeInTheDocument();
  });
});

describe('LoginPage: iniciar sesión', () => {
  it('con credenciales correctas vuelve a la ruta de origen', async () => {
    fakeAuth.signInWithPassword.mockResolvedValue({
      data: { user: fakeSession().user, session: fakeSession() },
      error: null,
    });
    renderLogin('/entrar?volver=%2Ffavoritos');
    fill('ana@ejemplo.com', 'secreta12');
    submit('Iniciar sesión');

    expect(await screen.findByTestId('ruta')).toHaveTextContent('/favoritos');
  });

  it('con un «volver» externo va a la portada', async () => {
    useAuthStore.setState({ session: fakeSession(), ready: true });
    renderLogin('/entrar?volver=https%3A%2F%2Fmalo.com');
    expect(await screen.findByTestId('ruta')).toHaveTextContent(/^\/$/);
  });

  it('con datos incorrectos lo dice en español', async () => {
    fakeAuth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'),
    });
    renderLogin();
    fill('ana@ejemplo.com', 'mala');
    submit('Iniciar sesión');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El correo o la contraseña no son correctos.',
    );
    expect(screen.queryByRole('button', { name: 'Reenviar correo' })).not.toBeInTheDocument();
  });

  it('sin verificar ofrece «Reenviar correo» y lo reenvía', async () => {
    fakeAuth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError('Email not confirmed', 400, 'email_not_confirmed'),
    });
    renderLogin('/entrar?volver=%2Fhistorial');
    fill('ana@ejemplo.com', 'secreta12');
    submit('Iniciar sesión');

    expect(await screen.findByRole('alert')).toHaveTextContent(/verificaste tu correo/);
    expect(screen.queryByText(/Email not confirmed/)).not.toBeInTheDocument();
    submit('Reenviar correo');

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Te enviamos de nuevo el correo de verificación.',
    );
    expect(fakeAuth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'ana@ejemplo.com',
      options: { emailRedirectTo: `${ORIGIN}/historial` },
    });
  });
});

describe('LoginPage: Google', () => {
  it.each([
    ['/entrar?volver=%2Fhistorial', `${ORIGIN}/historial`],
    ['/entrar?volver=%2F%2Fmalo.com', `${ORIGIN}/`],
    ['/entrar', `${ORIGIN}/`],
  ])('desde %s vuelve a %s', async (entry, redirectTo) => {
    renderLogin(entry);
    submit('Continuar con Google');
    await vi.waitFor(() =>
      expect(fakeAuth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: { redirectTo },
      }),
    );
  });
});
