import { ERROR_STATUS, type ErrorCode } from '@ecoclasifica/shared';
import { describe, expect, it } from 'vitest';
import { errorMessage, isBackendErrorCode } from './errors';

describe('errorMessage', () => {
  it.each(Object.keys(ERROR_STATUS) as ErrorCode[])('tiene mensaje para %s', (code) => {
    expect(errorMessage(code).length).toBeGreaterThan(10);
  });

  it('no confunde propiedades heredadas con códigos del backend', () => {
    expect(isBackendErrorCode('toString')).toBe(false);
    expect(isBackendErrorCode('NOT_A_WASTE')).toBe(true);
  });
});
