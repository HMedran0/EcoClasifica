import { describe, expect, it } from 'vitest';
import { returnUrl, safeReturnPath } from './returnPath';

describe('safeReturnPath', () => {
  it.each(['/historial', '/favoritos?pagina=2', '/'])('acepta la ruta interna %s', (path) => {
    expect(safeReturnPath(path)).toBe(path);
  });

  it.each([
    'https://malo.com',
    '//malo.com',
    '/\\malo.com',
    '/\t/malo.com',
    '/\n/malo.com',
    '/redirigir?a=https://malo.com',
    'historial',
    'javascript:alert(1)',
    '',
    null,
    undefined,
  ])('rechaza %s y usa «/»', (value) => {
    expect(safeReturnPath(value)).toBe('/');
  });
});

describe('returnUrl', () => {
  it('une el origen con la ruta validada', () => {
    expect(returnUrl('/historial', 'https://eco.app')).toBe('https://eco.app/historial');
    expect(returnUrl('//malo.com', 'https://eco.app')).toBe('https://eco.app/');
  });
});
