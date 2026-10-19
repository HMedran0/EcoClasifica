// Genera los íconos de la PWA en public/icons/ (npm run icons). Los PNG resultantes se versionan.
import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, renameSync } from 'node:fs';
import { URL, fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}public/icons/`;

// [variante, archivo generado (junto a su SVG de origen), nombre final]
const outputs = [
  ['app', 'public/brand/pwa-192x192.png', 'icon-192.png'],
  ['app', 'public/brand/pwa-512x512.png', 'icon-512.png'],
  ['maskable', 'pwa-assets/maskable-icon-512x512.png', 'maskable-512.png'],
  ['maskable', 'pwa-assets/apple-touch-icon-180x180.png', 'apple-touch-icon-180.png'],
  ['favicon', 'pwa-assets/favicon.ico', 'favicon.ico'],
];

mkdirSync(out, { recursive: true });
for (const variant of new Set(outputs.map(([v]) => v))) {
  execSync('npx pwa-assets-generator -c pwa-assets.config.ts -m false', {
    cwd: root,
    env: { ...process.env, ICON_VARIANT: variant },
    stdio: ['ignore', 'ignore', 'inherit'], // errores del generador visibles; su salida normal, no
  });
}
for (const [, from, to] of outputs) renameSync(`${root}${from}`, `${out}${to}`);
copyFileSync(`${root}pwa-assets/favicon.svg`, `${out}favicon.svg`);
console.log(
  `Íconos generados en public/icons/: ${outputs.map(([, , to]) => to).join(', ')}, favicon.svg`,
);
