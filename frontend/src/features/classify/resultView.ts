import type { ClassifyResponse, Disposal } from '@ecoclasifica/shared';

/** Qué bloque principal muestra la pantalla de resultado (HU-17). */
export type ResultView =
  /** Punto limpio: tiene prioridad aunque la certeza sea baja (pilas, electrónicos). */
  | { kind: 'dropOff'; disposal: Disposal; unsure: boolean }
  | { kind: 'unsure' }
  | { kind: 'binCard'; disposal: Disposal }
  /** Sin regla de disposición (p. ej. Supabase no respondió). */
  | { kind: 'noRule' };

export function toResultView({ result, disposal }: ClassifyResponse): ResultView {
  if (disposal?.requiresDropOff) {
    return { kind: 'dropOff', disposal, unsure: result.lowConfidence };
  }
  // Con baja certeza nunca se propone un contenedor doméstico.
  if (result.lowConfidence) return { kind: 'unsure' };
  if (disposal) return { kind: 'binCard', disposal };
  return { kind: 'noRule' };
}
