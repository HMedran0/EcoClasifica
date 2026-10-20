export const RETURN_PARAM = 'volver';

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * Solo rutas internas en `?volver=` (evita redirecciones abiertas): debe empezar por «/», no por «//»
 * ni contener «://». También se rechazan «\» y los caracteres de control: el navegador trata
 * «/\malo.com» como «//malo.com» y quita tabulaciones y saltos («/\t/malo.com» → «//malo.com»).
 */
export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  if (value.includes('://') || value.includes('\\') || CONTROL_CHARS.test(value)) return '/';
  return value;
}

/** URL absoluta de regreso (Google y correo de verificación) a partir de una ruta ya validada. */
export function returnUrl(path: string, origin = window.location.origin): string {
  return `${origin}${safeReturnPath(path)}`;
}
