import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // El contrato compartido se empaqueta dentro del build (no se publica como paquete).
  noExternal: ['@ecoclasifica/shared'],
});
