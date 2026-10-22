import { AuthApiError, type AuthChangeEvent, type Session } from '@supabase/supabase-js';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeAuth, fakeSession, resetFakeAuth } from '../../test/supabaseMock';
import { RECOVERY_LINK_MESSAGES } from './authErrors';
import { useAuthStore } from './authStore';
import { LoginPage } from './LoginPage';
import { PASSWORD_UPDATED, RECOVERY_TIMEOUT_MS, ResetPasswordPage } from './ResetPasswordPage';

vi.mock('../../lib/supabase', async () => ({
  supabase: (await import('../../test/supabaseMock')).fakeSupabase,
}));

type Listener = (event: AuthChangeEvent, session: Session | null) => void;

function CurrentPath() {
  const { pathname, state } = useLocation();
  const notice = (state as { notice?: string } | null)?.notice;
  return (
    <>
      <p data-testid="ruta">{pathname}</p>
      {notice && <p role="status">{notice}</p>}
    </>
  );
}

function renderReset(entry: string) {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/restablecer" element={<ResetPasswordPage />} />
        <Route path="/entrar" element={<LoginPage />} />
        <Route path="*" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** El canje sigue en curso: lo decide el evento que se emita. Devuelve el oyente suscrito. */
function pendingExchange(): () => Listener {
  fakeAuth.initialize.mockReturnValue(new Promise(() => undefined));
  return () => fakeAuth.onAuthStateChange.mock.calls[0]![0] as Listener;
}

const fillPasswords = (password: string, confirmation: string) => {
  fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Repite la contraseña'), {
    target: { value: confirmation },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
};

async function showForm() {
  fakeAuth.getSession.mockResolvedValue({ data: { session: fakeSession() }, error: null });
  renderReset('/restablecer?code=abc');
  await screen.findByLabelText('Contraseña nueva');
}

beforeEach(() => {
  resetFakeAuth();
  useAuthStore.setState({ session: null, ready: true });
});

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState(null, '', '/');
});

/** Simula que supabase-js no canjeó el código: sigue en la barra de direcciones. */
const codeNotExchanged = () => window.history.replaceState(null, '', '/restablecer?code=abc');

