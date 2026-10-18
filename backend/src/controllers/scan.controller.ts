import type { ScanRequest } from '@ecoclasifica/shared';
import type { Request, Response } from 'express';
import { classifyScan, type ClassifyDeps } from '../services/classification.service';

export const createScanController = (deps: ClassifyDeps) => ({
  async classify(req: Request, res: Response) {
    const { response, usage, latencyMs } = await classifyScan(
      deps,
      req.body as ScanRequest,
      req.log,
    );
    // Solo métricas: nunca la imagen ni el Base64.
    req.log.info({ mode: 'classify', ...usage, latencyMs }, 'Escaneo completado');
    res.json(response);
  },
});
