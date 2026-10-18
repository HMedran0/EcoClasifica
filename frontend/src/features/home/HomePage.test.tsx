import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HomePage } from './HomePage';

vi.mock('../../api/client', () => ({
  api: { health: vi.fn().mockResolvedValue({ status: 'ok' }) },
}));

describe('HomePage', () => {
  it('muestra el logo y el nombre con Eco y Clasifica separados por color', () => {
    const { container } = render(<HomePage />);
    expect(container.querySelector('img[src="/brand/logo.svg"]')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('EcoClasifica');
    expect(screen.getByText('Eco')).toHaveClass('text-hoja');
    expect(screen.getByText('Clasifica')).toHaveClass('text-petroleo');
  });

  it('muestra el indicador de conexión con el backend', async () => {
    render(<HomePage />);
    expect(await screen.findByText('Servicio disponible')).toBeInTheDocument();
  });
});
