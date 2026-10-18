import {
  LOW_CONFIDENCE_THRESHOLD,
  type AiClassifyOutput,
  type ClassifyResponse,
  type ScanRequest,
} from '@ecoclasifica/shared';
import { AppError } from '../utils/appError';
import { assertValidImage } from '../utils/image';
import type { AiProvider, AiUsage } from './ai/ai.provider';

export interface ClassifyOutcome {
  response: ClassifyResponse;
  usage: AiUsage;
  latencyMs: number;
}

/** Valida la imagen, pide la clasificación a la IA y arma la respuesta del contrato. */
export async function classifyScan(ai: AiProvider, req: ScanRequest): Promise<ClassifyOutcome> {
  assertValidImage(req.image, req.mimeType);
  const { data, usage, latencyMs } = await ai.classify({
    base64: req.image,
    mimeType: req.mimeType,
  });
  if (!data.is_waste) {
    throw new AppError('NOT_A_WASTE', 'No encontramos un residuo en la foto, intenta con otra');
  }
  return { response: toClassifyResponse(data), usage, latencyMs };
}

function toClassifyResponse(data: AiClassifyOutput): ClassifyResponse {
  return {
    // scanId/saved: guardado con sesión (HU-04). disposal: tabla disposal_rules (HU-06).
    scanId: null,
    mode: 'classify',
    result: {
      object: data.object,
      material: data.material,
      materialDetail: data.material_detail,
      confidence: data.confidence,
      lowConfidence: data.confidence < LOW_CONFIDENCE_THRESHOLD,
      alternatives: data.alternatives,
    },
    disposal: null,
    saved: false,
  };
}
