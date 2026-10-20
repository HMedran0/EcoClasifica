import { randomUUID } from 'node:crypto';
import type {
  ClassifyResponse,
  ScanRequest,
  UpcycleResponse,
  UpcycleResult,
} from '@ecoclasifica/shared';
import type { Logger } from 'pino';
import type { NewScan, NewScanIdea, ScansRepo } from '../repositories/scans.repo';
import type { AuthUser } from './auth.service';

export interface ScanSaveDeps {
  scans: ScansRepo;
}

type ScanResponse = ClassifyResponse | UpcycleResponse;

/**
 * Guarda el escaneo en el historial del usuario con sesión. Si falla, el usuario igual recibe
 * su resultado (`saved: false`) y solo se registra el motivo: nunca la imagen ni datos personales.
 */
export async function saveScan<T extends ScanResponse>(
  { scans }: ScanSaveDeps,
  user: AuthUser,
  req: ScanRequest,
  response: T,
  log: Logger,
): Promise<T> {
  try {
    // Dentro del `try`: nada del guardado puede costarle al usuario un resultado ya obtenido.
    const scan = toNewScan(user.id, req, response);
    await scans.save(scan);
    return withSavedIds(response, scan);
  } catch (err) {
    log.error(
      { mode: response.mode, reason: err instanceof Error ? err.message : 'desconocido' },
      'No se pudo guardar el escaneo en el historial',
    );
    return response;
  }
}

function toNewScan(userId: string, req: ScanRequest, response: ScanResponse): NewScan {
  const base = {
    id: randomUUID(),
    userId,
    image: { bytes: Buffer.from(req.image, 'base64'), mimeType: req.mimeType },
  };
  if (response.mode === 'classify') {
    const { result, disposal } = response;
    return {
      ...base,
      objectName: result.object,
      materialCode: result.material,
      materialDetail: result.materialDetail,
      confidence: result.confidence,
      difficulty: null,
      saved: { mode: 'classify', result, disposal },
      ideas: [],
    };
  }
  const result = withIdeaIds(response.result);
  return {
    ...base,
    objectName: result.objectName,
    materialCode: null,
    materialDetail: null,
    confidence: null,
    difficulty: result.canUpcycle ? result.difficulty : null,
    saved: { mode: 'upcycle', result },
    ideas: result.canUpcycle ? result.ideas.map(toNewIdea) : [],
  };
}

type IdeaWithId = Extract<UpcycleResult, { canUpcycle: true }>['ideas'][number] & {
  ideaId: string;
};

/** Los ids de `scan_ideas` se generan aquí para que la copia guardada ya los lleve. */
function withIdeaIds(result: UpcycleResult) {
  if (!result.canUpcycle) return result;
  const ideas: IdeaWithId[] = result.ideas.map((idea) => ({ ...idea, ideaId: randomUUID() }));
  return { ...result, ideas };
}

function toNewIdea({
  ideaId,
  ideaIndex,
  title,
  description,
  extraMaterials,
}: IdeaWithId): NewScanIdea {
  return { id: ideaId, ideaIndex, title, description, extraMaterials };
}

function withSavedIds<T extends ScanResponse>(response: T, scan: NewScan): T {
  const saved = { ...response, scanId: scan.id, saved: true };
  return scan.saved.mode === 'upcycle' ? { ...saved, result: scan.saved.result } : saved;
}
