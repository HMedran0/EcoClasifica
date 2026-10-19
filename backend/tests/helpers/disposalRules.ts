import { vi } from 'vitest';
import type { DisposalRule, DisposalRulesRepo } from '../../src/repositories/disposalRules.repo';

const white = {
  binCode: 'WHITE',
  binName: 'Contenedor blanco (aprovechables)',
  colorHex: '#F5F5F5',
  icon: 'bin-white',
  requiresDropOff: false,
} as const;

const dropOff = {
  binCode: 'DROP_OFF',
  binName: 'Punto limpio',
  colorHex: '#F9A825',
  icon: 'drop-off',
  requiresDropOff: true,
} as const;

/** Subconjunto de `supabase/seed.sql` para pruebas. */
export const seedRules: DisposalRule[] = [
  {
    ...white,
    materialCode: 'plastico',
    municipalityCode: 'DEFAULT',
    instructions: 'Limpio y seco. Si es un envase, vacíalo y aplástalo.',
  },
  {
    ...white,
    materialCode: 'vidrio',
    municipalityCode: 'DEFAULT',
    instructions: 'Limpio y seco. Si está roto, envuélvelo en papel.',
  },
  {
    ...dropOff,
    materialCode: 'electronico',
    municipalityCode: 'DEFAULT',
    instructions: 'Llévalo a un punto de acopio de residuos electrónicos.',
  },
  {
    ...dropOff,
    materialCode: 'peligroso',
    municipalityCode: 'DEFAULT',
    instructions: 'Llévalo a un punto de acopio de residuos peligrosos.',
  },
  {
    materialCode: 'otro',
    municipalityCode: 'DEFAULT',
    binCode: 'BLACK',
    binName: 'Contenedor negro (no aprovechables)',
    colorHex: '#212121',
    icon: 'bin-black',
    instructions: 'Si no puedes separarlo, va a no aprovechables.',
    requiresDropOff: false,
  },
];

export function fakeDisposalRepo(rules: DisposalRule[] = seedRules) {
  const listAll = vi.fn<DisposalRulesRepo['listAll']>().mockResolvedValue(rules);
  return { listAll } satisfies DisposalRulesRepo;
}
