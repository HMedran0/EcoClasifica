import { healthResponseSchema } from '@ecoclasifica/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

describe('GET /api/health', () => {
  it('responde ok', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('cumple el contrato compartido que valida el frontend', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(healthResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it('devuelve el error tipificado en rutas inexistentes', async () => {
    const res = await request(createApp()).get('/api/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.requestId).toBeTruthy();
  });
});
