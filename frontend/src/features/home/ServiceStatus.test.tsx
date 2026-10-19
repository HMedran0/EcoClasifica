import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/errors';
import { setOnline } from '../../test/network';
import { ServiceStatus } from './ServiceStatus';

describe('ServiceStatus', () => {
  it('muestra «Comprobando conexión…» mientras espera la respuesta', () => {
    render(<ServiceStatus checkHealth={() => new Promise(() => {})} />);
    expect(screen.getByRole('status')).toHaveTextContent('Comprobando conexión…');
  });

  it('muestra «Servicio disponible» si /api/health responde', async () => {
    const checkHealth = vi.fn().mockResolvedValue({ status: 'ok' });
    render(<ServiceStatus checkHealth={checkHealth} />);
    expect(await screen.findByText('Servicio disponible')).toBeInTheDocument();
    expect(checkHealth).toHaveBeenCalledTimes(1);
  });

  it('muestra «Servicio no disponible» si la solicitud falla con red (backend caído o CORS)', async () => {
    render(<ServiceStatus checkHealth={() => Promise.reject(new ApiError('NETWORK_ERROR'))} />);
    expect(await screen.findByText('Servicio no disponible')).toBeInTheDocument();
  });

  it('cancela la solicitud al desmontarse', () => {
    const checkHealth = vi.fn<(opts?: { signal?: AbortSignal }) => Promise<unknown>>(
      () => new Promise(() => {}),
    );
    const { unmount } = render(<ServiceStatus checkHealth={checkHealth} />);
    unmount();
    expect(checkHealth.mock.calls[0]![0]?.signal?.aborted).toBe(true);
  });

  it('sin red no consulta /api/health ni muestra su propio mensaje (lo da OfflineBanner)', () => {
    setOnline(false);
    const checkHealth = vi.fn().mockResolvedValue({ status: 'ok' });
    render(<ServiceStatus checkHealth={checkHealth} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(checkHealth).not.toHaveBeenCalled();
  });

  it('al recuperar la red vuelve a consultar /api/health', async () => {
    setOnline(false);
    const checkHealth = vi.fn().mockResolvedValue({ status: 'ok' });
    render(<ServiceStatus checkHealth={checkHealth} />);
    setOnline(true);
    expect(await screen.findByText('Servicio disponible')).toBeInTheDocument();
    expect(checkHealth).toHaveBeenCalledTimes(1);
  });
});
