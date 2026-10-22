import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  authErrorCode,
  authErrorMessage,
  EMAIL_NOT_CONFIRMED,
  recoveryLinkErrorCode,
  recoveryLinkProblem,
} from './authErrors';

const apiError = (code: string, message = 'Some English message') =>
  new AuthApiError(message, 400, code);

describe('authErrorMessage', () => {
  it.each([
    ['invalid_credentials', 'El correo o la contraseña no son correctos.'],
    ['user_already_exists', 'Ya existe una cuenta con ese correo. Inicia sesión.'],
    [
      'over_email_send_rate_limit',
      'Enviamos demasiados correos. Espera unos minutos e intenta de nuevo.',
    ],
  ])('traduce %s', (code, expected) => {
    expect(authErrorMessage(apiError(code))).toBe(expected);
  });

  it('identifica el correo sin verificar', () => {
    const err = apiError(EMAIL_NOT_CONFIRMED, 'Email not confirmed');
    expect(authErrorCode(err)).toBe(EMAIL_NOT_CONFIRMED);
    expect(authErrorMessage(err)).toMatch(/verificaste tu correo/);
  });

  it('un código desconocido da un mensaje genérico, nunca el texto en inglés', () => {
    const message = authErrorMessage(apiError('something_new', 'Database error saving new user'));
    expect(message).toBe('No pudimos completar la acción. Intenta de nuevo.');
  });

  it('sin red pide revisar internet', () => {
    expect(authErrorMessage(new AuthRetryableFetchError('Failed to fetch', 0))).toMatch(/internet/);
  });

  it('un error que no es de Supabase también da el genérico', () => {
    expect(authErrorMessage(new Error('boom'))).toBe(
      'No pudimos completar la acción. Intenta de nuevo.',
    );
  });
});

describe('enlace de recuperación', () => {
  it.each([
    ['otp_expired', 'expired'],
    ['flow_state_expired', 'expired'],
    ['bad_code_verifier', 'otherDevice'],
    ['flow_state_not_found', 'otherDevice'],
    ['access_denied', 'invalid'],
    [undefined, 'invalid'],
  ])('%s → %s', (code, problem) => {
    expect(recoveryLinkProblem(code)).toBe(problem);
  });

  it('lee el error de la query o del hash', () => {
    expect(recoveryLinkErrorCode('?error=access_denied&error_code=otp_expired', '')).toBe(
      'otp_expired',
    );
    expect(recoveryLinkErrorCode('', '#error=access_denied')).toBe('access_denied');
    expect(recoveryLinkErrorCode('?code=abc', '')).toBeNull();
  });
});
