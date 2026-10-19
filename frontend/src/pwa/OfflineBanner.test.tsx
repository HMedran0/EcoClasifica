import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setOnline } from '../test/network';
import { OfflineBanner } from './OfflineBanner';

describe('OfflineBanner', () => {
  it('no muestra nada con conexión', () => {
    setOnline(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('avisa que escanear requiere internet al perder la conexión y se oculta al recuperarla', () => {
    setOnline(true);
    render(<OfflineBanner />);

    setOnline(false);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Sin conexión: escanear requiere internet',
    );

    setOnline(true);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('se muestra al abrir la app ya sin conexión', () => {
    setOnline(false);
    render(<OfflineBanner />);
    expect(screen.getByRole('status')).toHaveTextContent('Sin conexión');
  });
});
