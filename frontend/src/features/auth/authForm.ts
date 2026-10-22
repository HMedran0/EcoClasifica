/** Estilos y validación comunes a los formularios de cuenta (entrar, recuperar, restablecer). */
export const BUTTON =
  'flex min-h-tactil w-full items-center justify-center rounded-2xl px-6 text-lg font-bold';
export const INPUT =
  'min-h-tactil rounded-2xl border-2 border-bosque bg-white p-3 text-base text-petroleo';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const INVALID_EMAIL = 'Escribe un correo válido, por ejemplo ana@correo.com.';

/** `/entrar?recuperar=1` abre directamente «Recuperar contraseña» (botón «Pedir otro enlace»). */
export const FORGOT_PARAM = 'recuperar';
