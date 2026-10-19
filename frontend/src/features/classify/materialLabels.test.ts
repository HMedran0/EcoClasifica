import { describe, expect, it } from 'vitest';
import { capitalizeFirst, formatPercent } from './materialLabels';

const pct = (n: number) => `${n}${String.fromCharCode(0xa0)}%`;

describe('formatPercent', () => {
  it('trunca: 0,595 no aparenta llegar al umbral de 0,60', () => {
    expect(formatPercent(0.595)).toBe(pct(59));
  });

  it('trunca: 0,999 no se muestra como 100 %', () => {
    expect(formatPercent(0.999)).toBe(pct(99));
  });

  it('no pierde un punto por la coma flotante (0,29 × 100 = 28,999…)', () => {
    expect(formatPercent(0.29)).toBe(pct(29));
    expect(formatPercent(0.57)).toBe(pct(57));
  });

  it('los extremos exactos', () => {
    expect(formatPercent(0)).toBe(pct(0));
    expect(formatPercent(0.6)).toBe(pct(60));
    expect(formatPercent(1)).toBe(pct(100));
  });
});

describe('capitalizeFirst', () => {
  it('pone en mayúscula solo la primera letra', () => {
    expect(capitalizeFirst('ahuyama entera')).toBe('Ahuyama entera');
  });

  it('respeta tildes y la cadena vacía', () => {
    expect(capitalizeFirst('árbol')).toBe('Árbol');
    expect(capitalizeFirst('')).toBe('');
  });
});
