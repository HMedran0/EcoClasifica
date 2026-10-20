import { describe, expect, it } from 'vitest';
import { truncateWords } from '../src/utils/text';

describe('truncateWords', () => {
  it('deja intacto un texto que cabe (sin espacios sobrantes)', () => {
    expect(truncateWords('  Mini maceta  ', 20)).toBe('Mini maceta');
  });

  it('corta en la última palabra completa y añade «…»', () => {
    expect(truncateWords('Corta la botella por la mitad', 20)).toBe('Corta la botella…');
  });

  it('quita la puntuación que queda antes de «…»', () => {
    expect(truncateWords('Lava, seca, pinta y decora', 13)).toBe('Lava, seca…');
  });

  it('conserva la última palabra si el espacio cae justo en el límite', () => {
    expect(truncateWords('Mini maceta colgante', 12)).toBe('Mini maceta…');
  });

  it('trata saltos de línea y tabuladores como espacios', () => {
    expect(truncateWords('Corta\tla botella\npor la mitad', 20)).toBe('Corta la botella…');
  });

  it('corta en seco una sola palabra más larga que el máximo', () => {
    const result = truncateWords('a'.repeat(30), 10);
    expect(result).toBe(`${'a'.repeat(9)}…`);
  });
});
