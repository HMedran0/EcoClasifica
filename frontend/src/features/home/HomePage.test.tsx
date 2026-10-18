import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { HomePage } from './HomePage';

vi.mock('../../api/client', () => ({
  api: { health: vi.fn().mockResolvedValue({ status: 'ok' }) },
}));

describe('HomePage', () => {
  it('muestra el logo y el nombre con Eco y Clasifica separados por color', () => {
    const { container } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(container.querySelector('img[src="/brand/logo.svg"]')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('EcoClasifica');
    expect(screen.getByText('Eco')).toHaveClass('text-hoja');
    expect(screen.getByText('Clasifica')).toHaveClass('text-petroleo');
  });

  it('enlaza a la cámara con el botón Escanear residuo', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Escanear residuo' })).toHaveAttribute(
      'href',
      '/camara',
    );
  });

  it('muestra el indicador de conexión con el backend', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Servicio disponible')).toBeInTheDocument();
  });
});
