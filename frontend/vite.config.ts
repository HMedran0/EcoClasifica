import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Contrato por alias (ADR-17): Vercel instala solo frontend/, así que no hay paquete que enlazar.
    alias: {
      '@ecoclasifica/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    },
    // `shared/src` importa zod; se fuerza la copia del frontend aunque shared/ no tenga node_modules.
    dedupe: ['zod'],
  },
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
});
