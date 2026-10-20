import type { ScanRequest } from '@ecoclasifica/shared';
import type { Request, Response } from 'express';
import { classifyScan, type ClassifyDeps } from '../services/classification.service';
import { saveScan, type ScanSaveDeps } from '../services/scanSave.service';
import { upcycleScan } from '../services/upcycle.service';

export type ScanDeps = ClassifyDeps & ScanSaveDeps;

export const createScanController = (deps: ScanDeps) => ({
  async classify(req: Request, res: Response) {
    const body = req.body as ScanRequest;
    const { response, usage, latencyMs } = await classifyScan(deps, body, req.log);
    // Solo métricas: nunca la imagen ni el Base64.
    req.log.info({ mode: 'classify', ...usage, latencyMs }, 'Escaneo completado');
    // Sin sesión no se guarda nada (`saved: false`); NOT_A_WASTE y los errores ya salieron arriba.
    res.json(req.user ? await saveScan(deps, req.user, body, response, req.log) : response);
  },

  async upcycle(req: Request, res: Response) {
    const body = req.body as ScanRequest;
    const { response, usage, latencyMs } = await upcycleScan(deps, body, req.log);
    req.log.info(
      { mode: 'upcycle', canUpcycle: response.result.canUpcycle, ...usage, latencyMs },
      'Escaneo completado',
    );
    res.json(req.user ? await saveScan(deps, req.user, body, response, req.log) : response);
  },
});
