import { PRIVACY_VERSION } from '@ecoclasifica/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api/client';
import { ApiError } from '../../api/errors';
import { fakeAuth, fakeSession, resetFakeAuth } from '../../test/supabaseMock';
import { useAuthStore } from '../auth/authStore';
import { ConsentGate } from './ConsentGate';
import { ConsentPage, DECLINED_NOTICE } from './ConsentPage';
import { useConsentStore } from './consentStore';
import { PrivacyPage } from './PrivacyPage';

vi.mock('../../lib/supabase', async () => ({
  supabase: (await import('../../test/supabaseMock')).fakeSupabase,
}));
vi.mock('../../api/client', () => ({ api: { me: vi.fn(), acceptPrivacy: vi.fn() } }));

const me = vi.mocked(api.me);
const acceptPrivacy = vi.mocked(api.acceptPrivacy);
const OLD_VERSION = '2025-01-1';

function Where() {
  const { pathname, search, state } = useLocation();
  const notice = (state as { notice?: string } | null)?.notice;
  return (
    <>
      <p data-testid="ruta">{`${pathname}${search}`}</p>
      {notice && <p>{notice}</p>}
    </>
  );
}

function renderApp(entry = '/historial') {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <ConsentGate>
        <Routes>
          <Route path="/privacidad" element={<PrivacyPage />} />
          <Route path="/autorizacion" element={<ConsentPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </ConsentGate>
    </MemoryRouter>,
  );
}

const profile = (privacyVersion: string | null) => ({
  id: fakeSession().user.id,
  email: 'ana@ejemplo.com',
  displayName: 'Ana',
  privacyVersion,
});

/** Google no pasa por la casilla de registro: sin `privacy_version` en los metadatos. */
const googleSession = () => fakeSession({ user_metadata: { full_name: 'Ana' } });
/** Registro con correo: la casilla marcada viaja en los metadatos. */
const emailSession = (version = PRIVACY_VERSION) =>
  fakeSession({ user_metadata: { privacy_version: version } });

const path = () => screen.getByTestId('ruta').textContent;
const consentBox = () => screen.getByRole('checkbox', { name: /Autorizo el tratamiento/ });
const continueButton = () => screen.getByRole('button', { name: 'Continuar' });

beforeEach(() => {
  resetFakeAuth();
  me.mockReset();
  acceptPrivacy.mockReset();
  acceptPrivacy.mockResolvedValue({
    privacyVersion: PRIVACY_VERSION,
    privacyAcceptedAt: '2026-10-21T12:00:00.000Z',
  });
  useConsentStore.setState({ userId: null, status: 'checking' });
});

