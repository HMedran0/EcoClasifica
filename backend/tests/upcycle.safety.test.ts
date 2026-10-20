import type { AiUpcycleOutput } from '@ecoclasifica/shared';
import type { Logger } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import type { AiProvider } from '../src/services/ai/ai.provider';
import { findSafetyBlock, hasBlockedTerm } from '../src/services/upcycle.safety';
import { upcycleScan } from '../src/services/upcycle.service';

describe('hasBlockedTerm', () => {
  it.each([
    'Pila AA',
    'PILAS alcalinas',
    'Batería de celular',
    'Caja de medicamentos',
    'Jeringa usada',
    'Pañal desechable',
    'Pañales',
    'Toalla higiénica',
    'Lata de aerosol',
    'Frasco de insecticida',
    'Veneno para ratas',
    'Productos químicos',
    'Galón de cloro',
    'Tarro de thinner',
    'Bidón de gasolina',
    'Bombillo ahorrador',
    'Tubo fluorescente',
    'Vidrio roto',
    'Vidrios rotos de ventana',
    'Bomba casera',
    'Bombas caseras',
    'Bombas molotov',
    'Material explosivo',
    'Pólvora negra',
    'Arma hechiza',
  ])('bloquea "%s"', (name) => {
    expect(hasBlockedTerm(name)).toBe(true);
  });

  it.each([
    'Botella de aceite vacía',
    'Frasco de vidrio',
    'Pilar de madera',
    'Toalla de baño',
    'Bolsa plástica',
    'Armario de cartón',
    'Armazón de lentes',
    'Bombona de agua',
    'Bomba de agua',
    'Bomba de bicicleta',
  ])('no bloquea "%s"', (name) => {
    expect(hasBlockedTerm(name)).toBe(false);
  });
});

describe('findSafetyBlock', () => {
  it('prioriza la regla de material', () => {
    expect(findSafetyBlock('Pila AA', 'peligroso')?.rule).toBe('material');
    expect(findSafetyBlock('Pila AA', 'metal')?.rule).toBe('blocked_term');
    expect(findSafetyBlock('Frasco de vidrio', 'vidrio')).toBeNull();
  });
});

describe('upcycleScan: registro del bloqueo', () => {
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200)]);
  const req = { image: jpeg.toString('base64'), mimeType: 'image/jpeg' as const, locale: 'es-CO' };
  const idea = { title: 'Idea', description: 'Corta y decora.', extra_materials: [] };
  const battery: AiUpcycleOutput = {
    is_waste: true,
    can_upcycle: true,
    reason: '',
    object_name: 'Pila AA',
    material: 'metal',
    difficulty: 'Fácil',
    ideas: [idea, idea, idea],
  };

  it('registra un warn con objectName, material y regla, sin la imagen', async () => {
    const log = { info: vi.fn(), warn: vi.fn() };
    const ai: AiProvider = {
      classify: vi.fn(),
      upcycle: vi.fn<AiProvider['upcycle']>().mockResolvedValue({
        data: battery,
        usage: { promptTokens: 1, completionTokens: 1 },
        latencyMs: 1,
      }),
      chat: vi.fn(),
    };

    const { response } = await upcycleScan({ ai }, req, log as unknown as Logger);

    expect(response.result.canUpcycle).toBe(false);
    expect(log.warn).toHaveBeenCalledWith(
      { objectName: 'Pila AA', material: 'metal', rule: 'blocked_term' },
      expect.any(String),
    );
    expect(JSON.stringify(log.warn.mock.calls)).not.toContain(req.image);
  });
});
