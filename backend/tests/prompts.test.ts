import { MATERIALS } from '@ecoclasifica/shared';
import { describe, expect, it } from 'vitest';
import { CLASSIFY_SYSTEM, UPCYCLE_SYSTEM } from '../src/services/ai/prompts';

describe('UPCYCLE_SYSTEM', () => {
  it('prohíbe manualidades con peligrosos, sanitarios y vidrio roto', () => {
    expect(UPCYCLE_SYSTEM).toMatch(/can_upcycle=false si es o contiene un residuo peligroso/);
    for (const word of ['pilas', 'medicamentos', 'aerosoles', 'pañales', 'vidrio roto']) {
      expect(UPCYCLE_SYSTEM).toContain(word);
    }
    expect(UPCYCLE_SYSTEM).toMatch(/Nunca propongas manualidades con esos materiales/);
  });

  it('ante una bolsa cerrada u opaca con contenido, no propone ideas', () => {
    expect(UPCYCLE_SYSTEM).toMatch(
      /bolsa cerrada u opaca con contenido, ante la duda usa can_upcycle=false/,
    );
  });

  it('pide el material con el catálogo completo', () => {
    for (const code of MATERIALS) expect(UPCYCLE_SYSTEM).toContain(code);
  });

  it('pide is_waste para rechazar fotos sin residuo', () => {
    expect(UPCYCLE_SYSTEM).toMatch(/is_waste=false/);
  });
});

describe('CLASSIFY_SYSTEM', () => {
  it('enumera todos los materiales del contrato', () => {
    for (const code of MATERIALS) expect(CLASSIFY_SYSTEM).toContain(code);
  });

  it('manda los residuos sanitarios a mixto', () => {
    expect(CLASSIFY_SYSTEM).toMatch(/pañales.*son material mixto/);
  });

  it('pide baja certeza con mixto como alternativa si el contenido de una bolsa no se ve', () => {
    expect(CLASSIFY_SYSTEM).toMatch(/bolsa cerrada u opaca/);
    expect(CLASSIFY_SYSTEM).toMatch(
      /material el de la bolsa, confidence <= 0\.5 y en alternatives mixto/,
    );
  });

  it('prohíbe inferir el estado del objeto sin evidencia', () => {
    expect(CLASSIFY_SYSTEM).toMatch(/no infieras moho, descomposición ni suciedad/);
    expect(CLASSIFY_SYSTEM).toMatch(/no menciones su estado en object ni en material_detail/);
  });
});
