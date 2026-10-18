import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

/** Sin VITE_API_URL el bundle llamaría al propio dominio de Vercel: el build de producción falla antes. */
function assertApiUrl(env: Record<string, string>): void {
  const value = env.VITE_API_URL;
  if (!value || !URL.canParse(value)) {
    throw new Error(
      'VITE_API_URL debe ser la URL absoluta del backend (p. ej. https://<servicio>.up.railway.app). ' +
        'Defínela en Vercel → Settings → Environment Variables.',
    );
  }
}

const frontendDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ command, mode }) => {
  if (command === 'build' && mode === 'production') {
    assertApiUrl(loadEnv(mode, frontendDir, 'VITE_'));
  }
  return {
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
  };
});
