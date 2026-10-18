import type { HealthResponse } from '@ecoclasifica/shared';
import { Router } from 'express';

export const healthRoutes = Router();

healthRoutes.get('/health', (_req, res) => {
  const body: HealthResponse = {
    status: 'ok',
    service: 'ecoclasifica-api',
    time: new Date().toISOString(),
  };
  res.json(body);
});
