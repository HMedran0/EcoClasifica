// Verifica que ninguna pantalla tenga desplazamiento horizontal en móviles (360 y 412 px).
// Uso: con `npm run dev:web` en marcha → `npm run check:layout -w frontend [-- /ruta ...]`.
// No corre en CI: necesita Chrome (CHROME_PATH) y el servidor de desarrollo.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const BASE = process.env.WEB_URL ?? 'http://localhost:5173';
const ANCHOS = '360,412';
const rutas = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/resultado'];

const candidatos = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const chrome = candidatos.find((p) => existsSync(p));
if (!chrome) {
  console.error('No encontré Chrome. Define CHROME_PATH.');
  process.exit(2);
}

let fallos = 0;
for (const ruta of rutas) {
  // Se mide dentro de iframes: Chrome headless no baja la ventana de ~500 px aunque se pida menos.
  const url = `${BASE}/dev/medir-ancho.html?anchos=${ANCHOS}&ruta=${encodeURIComponent(ruta)}`;
  const dom = execFileSync(
    chrome,
    ['--headless=new', '--disable-gpu', '--virtual-time-budget=8000', '--dump-dom', url],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  );
  const json = dom.match(/<pre id="resultado">(.*?)<\/pre>/s)?.[1];
  if (!json?.startsWith('[')) {
    console.error(`${ruta}: no se pudo medir (¿está corriendo npm run dev:web en ${BASE}?)`);
    process.exit(2);
  }
  for (const m of JSON.parse(json.replaceAll('&quot;', '"'))) {
    const ok = m.scrollWidth <= m.ancho;
    if (!ok) fallos++;
    console.log(
      `${ok ? '✓' : '✗'} ${ruta} a ${m.ancho} px: scrollWidth=${m.scrollWidth}` +
        (m.desbordan.length ? ` desbordan: ${m.desbordan.join(', ')}` : ''),
    );
  }
}
process.exit(fallos ? 1 : 0);
