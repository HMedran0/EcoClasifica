import {
  HISTORY_PAGE_SIZE,
  historyIdSchema,
  type HistoryDetail,
  type HistoryItem,
  type HistoryListResponse,
  type SavedScanResult,
} from '@ecoclasifica/shared';
import type { Logger } from 'pino';
import type { ListedScan, ScanRecord, ScansRepo } from '../repositories/scans.repo';
import { AppError } from '../utils/appError';
import type { AuthUser } from './auth.service';

export interface HistoryDeps {
  scans: ScansRepo;
}

/** Una página de 20, más recientes primero. Se pide uno de más para saber si hay otra página. */
export async function listHistory(
  { scans }: HistoryDeps,
  user: AuthUser,
  page: number,
  log: Logger,
): Promise<HistoryListResponse> {
  const rows = await scans.list(user.id, {
    offset: (page - 1) * HISTORY_PAGE_SIZE,
    limit: HISTORY_PAGE_SIZE + 1,
  });
  const pageRows = validRows(rows.slice(0, HISTORY_PAGE_SIZE), log);
  const urls = await signOrNull(scans, pageRows, log);
  return {
    items: pageRows.map((row, i) => toItem(row, urls[i] ?? null)),
    page,
    pageSize: HISTORY_PAGE_SIZE,
    hasMore: rows.length > HISTORY_PAGE_SIZE,
  };
}

/** Omite las filas corruptas para que no tumben la lista; se registra solo su id. */
function validRows(rows: ListedScan[], log: Logger): ScanRecord[] {
  const valid: ScanRecord[] = [];
  for (const row of rows) {
    if (row.ok) valid.push(row.record);
    else log.warn({ scanId: row.id }, 'Escaneo con resultado inválido omitido del historial');
  }
  return valid;
}

/** El id de otro usuario o mal formado responde 404 (no 403): no se revela si existe. */
export async function getHistoryItem(
  { scans }: HistoryDeps,
  user: AuthUser,
  scanId: string,
  log: Logger,
): Promise<HistoryDetail> {
  const id = historyIdSchema.safeParse(scanId);
  const row = id.success ? await scans.findById(user.id, id.data) : null;
  if (!row) throw new AppError('NOT_FOUND', 'No encontramos ese escaneo en tu historial');
  const [imageUrl = null] = await signOrNull(scans, [row], log);
  return { ...row.saved, id: row.id, createdAt: row.createdAt, imageUrl };
}

/** Sin firma la lista sigue siendo útil: las imágenes quedan en `null` y se registra el motivo. */
async function signOrNull(scans: ScansRepo, rows: ScanRecord[], log: Logger) {
  const withImage = rows.filter((row) => row.imagePath !== null);
  let signed: (string | null)[] = [];
  try {
    signed = await scans.signImageUrls(withImage.map((row) => row.imagePath as string));
  } catch (err) {
    log.error(
      { reason: err instanceof Error ? err.message : 'desconocido' },
      'No se pudieron firmar las imágenes del historial',
    );
  }
  const byId = new Map(withImage.map((row, i) => [row.id, signed[i] ?? null]));
  return rows.map((row) => byId.get(row.id) ?? null);
}

function toItem(row: ScanRecord, thumbnailUrl: string | null): HistoryItem {
  return {
    id: row.id,
    createdAt: row.createdAt,
    mode: row.saved.mode,
    objectName: row.objectName,
    summary: summarize(row.saved),
    thumbnailUrl,
  };
}

export function summarize(saved: SavedScanResult): string {
  if (saved.mode === 'classify') return saved.disposal?.binName ?? 'Revisa el material';
  if (!saved.result.canUpcycle) return 'No reutilizable';
  return `${saved.result.ideas.length} ideas`;
}
