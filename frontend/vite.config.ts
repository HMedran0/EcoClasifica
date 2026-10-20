import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { manifest } from './src/pwa/manifest.ts';

const SET_IN_VERCEL = 'Defínela en Vercel → Settings → Environment Variables.';

/** Sin estas variables el bundle no funcionaría en Vercel: el build de producción falla antes. */
function assertBuildEnv(env: Record<string, string>): void {
  if (!env.VITE_API_URL || !URL.canParse(env.VITE_API_URL)) {
    throw new Error(
      'VITE_API_URL debe ser la URL absoluta del backend (p. ej. https://<servicio>.up.railway.app). ' +
        SET_IN_VERCEL,
    );
  }
  if (!env.VITE_SUPABASE_URL || !URL.canParse(env.VITE_SUPABASE_URL)) {
    throw new Error(`VITE_SUPABASE_URL debe ser https://<proyecto>.supabase.co. ${SET_IN_VERCEL}`);
  }
  if (!env.VITE_SUPABASE_ANON_KEY) {
    throw new Error(
      `Falta VITE_SUPABASE_ANON_KEY (clave publicable sb_publishable_…). ${SET_IN_VERCEL}`,
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
    assertBuildEnv(loadEnv(mode, frontendDir, 'VITE_'));
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
      // Valores ficticios: las pruebas simulan Supabase y nunca llaman al proyecto real.
      env: {
        VITE_SUPABASE_URL: 'http://localhost:54321',
        VITE_SUPABASE_ANON_KEY: 'sb_publishable_prueba',
      },
    },
  };
});
