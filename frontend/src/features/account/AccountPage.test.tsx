import type { UpcycleResponse } from '@ecoclasifica/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/errors';
import { fakeAuth, fakeSession, resetFakeAuth } from '../../test/supabaseMock';
import { useAuthStore } from '../auth/authStore';
import { RequireAuth } from '../auth/RequireAuth';
import { usePhotoStore } from '../camera/photoStore';
import { setFavorites, useFavoritesStore } from '../favorites/favoritesStore';
import { useConsentStore } from '../privacy/consentStore';
import { PrivacyPage } from '../privacy/PrivacyPage';
import { AccountPage, DELETE_ACCOUNT_WARNING } from './AccountPage';
import { clearAccountData } from './accountActions';
import { ACCOUNT_DELETED, ACCOUNT_PATH } from './paths';

vi.mock('../../lib/supabase', async () => ({
  supabase: (await import('../../test/supabaseMock')).fakeSupabase,
}));

const upcycle: UpcycleResponse = {
  scanId: null,
  mode: 'upcycle',
  result: { canUpcycle: false, objectName: 'Pila', reason: 'Peligroso.' },
  saved: false,
};

/** Lo que la cuenta deja en memoria: foto, respuesta en caché, chat, favoritos y autorización. */
function fillStores() {
  usePhotoStore.getState().setPhoto({
    base64: 'a'.repeat(200),
    mimeType: 'image/jpeg',
    width: 768,
    height: 576,
    bytes: 150,
    blob: new Blob(['x'], { type: 'image/jpeg' }),
  });
  const photoId = usePhotoStore.getState().photo?.id ?? 0;
  usePhotoStore.getState().saveResult('upcycle', photoId, upcycle, true);
  usePhotoStore.getState().saveChat('historial:s1:0', [{ role: 'user', content: '¿Cómo?' }]);
  setFavorites({ 'idea-1': 'fav-1' });
  useConsentStore.setState({ userId: 'user-ana', status: 'ok' });
}

function expectStoresEmpty() {
  const photo = usePhotoStore.getState();
  expect(photo.photo).toBeNull();
  expect(photo.results).toEqual({});
  expect(photo.chats).toEqual({});
  expect(useFavoritesStore.getState().byIdea).toEqual({});
  expect(useConsentStore.getState()).toMatchObject({ userId: null, status: 'checking' });
}

function Home() {
  const { state } = useLocation();
  const notice = (state as { notice?: string } | null)?.notice;
  return <p>Portada{notice ? `: ${notice}` : ''}</p>;
}

function renderAccount(deleteAccount: () => Promise<void>) {
  render(
    <MemoryRouter initialEntries={[ACCOUNT_PATH]}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/entrar" element={<p>Entrar</p>} />
        <Route
          path={ACCOUNT_PATH}
          element={
            <RequireAuth>
              <AccountPage deleteAccount={deleteAccount} />
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function confirmDeletion() {
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar mi cuenta' }));
  fireEvent.change(screen.getByLabelText('Escribe ELIMINAR para confirmar'), {
    target: { value: 'ELIMINAR' },
  });
  const dialog = screen.getByRole('alertdialog');
  const confirm = [...dialog.querySelectorAll('button')].find(
    (b) => b.textContent === 'Eliminar mi cuenta',
  );
  if (!confirm) throw new Error('Falta el botón de confirmar');
  fireEvent.click(confirm);
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  resetFakeAuth();
  useAuthStore.setState({ session: fakeSession(), ready: true });
  usePhotoStore.getState().clear();
});

describe('AccountPage (HU-22)', () => {
  it('muestra el correo, el enlace a la política y «Eliminar mi cuenta»', () => {
    renderAccount(vi.fn());
    expect(screen.getByText('ana@ejemplo.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Política de privacidad' })).toHaveAttribute(
      'href',
      '/privacidad',
    );
    expect(screen.getByRole('button', { name: 'Eliminar mi cuenta' })).toBeInTheDocument();
  });

  it('el diálogo advierte qué se borra y exige escribir ELIMINAR', () => {
    const deleteAccount = vi.fn();
    renderAccount(deleteAccount);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar mi cuenta' }));

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAccessibleName('¿Eliminar tu cuenta?');
    expect(dialog).toHaveAccessibleDescription(DELETE_ACCOUNT_WARNING);
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('al eliminar: cierra la sesión local, vacía los stores y vuelve a la portada con el aviso', async () => {
    fillStores();
    const deleteAccount = vi.fn().mockResolvedValue(undefined);
    renderAccount(deleteAccount);

    confirmDeletion();

    expect(await screen.findByText(`Portada: ${ACCOUNT_DELETED}`)).toBeInTheDocument();
    expect(deleteAccount).toHaveBeenCalledOnce();
    // La sesión se cierra al desmontar /cuenta (efecto pasivo, justo después de pintar la portada).
    await waitFor(() => expect(useAuthStore.getState().session).toBeNull());
    expect(fakeAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expectStoresEmpty();
  });

  it('si falla, muestra el error en el diálogo y no toca la sesión ni los datos', async () => {
    fillStores();
    const deleteAccount = vi.fn().mockRejectedValue(new ApiError('ACCOUNT_DELETE_FAILED', 503));
    renderAccount(deleteAccount);

    confirmDeletion();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos eliminar tu cuenta. Intenta de nuevo.',
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(useAuthStore.getState().session).not.toBeNull();
    expect(fakeAuth.signOut).not.toHaveBeenCalled();
    expect(useFavoritesStore.getState().byIdea).toEqual({ 'idea-1': 'fav-1' });
  });
});

describe('clearAccountData', () => {
  it('vacía foto, respuestas en caché, chats, favoritos y autorización', () => {
    fillStores();
    clearAccountData();
    expectStoresEmpty();
  });
});

describe('política de privacidad (HU-21) y HU-22', () => {
  it('describe cómo eliminar la cuenta y qué se borra', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    );
    const text = document.body.textContent ?? '';
    expect(text).toContain('«Eliminar mi cuenta»');
    expect(text).toContain(
      'Primero borramos tus fotos y después tu cuenta, tu historial, tus favoritos y tus conversaciones.',
    );
    expect(text).toContain('Si algo falla, no se borra nada');
  });
});
