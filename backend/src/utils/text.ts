/** Recorta `text` a `max` caracteres sin partir palabras y añade «…» si sobra texto. */
export function truncateWords(text: string, max: number): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length <= max) return clean;
  // Un espacio en la posición max - 1 aún deja sitio para «…».
  const lastSpace = clean.slice(0, max).lastIndexOf(' ');
  const base = lastSpace > 0 ? clean.slice(0, lastSpace) : clean.slice(0, max - 1);
  return `${base.replace(/[\s,;:.\-–—]+$/, '')}…`;
}

/**
 * Deja la respuesta del chat en texto plano: sin etiquetas HTML ni marcas de markdown
 * (negritas, encabezados). Conserva los saltos de línea y las listas numeradas.
 */
export function toPlainText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/\*\*|__/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
