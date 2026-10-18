import {
  LOW_CONFIDENCE_THRESHOLD,
  type AiClassifyOutput,
  type ClassifyResponse,
  type Disposal,
  type ScanRequest,
} from '@ecoclasifica/shared';
import type { Logger } from 'pino';
import { env } from '../config/env';
import { AppError } from '../utils/appError';
import { assertValidImage } from '../utils/image';
import type { AiProvider, AiUsage } from './ai/ai.provider';
import type { DisposalResolver } from './disposal.service';

export interface ClassifyDeps {
  ai: AiProvider;
  disposal: DisposalResolver;
}

export interface ClassifyOutcome {
  response: ClassifyResponse;
  usage: AiUsage;
  latencyMs: number;
}

/** Valida la imagen, pide la clasificación a la IA y arma la respuesta del contrato. */
export async function classifyScan(
  { ai, disposal }: ClassifyDeps,
  req: ScanRequest,
  log: Logger,
): Promise<ClassifyOutcome> {
  assertValidImage(req.image, req.mimeType);
  const { data, usage, latencyMs } = await ai.classify({
    base64: req.image,
    mimeType: req.mimeType,
  });
  if (!data.is_waste) {
    // Se registran las métricas porque la llamada a la IA también cuesta; nunca se guarda en el historial.
    log.info({ mode: 'classify', ...usage, latencyMs, notAWaste: true }, 'Escaneo sin residuo');
    throw new AppError('NOT_A_WASTE', 'No encontramos un residuo en la foto, intenta con otra');
  }
  const lowConfidence = data.confidence < LOW_CONFIDENCE_THRESHOLD;
  const municipalityCode = req.municipalityCode ?? env.DEFAULT_MUNICIPALITY_CODE;
  const rule = await disposal.resolve(data.material, municipalityCode, log);
  return {
    response: toClassifyResponse(data, lowConfidence, pickDisposal(rule, lowConfidence)),
    usage,
    latencyMs,
  };
}

/**
 * Con certeza baja no se afirma un contenedor (el cliente muestra alternativas), salvo
 * que la regla exija punto limpio: ante la duda, pilas o electrónicos nunca van a la casa.
 */
function pickDisposal(rule: Disposal | null, lowConfidence: boolean): Disposal | null {
  if (!rule) return null;
  return !lowConfidence || rule.requiresDropOff ? rule : null;
}

type Alternative = AiClassifyOutput['alternatives'][number];

/** Las 2 mejores hipótesis: sin el material principal, sin repetidos (gana la certeza mayor), ordenadas. */
export function pickAlternatives(data: AiClassifyOutput): Alternative[] {
  const best = new Map<Alternative['material'], number>();
  for (const { material, confidence } of data.alternatives) {
    if (material === data.material) continue;
    best.set(material, Math.max(confidence, best.get(material) ?? 0));
  }
  return [...best]
    .map(([material, confidence]) => ({ material, confidence }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 2);
}

function toClassifyResponse(
  data: AiClassifyOutput,
  lowConfidence: boolean,
  disposal: Disposal | null,
): ClassifyResponse {
  return {
    // scanId/saved: guardado con sesión (HU-04).
    scanId: null,
    mode: 'classify',
    result: {
      object: data.object,
      material: data.material,
      materialDetail: data.material_detail,
      confidence: data.confidence,
      lowConfidence,
      alternatives: pickAlternatives(data),
    },
    disposal,
    saved: false,
  };
}
