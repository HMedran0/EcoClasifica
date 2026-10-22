import type { MaintenanceRepo, StoredImage } from '../repositories/maintenance.repo';
import { STORAGE_PAGE_SIZE } from '../repositories/scans.repo';
import { SupabaseOpError } from '../repositories/supabase';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Una imagen sin fila más reciente puede ser una subida en curso: no se toca. */
export const ORPHAN_MIN_AGE_MS = 24 * HOUR_MS;
/** Lo que promete la política de privacidad (HU-21). */
export const AI_USAGE_RETENTION_DAYS = 90;
export const REMOVE_BATCH_SIZE = 100;
/** Freno: con al menos `MIN` revisadas, más de `RATIO` huérfanas exige `--force`. */
export const BRAKE_MIN_CHECKED = 20;
export const BRAKE_RATIO = 0.5;

export interface MaintenanceOptions {
  apply: boolean;
  force: boolean;
  now: Date;
}

export type MaintenanceOutcome = 'simulated' | 'applied' | 'braked';

/** Solo conteos: nunca rutas, uuids ni correos. */
export interface MaintenanceReport {
  outcome: MaintenanceOutcome;
  folders: number;
  imagesChecked: number;
  orphans: number;
  /** Sin fila pero con menos de 24 h (o sin fecha): se respetan. */
  recentWithoutRow: number;
  imagesDeleted: number;
  batches: number;
  aiUsageOld: number;
  aiUsageDeleted: number;
  /** Con `--apply` (sin `--force`) saltaría el freno; útil para avisar en la simulación. */
  wouldBrake: boolean;
}

/** Falló un borrado ya empezado: lleva lo que alcanzó a borrar. */
export class MaintenanceDeleteError extends Error {
  constructor(
    readonly failure: unknown,
    readonly partial: MaintenanceReport,
  ) {
    super('Falló el borrado a mitad de camino');
    this.name = 'MaintenanceDeleteError';
  }
}

interface Scan {
  folders: number;
  imagesChecked: number;
  orphans: string[];
  recentWithoutRow: number;
}

function isOld(image: StoredImage, now: Date): boolean {
  return image.createdAt !== null && now.getTime() - image.createdAt.getTime() > ORPHAN_MIN_AGE_MS;
}

/**
 * Recorre todo el bucket y consulta `scans` antes de borrar nada: cualquier error lanza y la
 * ejecución se aborta sin haber borrado. Un error nunca cuenta como «sin fila».
 */
async function findOrphans(repo: MaintenanceRepo, now: Date): Promise<Scan> {
  const scan: Scan = { folders: 0, imagesChecked: 0, orphans: [], recentWithoutRow: 0 };
  const pending = [''];
  for (let folder = pending.pop(); folder !== undefined; folder = pending.pop()) {
    for (let offset = 0; ;) {
      const page = await repo.listPage(folder, offset);
      scan.folders += page.folders.length;
      pending.push(...page.folders);
      const existing = await repo.existingImagePaths(page.images.map((image) => image.path));
      for (const image of page.images) {
        scan.imagesChecked += 1;
        if (existing.has(image.path)) continue;
        if (isOld(image, now)) scan.orphans.push(image.path);
        else scan.recentWithoutRow += 1;
      }
      if (page.done) break;
      offset += STORAGE_PAGE_SIZE;
    }
  }
  return scan;
}

export function isBraked(imagesChecked: number, orphans: number): boolean {
  return imagesChecked >= BRAKE_MIN_CHECKED && orphans / imagesChecked > BRAKE_RATIO;
}

export async function runMaintenance(
  repo: MaintenanceRepo,
  { apply, force, now }: MaintenanceOptions,
): Promise<MaintenanceReport> {
  const scan = await findOrphans(repo, now);
  const cutoff = new Date(now.getTime() - AI_USAGE_RETENTION_DAYS * DAY_MS);
  const aiUsageOld = await repo.countAiUsageBefore(cutoff);

  const wouldBrake = isBraked(scan.imagesChecked, scan.orphans.length);
  const braked = wouldBrake && !force;
  const report: MaintenanceReport = {
    outcome: !apply ? 'simulated' : braked ? 'braked' : 'applied',
    folders: scan.folders,
    imagesChecked: scan.imagesChecked,
    orphans: scan.orphans.length,
    recentWithoutRow: scan.recentWithoutRow,
    imagesDeleted: 0,
    batches: 0,
    aiUsageOld,
    aiUsageDeleted: 0,
    wouldBrake,
  };
  if (report.outcome !== 'applied') return report;

  try {
    for (let i = 0; i < scan.orphans.length; i += REMOVE_BATCH_SIZE) {
      const batch = scan.orphans.slice(i, i + REMOVE_BATCH_SIZE);
      await repo.removeImages(batch);
      report.imagesDeleted += batch.length;
      report.batches += 1;
    }
    if (aiUsageOld > 0) report.aiUsageDeleted = await repo.deleteAiUsageBefore(cutoff);
  } catch (err) {
    throw new MaintenanceDeleteError(err, report);
  }
  return report;
}

