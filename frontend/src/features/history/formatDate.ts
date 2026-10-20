const FORMATTER = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

/** Fecha y hora del escaneo en español de Colombia (p. ej. «20 oct 2026, 7:00 a. m.»). */
export function formatScanDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : FORMATTER.format(date);
}