describe('ConsentGate', () => {
  it('sin sesión no consulta nada y deja pasar', () => {
    useAuthStore.setState({ session: null, ready: true });
    renderApp('/camara');
    expect(path()).toBe('/camara');
    expect(me).not.toHaveBeenCalled();
  });

  it('con la versión vigente autorizada deja pasar sin volver a preguntar', async () => {
    me.mockResolvedValue(profile(PRIVACY_VERSION));
    useAuthStore.setState({ session: googleSession(), ready: true });
    renderApp();

    await waitFor(() => expect(useConsentStore.getState().status).toBe('ok'));
    expect(path()).toBe('/historial');
    expect(acceptPrivacy).not.toHaveBeenCalled();
  });

  it('registro con correo: al entrar registra la autorización sin volver a preguntar', async () => {
    me.mockResolvedValue(profile(null));
    useAuthStore.setState({ session: emailSession(), ready: true });
    renderApp();

    await waitFor(() => expect(acceptPrivacy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(useConsentStore.getState().status).toBe('ok'));
    expect(path()).toBe('/historial');
  });

  it('con Google lleva a /autorizacion antes de seguir', async () => {
    me.mockResolvedValue(profile(null));
    useAuthStore.setState({ session: googleSession(), ready: true });
    renderApp('/favoritos');

    expect(await screen.findByRole('heading', { name: /Autoriza el uso/ })).toBeInTheDocument();
    expect(acceptPrivacy).not.toHaveBeenCalled();
  });

  it('con una versión desactualizada vuelve a preguntar, aunque la de registro sea vieja', async () => {
    me.mockResolvedValue(profile(OLD_VERSION));
    useAuthStore.setState({ session: emailSession(OLD_VERSION), ready: true });
    renderApp();

    expect(await screen.findByRole('heading', { name: /Autoriza el uso/ })).toBeInTheDocument();
    expect(acceptPrivacy).not.toHaveBeenCalled();
  });

  it('si falla registrar la autorización del registro, pregunta', async () => {
    me.mockResolvedValue(profile(null));
    acceptPrivacy.mockRejectedValue(new ApiError('NETWORK_ERROR'));
    useAuthStore.setState({ session: emailSession(), ready: true });
    renderApp();

    expect(await screen.findByRole('heading', { name: /Autoriza el uso/ })).toBeInTheDocument();
  });

  it('deja leer /privacidad sin haber aceptado', async () => {
    me.mockResolvedValue(profile(null));
    useAuthStore.setState({ session: googleSession(), ready: true });
    renderApp('/privacidad');

    await waitFor(() => expect(useConsentStore.getState().status).toBe('needed'));
    expect(screen.getByRole('heading', { name: 'Política de privacidad' })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Versión ${PRIVACY_VERSION}`))).toBeInTheDocument();
  });

  it('deja cambiar la contraseña en /restablecer sin haber aceptado', async () => {
    me.mockResolvedValue(profile(null));
    useAuthStore.setState({ session: googleSession(), ready: true });
    renderApp('/restablecer');

    await waitFor(() => expect(useConsentStore.getState().status).toBe('needed'));
    expect(path()).toBe('/restablecer');
  });

  it('sin poder consultar /me deja pasar (el backend no guarda sin autorización)', async () => {
    me.mockRejectedValue(new ApiError('NETWORK_ERROR'));
    useAuthStore.setState({ session: googleSession(), ready: true });
    renderApp();

    await waitFor(() => expect(useConsentStore.getState().status).toBe('unverified'));
    expect(path()).toBe('/historial');
  });
});

describe('ConsentPage (/autorizacion)', () => {
  beforeEach(() => {
    me.mockResolvedValue(profile(null));
    useAuthStore.setState({ session: googleSession(), ready: true });
  });

  it('la casilla empieza sin marcar y «Continuar» se habilita solo al marcarla', async () => {
    renderApp('/historial');
    await screen.findByRole('heading', { name: /Autoriza el uso/ });

    expect(consentBox()).not.toBeChecked();
    expect(continueButton()).toBeDisabled();
    const link = screen.getByRole('link', { name: 'Política de privacidad' });
    expect(link).toHaveAttribute('href', '/privacidad');
    // Pestaña nueva para no perder lo escrito.
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener');
    fireEvent.click(consentBox());
    expect(continueButton()).toBeEnabled();
  });

  it('al aceptar registra la autorización y vuelve a donde iba', async () => {
    renderApp('/historial?pagina=2');
    await screen.findByRole('heading', { name: /Autoriza el uso/ });

    fireEvent.click(consentBox());
    fireEvent.click(continueButton());

    await waitFor(() => expect(path()).toBe('/historial?pagina=2'));
    expect(acceptPrivacy).toHaveBeenCalledTimes(1);
    expect(useConsentStore.getState().status).toBe('ok');
  });

  it('si no se puede guardar, lo dice y sigue en la pantalla', async () => {
    acceptPrivacy.mockRejectedValue(new ApiError('NETWORK_ERROR'));
    renderApp();
    await screen.findByRole('heading', { name: /Autoriza el uso/ });

    fireEvent.click(consentBox());
    fireEvent.click(continueButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(/conexión/);
  });

  it('«No acepto» cierra la sesión y lleva a la portada con un aviso', async () => {
    renderApp();
    await screen.findByRole('heading', { name: /Autoriza el uso/ });

    fireEvent.click(screen.getByRole('button', { name: 'No acepto' }));

    await waitFor(() => expect(path()).toBe('/'));
    expect(screen.getByText(DECLINED_NOTICE)).toBeInTheDocument();
    expect(fakeAuth.signOut).toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBeNull();
    expect(acceptPrivacy).not.toHaveBeenCalled();
  });
});
