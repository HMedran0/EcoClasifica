import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { createSupabaseAccountsRepo } from '../src/repositories/accounts.repo';
import { SupabaseOpError, supabaseErrorCode } from '../src/repositories/supabase';
import { USER_A } from './helpers/scansRepo';

// HU-22: borrar el usuario de Auth sin registrar el mensaje de Supabase.

function authClient(error: unknown = null) {
  const deleteUser = vi.fn(async () => ({ data: { user: null }, error }));
  const client = { auth: { admin: { deleteUser } } } as unknown as SupabaseClient;
  return { client: () => client, deleteUser };
}

describe('createSupabaseAccountsRepo.deleteUser', () => {
  it('borra el usuario indicado', async () => {
    const fake = authClient();
    await createSupabaseAccountsRepo(fake.client).deleteUser(USER_A);
    expect(fake.deleteUser).toHaveBeenCalledExactlyOnceWith(USER_A);
  });

  it('si Auth falla, lanza solo el código, sin el mensaje (puede citar el uuid)', async () => {
    const fake = authClient({
      message: `User ${USER_A} not found`,
      status: 404,
      code: 'user_not_found',
    });

    const err: unknown = await createSupabaseAccountsRepo(fake.client)
      .deleteUser(USER_A)
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SupabaseOpError);
    expect(err).toMatchObject({ code: 'user_not_found' });
    expect(String(err)).not.toContain(USER_A);
  });
});

describe('supabaseErrorCode', () => {
  it('prefiere `code`, luego `statusCode` y luego `status`', () => {
    expect(supabaseErrorCode({ code: 'x', statusCode: '500', status: 500 })).toBe('x');
    expect(supabaseErrorCode({ message: 'm', statusCode: '403' })).toBe('403');
    expect(supabaseErrorCode({ message: 'm', status: 502 })).toBe('502');
  });

  it('sin código ni status → `desconocido`, nunca el mensaje', () => {
    expect(supabaseErrorCode({ message: `ruta ${USER_A}/a.jpg` })).toBe('desconocido');
    expect(supabaseErrorCode({ code: '' })).toBe('desconocido');
    expect(supabaseErrorCode(null)).toBe('desconocido');
    expect(supabaseErrorCode('texto')).toBe('desconocido');
  });
});
