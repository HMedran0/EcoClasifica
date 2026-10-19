import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { manifest } from './src/pwa/manifest.ts';

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

/** App shell en precache; la API (Railway, otro origen) siempre a la red: nunca se cachean escaneos ni fotos. */
function pwa() {
  return VitePWA({
    registerType: 'prompt',
    injectRegister: false, // lo registra useRegisterSW en UpdatePrompt
    manifest,
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      navigateFallback: 'index.html',
      navigateFallbackDenylist: [/^\/api\//],
      cleanupOutdatedCaches: true,
      runtimeCaching: [
        { urlPattern: ({ url }) => url.pathname.startsWith('/api/'), handler: 'NetworkOnly' },
      ],
    },
  });
}

const frontendDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ command, mode }) => {
  if (command === 'build' && mode === 'production') {
    assertApiUrl(loadEnv(mode, frontendDir, 'VITE_'));
  }
  return {
    plugins: [react(), tailwindcss(), pwa()],
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
