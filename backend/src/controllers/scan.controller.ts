import type { ScanRequest } from '@ecoclasifica/shared';
import type { Request, Response } from 'express';
import type { AiProvider } from '../services/ai/ai.provider';
import { classifyScan } from '../services/classification.service';

export const createScanController = (ai: AiProvider) => ({
  async classify(req: Request, res: Response) {
    const { response, usage, latencyMs } = await classifyScan(ai, req.body as ScanRequest);
    // Solo métricas: nunca la imagen ni el Base64.
    req.log.info({ mode: 'classify', ...usage, latencyMs }, 'Escaneo completado');
    res.json(response);
  },
});
