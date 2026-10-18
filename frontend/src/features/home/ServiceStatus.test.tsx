import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/errors';
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

  it('muestra «Sin conexión» si la solicitud falla (red o CORS)', async () => {
    render(<ServiceStatus checkHealth={() => Promise.reject(new ApiError('NETWORK_ERROR'))} />);
    expect(await screen.findByText('Sin conexión')).toBeInTheDocument();
  });

  it('cancela la solicitud al desmontarse', () => {
    const checkHealth = vi.fn<(opts?: { signal?: AbortSignal }) => Promise<unknown>>(
      () => new Promise(() => {}),
    );
    const { unmount } = render(<ServiceStatus checkHealth={checkHealth} />);
    unmount();
    expect(checkHealth.mock.calls[0]![0]?.signal?.aborted).toBe(true);
  });
});
