import type { ManifestOptions } from 'vite-plugin-pwa';

/** Manifiesto de la PWA (HU-01). Lo consume `VitePWA` en vite.config.ts; los PNG salen de `npm run icons`. */
export const manifest: Partial<ManifestOptions> = {
  name: 'EcoClasifica',
  short_name: 'EcoClasifica',
  description: 'Clasifica tus residuos con IA y dales una segunda vida.',
  lang: 'es-CO',
  dir: 'ltr',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  // bosque en la barra de estado de Android (iconos claros); fondo claro de la app en el splash.
  theme_color: '#0C5A3B',
  background_color: '#F7FAF5',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