// ───────────────── Línea de comandos ─────────────────

const USAGE = 'Uso: npm run maintenance [-- --apply [--force]]';

const OUTCOME_TEXT: Record<MaintenanceOutcome, string> = {
  simulated: 'SIMULACIÓN (--dry-run): no se borró nada. Usa --apply para borrar.',
  applied: 'APLICADO: se borró lo indicado.',
  braked:
    `DETENIDO por el freno de seguridad: no se borró nada. Más del ${BRAKE_RATIO * 100} % de ` +
    'las imágenes revisadas salieron huérfanas, lo que suele indicar un fallo (p. ej. la ' +
    'consulta a scans o el proyecto equivocado). Revisa y, si es correcto, repite con --apply --force.',
};

const BRAKE_WARNING =
  'AVISO: con --apply saltaría el freno de seguridad (más del ' +
  `${BRAKE_RATIO * 100} % huérfanas). Revisa antes de usar --apply --force.`;

export function formatReport(report: MaintenanceReport): string {
  return [
    `Resultado: ${OUTCOME_TEXT[report.outcome]}`,
    ...(report.outcome === 'simulated' && report.wouldBrake ? [BRAKE_WARNING] : []),
    `Carpetas recorridas: ${report.folders}`,
    `Imágenes revisadas: ${report.imagesChecked}`,
    `Huérfanas (sin fila y > 24 h): ${report.orphans}`,
    `Sin fila pero recientes (se respetan): ${report.recentWithoutRow}`,
    `Imágenes borradas: ${report.imagesDeleted} en ${report.batches} lotes`,
    `ai_usage con más de ${AI_USAGE_RETENTION_DAYS} días: ${report.aiUsageOld}`,
    `ai_usage borradas: ${report.aiUsageDeleted}`,
  ].join('\n');
}

type Flags = { apply: boolean; force: boolean };

/** `null` ante un argumento desconocido o contradictorio (`--dry-run` con `--apply`). */
export function parseFlags(argv: string[]): Flags | null {
  const known = new Set(['--apply', '--force', '--dry-run']);
  if (!argv.every((arg) => known.has(arg))) return null;
  const flags = { apply: argv.includes('--apply'), force: argv.includes('--force') };
  if (flags.apply && argv.includes('--dry-run')) return null;
  return flags;
}

/** Solo el código de Supabase; cualquier otro error, sin su mensaje (podría citar rutas). */
function describeError(err: unknown): string {
  return err instanceof SupabaseOpError ? err.message : 'error inesperado';
}

export interface CliDeps {
  argv: string[];
  env: Partial<Record<string, string>>;
  createRepo: () => MaintenanceRepo;
  now: () => Date;
  write: (line: string) => void;
}

/** Devuelve el código de salida: 0 bien, 1 error o freno activado. */
export async function runMaintenanceCli(deps: CliDeps): Promise<number> {
  const flags = parseFlags(deps.argv);
  if (!flags) {
    deps.write(`Argumentos no válidos. ${USAGE}`);
    return 1;
  }
  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((key) => !deps.env[key]);
  if (missing.length > 0) {
    deps.write(
      `Faltan variables de entorno: ${missing.join(', ')}. Defínelas (o ejecuta con ` +
        '`railway run`) y vuelve a intentarlo. No se hizo nada.',
    );
    return 1;
  }

  try {
    const report = await runMaintenance(deps.createRepo(), { ...flags, now: deps.now() });
    deps.write(formatReport(report));
    return report.outcome === 'braked' ? 1 : 0;
  } catch (err) {
    if (err instanceof MaintenanceDeleteError) {
      deps.write(
        `ERROR al borrar (${describeError(err.failure)}). Se detuvo a mitad de camino; ` +
          'vuelve a ejecutarlo para terminar.',
      );
      deps.write(formatReport(err.partial));
    } else {
      deps.write(
        `ERROR al revisar Storage, scans o ai_usage (${describeError(err)}). ` +
          'Ejecución abortada: no se borró nada.',
      );
    }
    return 1;
  }
}
