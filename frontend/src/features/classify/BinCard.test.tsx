import type { Disposal } from '@ecoclasifica/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BinCard } from './BinCard';

const bin = (overrides: Partial<Disposal>): Disposal => ({
  binCode: 'WHITE',
  binName: 'Contenedor blanco (aprovechables)',
  colorHex: '#F5F5F5',
  icon: 'bin-white',
  instructions: 'Vacíalo.',
  requiresDropOff: false,
  ...overrides,
});

describe('BinCard', () => {
  it('el contenedor blanco lleva borde visible y el nombre en texto', () => {
    render(<BinCard disposal={bin({})} />);
    expect(
      screen.getByRole('heading', { name: 'Contenedor blanco (aprovechables)' }),
    ).toBeVisible();
    expect(screen.getByTestId('bin-swatch')).toHaveClass('border-2', 'border-petroleo');
  });

  it('el ícono es decorativo y depende del binCode', () => {
    const { container } = render(
      <BinCard disposal={bin({ binCode: 'GREEN', colorHex: '#2E7D32' })} />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('data-bin', 'GREEN');
  });

  it('elige el color del ícono por contraste con el fondo', () => {
    const { rerender } = render(<BinCard disposal={bin({ colorHex: '#212121' })} />);
    expect(screen.getByTestId('bin-swatch')).toHaveStyle({ color: '#ffffff' });
    rerender(<BinCard disposal={bin({ colorHex: '#F9A825' })} />);
    expect(screen.getByTestId('bin-swatch')).toHaveStyle({ color: '#03393b' });
  });

  it('un color no válido del backend usa un gris neutro', () => {
    render(<BinCard disposal={bin({ colorHex: 'red;background:url(x)' })} />);
    expect(screen.getByTestId('bin-swatch')).toHaveStyle({ backgroundColor: '#9E9E9E' });
  });
});
