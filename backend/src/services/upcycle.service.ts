import {
  UPCYCLE_DESCRIPTION_MAX,
  UPCYCLE_EXTRA_MATERIALS_MAX,
  UPCYCLE_IDEAS_COUNT,
  UPCYCLE_REASON_MAX,
  UPCYCLE_TITLE_MAX,
  type AiUpcycleOutput,
  type Idea,
  type ScanRequest,
  type UpcycleResponse,
  type UpcycleResult,
} from '@ecoclasifica/shared';
import type { Logger } from 'pino';
import { AppError } from '../utils/appError';
import { assertValidImage } from '../utils/image';
import { truncateWords } from '../utils/text';
import type { AiProvider, AiUsage } from './ai/ai.provider';
import { findSafetyBlock } from './upcycle.safety';

export interface UpcycleDeps {
  ai: AiProvider;
}

export interface UpcycleOutcome {
  response: UpcycleResponse;
  usage: AiUsage;
  latencyMs: number;
}

const DEFAULT_REASON =
  'Este residuo no es seguro para manualidades. Clasifícalo para desecharlo bien.';

/** Valida la imagen, pide ideas de segunda vida a la IA y las ajusta al contrato. */
export async function upcycleScan(
  { ai }: UpcycleDeps,
  req: ScanRequest,
  log: Logger,
): Promise<UpcycleOutcome> {
  assertValidImage(req.image, req.mimeType);
  const { data, usage, latencyMs } = await ai.upcycle({
    base64: req.image,
    mimeType: req.mimeType,
  });
  // Va antes que can_upcycle: sin residuo no hay ideas aunque la IA las proponga.
  if (!data.is_waste) {
    log.info({ mode: 'upcycle', ...usage, latencyMs, notAWaste: true }, 'Escaneo sin residuo');
    throw new AppError('NOT_A_WASTE', 'No encontramos un residuo en la foto, intenta con otra');
  }
  return {
    // scanId/saved: guardado con sesión (HU-04).
    response: { scanId: null, mode: 'upcycle', result: toResult(data, log), saved: false },
    usage,
    latencyMs,
  };
}

type Upcyclable = Extract<AiUpcycleOutput, { can_upcycle: true }>;
type NotUpcyclable = Extract<AiUpcycleOutput, { can_upcycle: false }>;

function toResult(data: Upcyclable | NotUpcyclable, log: Logger): UpcycleResult {
  if (!data.can_upcycle) {
    return {
      canUpcycle: false,
      objectName: data.object_name,
      reason: truncateWords(data.reason || DEFAULT_REASON, UPCYCLE_REASON_MAX),
    };
  }
  const block = findSafetyBlock(data.object_name, data.material);
  if (block) {
    log.warn(
      { objectName: data.object_name, material: data.material, rule: block.rule },
      'Upcycle bloqueado por respaldo de seguridad',
    );
    return { canUpcycle: false, objectName: data.object_name, reason: block.reason };
  }
  return {
    canUpcycle: true,
    objectName: data.object_name,
    difficulty: data.difficulty,
    ideas: data.ideas.slice(0, UPCYCLE_IDEAS_COUNT).map(toIdea),
  };
}

function toIdea(idea: Upcyclable['ideas'][number], ideaIndex: number): Idea {
  return {
    ideaIndex,
    title: truncateWords(idea.title, UPCYCLE_TITLE_MAX),
    description: truncateWords(idea.description, UPCYCLE_DESCRIPTION_MAX),
    extraMaterials: idea.extra_materials.slice(0, UPCYCLE_EXTRA_MATERIALS_MAX),
  };
}
