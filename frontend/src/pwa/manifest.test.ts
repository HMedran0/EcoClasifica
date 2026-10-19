import { describe, expect, it } from 'vitest';
import { manifest } from './manifest';

describe('manifest', () => {
  it('se instala como app independiente en español de Colombia', () => {
    expect(manifest).toMatchObject({
      name: 'EcoClasifica',
      short_name: 'EcoClasifica',
      lang: 'es-CO',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      theme_color: '#0C5A3B',
      background_color: '#F7FAF5',
    });
    expect(manifest.description).toMatch(/residuos/);
  });

  it('declara los íconos 192 y 512 normales y el 512 maskable', () => {
    const icons = (manifest.icons ?? []).map(({ sizes, purpose, type }) => ({
      sizes,
      purpose,
      type,
    }));
    expect(icons).toEqual([
      { sizes: '192x192', purpose: 'any', type: 'image/png' },
      { sizes: '512x512', purpose: 'any', type: 'image/png' },
      { sizes: '512x512', purpose: 'maskable', type: 'image/png' },
    ]);
  });

  it('apunta a íconos de public/icons', () => {
    for (const icon of manifest.icons ?? []) expect(icon.src).toMatch(/^\/icons\/[\w-]+\.png$/);
  });
});
