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
      alternatives: data.alternatives,
    },
    disposal,
    saved: false,
  };
}
