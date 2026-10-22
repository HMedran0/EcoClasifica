import type { ScanRequest } from '@ecoclasifica/shared';
import type { Request, Response } from 'express';
import { classifyScan, type ClassifyDeps } from '../services/classification.service';
import { consentedUser, type MeDeps } from '../services/me.service';
import type { UsageMeter } from '../services/quota.service';
import { saveScan, type ScanSaveDeps } from '../services/scanSave.service';
import { upcycleScan } from '../services/upcycle.service';

export type ScanDeps = ClassifyDeps & ScanSaveDeps & MeDeps & { meter: UsageMeter };

/**
 * HU-20: la IA pasa por el medidor y `ai_usage` se escribe al final, con el `scanId` si se guardó.
 * Si la petición falla también se registra (la llamada costó igual).
 */
async function metered<T extends { scanId: string | null }>(
  deps: ScanDeps,
  req: Request,
  run: (deps: ScanDeps) => Promise<T>,
): Promise<T> {
  const usage = deps.meter.track(req, deps.ai);
  let response: T;
  try {
    response = await run({ ...deps, ai: usage.ai });
  } catch (err) {
    await usage.flush(null);
    throw err;
  }
  await usage.flush(response.scanId);
  return response;
}

export const createScanController = (deps: ScanDeps) => ({
  async classify(req: Request, res: Response) {
    const body = req.body as ScanRequest;
    const response = await metered(deps, req, async (d) => {
      const { response, usage, latencyMs } = await classifyScan(d, body, req.log);
      // Solo métricas: nunca la imagen ni el Base64.
      req.log.info({ mode: 'classify', ...usage, latencyMs }, 'Escaneo completado');
      // Sin sesión o sin autorización vigente (HU-21) no se guarda nada (`saved: false`);
      // NOT_A_WASTE y los errores ya salieron arriba.
      const owner = await consentedUser(d, req.user);
      return owner ? await saveScan(d, owner, body, response, req.log) : response;
    });
    res.json(response);
  },

  async upcycle(req: Request, res: Response) {
    const body = req.body as ScanRequest;
    const response = await metered(deps, req, async (d) => {
      const { response, usage, latencyMs } = await upcycleScan(d, body, req.log);
      req.log.info(
        { mode: 'upcycle', canUpcycle: response.result.canUpcycle, ...usage, latencyMs },
        'Escaneo completado',
      );
      const owner = await consentedUser(d, req.user);
      return owner ? await saveScan(d, owner, body, response, req.log) : response;
    });
    res.json(response);
  },
});