describe('ResetPasswordPage: acceso sin enlace', () => {
  it('sin sesión redirige a /entrar', async () => {
    renderReset('/restablecer');
    expect(await screen.findByRole('tab', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('con sesión redirige a la portada', async () => {
    useAuthStore.setState({ session: fakeSession(), ready: true });
    renderReset('/restablecer');
    expect(await screen.findByTestId('ruta')).toHaveTextContent(/^\/$/);
  });

  it('espera a conocer la sesión antes de decidir', () => {
    useAuthStore.setState({ session: null, ready: false });
    renderReset('/restablecer');
    expect(screen.queryByTestId('ruta')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });
});

describe('ResetPasswordPage: canje del enlace', () => {
  it.each<AuthChangeEvent>(['PASSWORD_RECOVERY', 'SIGNED_IN'])(
    'el evento %s con sesión muestra el formulario',
    async (event) => {
      const listener = pendingExchange();
      renderReset('/restablecer?code=abc');
      expect(screen.getByRole('status')).toHaveTextContent('Revisando el enlace…');

      act(() => listener()(event, fakeSession()));
      expect(await screen.findByLabelText('Contraseña nueva')).toBeInTheDocument();
    },
  );

  it('otro evento o un evento sin sesión no cuenta como recuperación', () => {
    const listener = pendingExchange();
    renderReset('/restablecer?code=abc');
    act(() => {
      listener()('INITIAL_SESSION', fakeSession());
      listener()('PASSWORD_RECOVERY', null);
    });
    expect(screen.queryByLabelText('Contraseña nueva')).not.toBeInTheDocument();
  });

  it('si el evento llegó antes de montar, basta la sesión que dejó el canje', async () => {
    await showForm();
    expect(fakeAuth.initialize).toHaveBeenCalled();
  });

  it(`sin sesión a los ${RECOVERY_TIMEOUT_MS / 1000} s muestra el error y «Pedir otro enlace»`, () => {
    vi.useFakeTimers();
    pendingExchange();
    renderReset('/restablecer?code=abc');

    act(() => vi.advanceTimersByTime(RECOVERY_TIMEOUT_MS - 1));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('alert')).toHaveTextContent(RECOVERY_LINK_MESSAGES.invalid);
    expect(screen.getByRole('link', { name: 'Pedir otro enlace' })).toBeInTheDocument();
  });
});

describe('ResetPasswordPage: enlace que no sirve', () => {
  it.each([
    ['?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid', ''],
    ['', '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid'],
  ])('vencido o usado («%s%s») lo dice en español', async (search, hash) => {
    renderReset(`/restablecer${search}${hash}`);
    expect(await screen.findByRole('alert')).toHaveTextContent(RECOVERY_LINK_MESSAGES.expired);
    expect(screen.queryByText(/invalid/)).not.toBeInTheDocument();
    expect(fakeAuth.initialize).not.toHaveBeenCalled();
  });

  it.each(['bad_code_verifier', 'flow_state_not_found'])(
    'abierto en otro navegador (%s) pide usar el mismo dispositivo',
    async (code) => {
      fakeAuth.initialize.mockResolvedValue({ error: new AuthApiError('PKCE', 400, code) });
      renderReset('/restablecer?code=abc');
      expect(await screen.findByRole('alert')).toHaveTextContent(
        RECOVERY_LINK_MESSAGES.otherDevice,
      );
    },
  );

  it('con una sesión previa y el código sin canjear no deja cambiar la contraseña', async () => {
    codeNotExchanged();
    fakeAuth.getSession.mockResolvedValue({ data: { session: fakeSession() }, error: null });
    renderReset('/restablecer?code=abc');
    expect(await screen.findByRole('alert')).toHaveTextContent(RECOVERY_LINK_MESSAGES.otherDevice);
    expect(screen.queryByLabelText('Contraseña nueva')).not.toBeInTheDocument();
  });

  it('un SIGNED_IN con el código sin canjear (sesión previa) no cuenta', () => {
    codeNotExchanged();
    const listener = pendingExchange();
    renderReset('/restablecer?code=abc');
    act(() => listener()('SIGNED_IN', fakeSession()));
    expect(screen.queryByLabelText('Contraseña nueva')).not.toBeInTheDocument();
  });

  it('sin «code verifier» el canje no deja sesión: también es otro navegador', async () => {
    renderReset('/restablecer?code=abc');
    expect(await screen.findByRole('alert')).toHaveTextContent(RECOVERY_LINK_MESSAGES.otherDevice);
  });

  it('«Pedir otro enlace» abre el formulario de recuperación', async () => {
    renderReset('/restablecer?error=access_denied&error_code=otp_expired');
    fireEvent.click(await screen.findByRole('link', { name: 'Pedir otro enlace' }));
    expect(screen.getByRole('heading', { name: 'Recuperar contraseña' })).toBeInTheDocument();
  });
});

describe('ResetPasswordPage: contraseña nueva', () => {
  it('pide 8 caracteres o más sin llamar a Supabase', async () => {
    await showForm();
    fillPasswords('1234567', '1234567');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La contraseña debe tener al menos 8 caracteres.',
    );
    expect(fakeAuth.updateUser).not.toHaveBeenCalled();
  });

  it('pide que la confirmación sea igual', async () => {
    await showForm();
    fillPasswords('secreta123', 'secreta124');
    expect(await screen.findByRole('alert')).toHaveTextContent('Las contraseñas no coinciden.');
    expect(fakeAuth.updateUser).not.toHaveBeenCalled();
  });

  it('guarda, cierra las otras sesiones y vuelve a la portada con el aviso', async () => {
    await showForm();
    fillPasswords('secreta123', 'secreta123');

    expect(await screen.findByRole('status')).toHaveTextContent(PASSWORD_UPDATED);
    expect(screen.getByTestId('ruta')).toHaveTextContent(/^\/$/);
    expect(fakeAuth.updateUser).toHaveBeenCalledWith({ password: 'secreta123' });
    expect(fakeAuth.signOut).toHaveBeenCalledWith({ scope: 'others' });
  });

  it('si falla cerrar las otras sesiones, la contraseña igual queda guardada', async () => {
    fakeAuth.signOut.mockRejectedValue(new Error('offline'));
    await showForm();
    fillPasswords('secreta123', 'secreta123');
    expect(await screen.findByRole('status')).toHaveTextContent(PASSWORD_UPDATED);
  });

  it('traduce el error de Supabase', async () => {
    fakeAuth.updateUser.mockResolvedValue({
      data: { user: null },
      error: new AuthApiError('New password should be different', 422, 'same_password'),
    });
    await showForm();
    fillPasswords('secreta123', 'secreta123');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La contraseña nueva debe ser distinta de la anterior.',
    );
    expect(screen.queryByText(/should be different/)).not.toBeInTheDocument();
    expect(fakeAuth.signOut).not.toHaveBeenCalled();
  });
});
