import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdatePrompt } from './UpdatePrompt';

const sw = vi.hoisted(() => ({ needRefresh: false, updateServiceWorker: vi.fn() }));

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [sw.needRefresh, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: sw.updateServiceWorker,
  }),
}));

beforeEach(() => {
  sw.needRefresh = false;
  sw.updateServiceWorker.mockReset().mockResolvedValue(undefined);
});

describe('UpdatePrompt', () => {
  it('no aparece si no hay versión nueva', () => {
    render(<UpdatePrompt />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('avisa de la versión nueva y «Actualizar» activa el SW nuevo y recarga', () => {
    sw.needRefresh = true;
    render(<UpdatePrompt />);

    expect(screen.getByRole('alert')).toHaveTextContent('Hay una versión nueva');
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(sw.updateServiceWorker).toHaveBeenCalledWith(true);
  });
});
