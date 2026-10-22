/**
 * F5 — Mantenimiento del piloto: imágenes huérfanas de `scan-images` y `ai_usage` > 90 días.
 * Uso: npm run maintenance                     (simulación: solo cuenta)
 *      npm run maintenance -- --apply          (borra)
 *      npm run maintenance -- --apply --force  (borra aunque salte el freno de seguridad)
 * Lee SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY del entorno. La salida solo trae conteos.
 */

// Importación dinámica: `env.ts` valida el entorno al cargarse (y lee `.env`); una variable mal
// formada (p. ej. SUPABASE_URL con ruta) debe dar un mensaje claro, no una traza de Zod.
async function main(): Promise<number> {
  let modules;
  try {
    modules = await Promise.all([
      import('../src/config/env'),
      import('../src/repositories/maintenance.repo'),
      import('../src/services/maintenance.service'),
    ]);
  } catch {
    console.log(
      'Variables de entorno inválidas (revisa SUPABASE_URL: solo https://<proyecto>.supabase.co). ' +
        'No se hizo nada.',
    );
    return 1;
  }
  const [{ env }, { createSupabaseMaintenanceRepo }, { runMaintenanceCli }] = modules;
  return runMaintenanceCli({
    argv: process.argv.slice(2),
    env: {
      SUPABASE_URL: env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    },
    createRepo: () => createSupabaseMaintenanceRepo(),
    now: () => new Date(),
    write: (line) => console.log(line),
  });
}

process.exitCode = await main();

export {};
