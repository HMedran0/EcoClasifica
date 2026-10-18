// jest-dom se instala en la raíz y extiende el `@vitest/expect` del backend (Vitest 2). Aquí se
// extiende el `vitest` del frontend (Vitest 5) para que los matchers tengan tipos.
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'vitest' {
  // La fusión de interfaces exige los mismos parámetros que la declaración original (`T = any`).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type
  interface Assertion<T = any> extends TestingLibraryMatchers<unknown, T> {}
}
