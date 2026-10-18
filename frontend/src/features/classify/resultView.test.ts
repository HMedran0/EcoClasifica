import type { ClassifyResponse, Disposal } from '@ecoclasifica/shared';
import { describe, expect, it } from 'vitest';
import { toResultView } from './resultView';

const whiteBin: Disposal = {
  binCode: 'WHITE',
  binName: 'Contenedor blanco (aprovechables)',
  colorHex: '#F5F5F5',
  icon: 'bin-white',
  instructions: 'Vacíalo, aplástalo y ponle la tapa.',
  requiresDropOff: false,
};
const dropOff: Disposal = {
  binCode: 'DROP_OFF',
  binName: 'Punto limpio',
  colorHex: '#F9A825',
  icon: 'drop-off',
  instructions: 'Lleva el aparato a un punto de acopio.',
  requiresDropOff: true,
};

function response(lowConfidence: boolean, disposal: Disposal | null): ClassifyResponse {
  return {
    scanId: null,
    mode: 'classify',
    result: {
      object: 'Objeto',
      material: 'plastico',
      materialDetail: 'PET',
      confidence: lowConfidence ? 0.4 : 0.9,
      lowConfidence,
      alternatives: [],
    },
    disposal,
    saved: false,
  };
}

describe('toResultView', () => {
  it('con certeza suficiente y regla muestra la tarjeta del contenedor', () => {
    expect(toResultView(response(false, whiteBin))).toEqual({
      kind: 'binCard',
      disposal: whiteBin,
    });
  });

  it('punto limpio con certeza suficiente', () => {
    expect(toResultView(response(false, dropOff))).toEqual({
      kind: 'dropOff',
      disposal: dropOff,
      unsure: false,
    });
  });

  it('punto limpio con baja certeza lo marca como dudoso', () => {
    expect(toResultView(response(true, dropOff))).toEqual({
      kind: 'dropOff',
      disposal: dropOff,
      unsure: true,
    });
  });

  it('baja certeza sin punto limpio no propone contenedor', () => {
    expect(toResultView(response(true, null))).toEqual({ kind: 'unsure' });
    expect(toResultView(response(true, whiteBin))).toEqual({ kind: 'unsure' });
  });

  it('sin regla y con certeza suficiente', () => {
    expect(toResultView(response(false, null))).toEqual({ kind: 'noRule' });
  });
});
