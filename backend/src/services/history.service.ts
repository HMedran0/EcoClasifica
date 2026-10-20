import {
  HISTORY_PAGE_SIZE,
  historyIdSchema,
  type DeleteHistoryResponse,
  type HistoryDetail,
  type HistoryItem,
  type HistoryListResponse,
  type SavedScanResult,
} from '@ecoclasifica/shared';
import type { Logger } from 'pino';
import type { FavoritesRepo } from '../repositories/favorites.repo';
import type { ListedScan, ScanRecord, ScansRepo } from '../repositories/scans.repo';
import { AppError } from '../utils/appError';
import type { AuthUser } from './auth.service';

export interface HistoryDeps {
  scans: ScansRepo;
  favorites: FavoritesRepo;
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
  { scans, favorites }: HistoryDeps,
  user: AuthUser,
  scanId: string,
  log: Logger,
): Promise<HistoryDetail> {
  const id = historyIdSchema.safeParse(scanId);
  const row = id.success ? await scans.findById(user.id, id.data) : null;
  if (!row) throw notFound();
  const [[imageUrl = null], saved] = await Promise.all([
    signOrNull(scans, [row], log),
    withFavoriteIds(favorites, user.id, row.saved),
  ]);
  return { ...saved, id: row.id, createdAt: row.createdAt, imageUrl };
}

/** Rutas por llamada al borrar imágenes en Storage. */
export const IMAGE_DELETE_BATCH = 100;

/**
 * Borra primero la fila (con sus cascadas) y luego la imagen. Si la imagen no se puede borrar,
 * el usuario igual ve el escaneo eliminado y queda un `warn` con el id para limpiarla después.
 */
export async function deleteHistoryItem(
  { scans }: HistoryDeps,
  user: AuthUser,
  scanId: string,
  log: Logger,
): Promise<void> {
  const id = historyIdSchema.safeParse(scanId);
  if (!id.success) throw notFound();
  const deleted = await scans.deleteById(user.id, id.data);
  if (!deleted) throw notFound();
  if (!deleted.imagePath) return;
  try {
    await scans.removeImages([deleted.imagePath]);
  } catch {
    log.warn({ scanId: id.data }, 'Imagen de escaneo borrado pendiente de limpiar');
  }
}

/** Borra todas las filas y luego sus imágenes por lotes; un lote fallido no frena a los demás. */
export async function deleteHistory(
  { scans }: HistoryDeps,
  user: AuthUser,
  log: Logger,
): Promise<DeleteHistoryResponse> {
  const deleted = await scans.deleteAll(user.id);
  const withImage = deleted.filter((row) => row.imagePath !== null);
  for (let i = 0; i < withImage.length; i += IMAGE_DELETE_BATCH) {
    const batch = withImage.slice(i, i + IMAGE_DELETE_BATCH);
    try {
      await scans.removeImages(batch.map((row) => row.imagePath as string));
    } catch {
      log.warn(
        { scanIds: batch.map((row) => row.id) },
        'Imágenes de escaneos borrados pendientes de limpiar',
      );
    }
  }
  return { deleted: deleted.length };
}

const notFound = () => new AppError('NOT_FOUND', 'No encontramos ese escaneo en tu historial');

/** Marca cada idea guardada con su `favoriteId` (o `null`) para pintar el corazón (HU-12). */
async function withFavoriteIds(
  favorites: FavoritesRepo,
  userId: string,
  saved: SavedScanResult,
): Promise<SavedScanResult> {
  if (saved.mode !== 'upcycle' || !saved.result.canUpcycle) return saved;
  const ideaIds = saved.result.ideas.flatMap((idea) => (idea.ideaId ? [idea.ideaId] : []));
  const byIdea = await favorites.idsByIdeas(userId, ideaIds);
  const ideas = saved.result.ideas.map((idea) =>
    idea.ideaId ? { ...idea, favoriteId: byIdea.get(idea.ideaId) ?? null } : idea,
  );
  return { ...saved, result: { ...saved.result, ideas } };
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
