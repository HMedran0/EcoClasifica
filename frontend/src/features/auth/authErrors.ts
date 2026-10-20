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
