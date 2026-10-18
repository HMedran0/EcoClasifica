import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HomePage } from './HomePage';

describe('HomePage', () => {
  it('muestra el logo y el nombre con Eco y Clasifica separados por color', () => {
    const { container } = render(<HomePage />);
    expect(container.querySelector('img[src="/brand/logo.svg"]')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('EcoClasifica');
    expect(screen.getByText('Eco')).toHaveClass('text-hoja');
    expect(screen.getByText('Clasifica')).toHaveClass('text-petroleo');
  });
});
