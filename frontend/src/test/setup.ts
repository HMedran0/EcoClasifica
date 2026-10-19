import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';
import { restoreOnline } from './network';

// No se usa `@testing-library/jest-dom/vitest`: al estar en la raíz importaría el Vitest 2 del
// backend y registraría los matchers en otro `expect` (ver jest-dom.d.ts).
expect.extend(matchers);

afterEach(() => {
  cleanup();
  restoreOnline();
});
