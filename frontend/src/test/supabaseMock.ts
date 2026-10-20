import type { Session } from '@supabase/supabase-js';
import { vi } from 'vitest';

/**
 * Supabase Auth simulado. Uso en una prueba:
 * vi.mock('../../lib/supabase', async () => ({ supabase: (await import('../../test/supabaseMock')).fakeSupabase }));
 */
export const fakeAuth = {
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resend: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  refreshSession: vi.fn(),
  onAuthStateChange: vi.fn(),
};

export const fakeSupabase = { auth: fakeAuth };

/** Respuestas por defecto: sin sesión y todas las acciones correctas. */
export function resetFakeAuth(): void {
  for (const fn of Object.values(fakeAuth)) fn.mockReset();
  fakeAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  fakeAuth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
  fakeAuth.signUp.mockResolvedValue({ data: { user: null, session: null }, error: null });
  fakeAuth.resend.mockResolvedValue({ data: {}, error: null });
  fakeAuth.signInWithOAuth.mockResolvedValue({ data: { url: 'https://g' }, error: null });
  fakeAuth.signOut.mockResolvedValue({ error: null });
}

export function fakeSession(overrides: Partial<Session['user']> = {}): Session {
  return {
    access_token: 'token-de-prueba',
    refresh_token: 'refresh',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: '5b6f1c2e-8a3d-4f7b-9c1e-2d4a6b8c0e1f',
      email: 'ana@ejemplo.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-10-19T00:00:00Z',
      ...overrides,
    },
  };
}
