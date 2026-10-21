// Lanza Vitest desde la ruta canónica de su binario (`C:\…`, no `c:\…`).
// En Windows, si la terminal abre el repo con la unidad en minúscula, `.bin/vitest` hereda esa ruta
// y Vitest carga dos copias de sí mismo («Vitest failed to find the runner»).
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(join(process.cwd(), 'package.json'));
const vitestDir = dirname(realpathSync.native(require.resolve('vitest/package.json')));
const bin = join(vitestDir, 'vitest.mjs');

const { status, signal } = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], {
  cwd: realpathSync.native(process.cwd()),
  stdio: 'inherit',
});
process.exit(status ?? (signal ? 1 : 0));
