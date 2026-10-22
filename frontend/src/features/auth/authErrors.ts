import { isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js';

export const EMAIL_NOT_CONFIRMED = 'email_not_confirmed';

// Códigos de Supabase Auth (`error.code`). Nunca se muestra `error.message`: viene en inglés.
const MESSAGES: Record<string, string> = {
  invalid_credentials: 'El correo o la contraseña no son correctos.',
  [EMAIL_NOT_CONFIRMED]:
    'Aún no verificaste tu correo. Abre el enlace que te enviamos o pide uno nuevo.',
  user_already_exists: 'Ya existe una cuenta con ese correo. Inicia sesión.',
  email_exists: 'Ya existe una cuenta con ese correo. Inicia sesión.',
  weak_password:
    'La contraseña es muy débil. Usa al menos 8 caracteres y combina letras y números.',
  email_address_invalid: 'Ese correo no es válido. Revisa que esté bien escrito.',
  validation_failed: 'Revisa el correo y la contraseña.',
  signup_disabled: 'Por ahora no se pueden crear cuentas nuevas.',
  email_provider_disabled: 'Por ahora no se puede entrar con correo. Usa Google.',
  provider_disabled: 'Ese método de inicio de sesión no está disponible.',
  over_email_send_rate_limit:
    'Enviamos demasiados correos. Espera unos minutos e intenta de nuevo.',
  over_request_rate_limit: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.',
  user_banned: 'Esta cuenta está suspendida.',
  session_expired: 'Tu sesión expiró. Inicia sesión de nuevo.',
  session_not_found: 'Tu sesión expiró. Inicia sesión de nuevo.',
  same_password: 'La contraseña nueva debe ser distinta de la anterior.',
};

const NETWORK = 'No hay conexión. Revisa tu internet e intenta de nuevo.';
const GENERIC = 'No pudimos completar la acción. Intenta de nuevo.';

/** `error.code` de Supabase, o `undefined` si no es un error de Auth. */
export function authErrorCode(error: unknown): string | undefined {
  return isAuthError(error) ? error.code : undefined;
}

export function authErrorMessage(error: unknown): string {
  if (isAuthRetryableFetchError(error)) return NETWORK;
  const code = authErrorCode(error);
  return (code && MESSAGES[code]) || GENERIC;
}

/** Por qué no sirve un enlace de recuperación: cada caso pide al usuario algo distinto. */
export type RecoveryLinkProblem = 'expired' | 'otherDevice' | 'invalid';

export const RECOVERY_LINK_MESSAGES: Record<RecoveryLinkProblem, string> = {
  expired: 'El enlace venció o ya se usó. Por seguridad dura poco tiempo: pide uno nuevo.',
  otherDevice:
    'Abre el enlace en el mismo dispositivo y navegador donde lo pediste, o pide uno nuevo desde aquí.',
  invalid: 'No pudimos abrir el enlace. Pide uno nuevo.',
};

// Con PKCE el `?code=` solo se canjea en el navegador que guardó el «code verifier» al pedirlo.
const OTHER_DEVICE_CODES = new Set([
  'bad_code_verifier',
  'flow_state_not_found',
  'pkce_code_verifier_not_found',
]);
const EXPIRED_CODES = new Set(['otp_expired', 'flow_state_expired']);

export function recoveryLinkProblem(code: string | null | undefined): RecoveryLinkProblem {
  if (code && OTHER_DEVICE_CODES.has(code)) return 'otherDevice';
  if (code && EXPIRED_CODES.has(code)) return 'expired';
  return 'invalid';
}

/**
 * Error con el que Supabase devuelve un enlace que no sirve (`?error_code=otp_expired`). Va en la
 * query (PKCE) o en el hash (flujo implícito); `null` si el enlace no trae error.
 */
export function recoveryLinkErrorCode(search: string, hash: string): string | null {
  for (const raw of [search, hash.replace(/^#/, '')]) {
    const params = new URLSearchParams(raw);
    if (params.has('error') || params.has('error_code')) {
      return params.get('error_code') ?? params.get('error');
    }
  }
  return null;
}
