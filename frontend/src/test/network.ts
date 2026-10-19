import { act } from '@testing-library/react';
import { vi, type MockInstance } from 'vitest';

let onLineSpy: MockInstance<() => boolean> | undefined;

/** Simula `navigator.onLine` y emite el evento correspondiente. setup.ts lo restaura tras cada prueba. */
export function setOnline(online: boolean): void {
  onLineSpy ??= vi.spyOn(navigator, 'onLine', 'get');
  onLineSpy.mockReturnValue(online);
  act(() => {
    window.dispatchEvent(new Event(online ? 'online' : 'offline'));
  });
}

export function restoreOnline(): void {
  onLineSpy?.mockRestore();
  onLineSpy = undefined;
}
