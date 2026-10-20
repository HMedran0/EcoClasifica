import { AuthApiError } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeAuth, fakeSession, resetFakeAuth } from '../../test/supabaseMock';
import { renewOrClearSession, useAuthStore } from './authStore';

vi.mock('../../lib/supabase', async () => ({
  supabase: (await import('../../test/supabaseMock')).fakeSupabase,
}));

beforeEach(() => {
  resetFakeAuth();
  useAuthStore.setState({ session: fakeSession(), ready: true });
});

describe('renewOrClearSession', () => {
  it('si Supabase renueva la sesión devuelve el token nuevo y la conserva', async () => {
    const renewed = { ...fakeSession(), access_token: 'nuevo' };
    fakeAuth.refreshSession.mockResolvedValue({
      data: { session: renewed, user: renewed.user },
      error: null,
    });

    await expect(renewOrClearSession()).resolves.toBe('nuevo');
    expect(useAuthStore.getState().session?.access_token).toBe('nuevo');
    expect(fakeAuth.signOut).not.toHaveBeenCalled();
  });

  it('si la renovación falla cierra solo la sesión local y devuelve null', async () => {
    fakeAuth.refreshSession.mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found'),
    });

    await expect(renewOrClearSession()).resolves.toBeNull();
    expect(useAuthStore.getState().session).toBeNull();
    expect(fakeAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('si la renovación lanza una excepción también cierra la sesión local', async () => {
    fakeAuth.refreshSession.mockRejectedValue(new Error('storage'));
    await expect(renewOrClearSession()).resolves.toBeNull();
    expect(useAuthStore.getState().session).toBeNull();
  });
});
