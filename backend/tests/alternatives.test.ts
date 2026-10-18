import type { AiClassifyOutput } from '@ecoclasifica/shared';
import { describe, expect, it } from 'vitest';
import { pickAlternatives } from '../src/services/classification.service';

const base: AiClassifyOutput = {
  is_waste: true,
  object: 'Envase',
  material: 'plastico',
  material_detail: '',
  confidence: 0.5,
  alternatives: [],
};

describe('pickAlternatives', () => {
  it('conserva la certeza mayor cuando la IA repite un material', () => {
    const out = pickAlternatives({
      ...base,
      alternatives: [
        { material: 'vidrio', confidence: 0.1 },
        { material: 'vidrio', confidence: 0.3 },
      ],
    });
    expect(out).toEqual([{ material: 'vidrio', confidence: 0.3 }]);
  });

  it('deja solo las 2 mejores si la IA manda más', () => {
    const out = pickAlternatives({
      ...base,
      alternatives: [
        { material: 'plastico', confidence: 0.4 },
        { material: 'papel', confidence: 0.1 },
        { material: 'vidrio', confidence: 0.3 },
        { material: 'metal', confidence: 0.2 },
      ],
    });
    expect(out.map((a) => a.material)).toEqual(['vidrio', 'metal']);
  });

  it('devuelve un arreglo vacío si la IA no da alternativas', () => {
    expect(pickAlternatives(base)).toEqual([]);
  });
});
