import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import {
  RULES_CACHE_TTL_MS,
  RULES_RETRY_MS,
  createDisposalResolver,
} from '../src/services/disposal.service';
import { fakeDisposalRepo, seedRules } from './helpers/disposalRules';

const silentLog = () => {
  const log = pino({ level: 'silent' });
  return Object.assign(log, { warn: vi.fn(), error: vi.fn() });
};

describe('createDisposalResolver', () => {
  it('usa la regla del municipio antes que la DEFAULT', async () => {
    const local = { ...seedRules[1]!, municipalityCode: '13657', instructions: 'Regla local' };
    const resolver = createDisposalResolver(fakeDisposalRepo([...seedRules, local]));
    const disposal = await resolver.resolve('vidrio', '13657', silentLog());
    expect(disposal?.instructions).toBe('Regla local');
  });

  it('cae en la regla DEFAULT si el municipio no tiene regla propia', async () => {
    const resolver = createDisposalResolver(fakeDisposalRepo());
    const disposal = await resolver.resolve('vidrio', '13657', silentLog());
    expect(disposal).toMatchObject({
      binCode: 'WHITE',
      binName: 'Contenedor blanco (aprovechables)',
    });
  });

  it('usa el contenedor negro y advierte si el material no tiene regla', async () => {
    const log = silentLog();
    const resolver = createDisposalResolver(fakeDisposalRepo());
    const disposal = await resolver.resolve('madera', '13657', log);
    expect(disposal?.binCode).toBe('BLACK');
    expect(log.warn).toHaveBeenCalledOnce();
  });

  it('devuelve punto limpio con el nombre de la tabla para electrónicos', async () => {
    const resolver = createDisposalResolver(fakeDisposalRepo());
    const disposal = await resolver.resolve('electronico', '13657', silentLog());
    expect(disposal).toMatchObject({
      binCode: 'DROP_OFF',
      binName: 'Punto limpio',
      requiresDropOff: true,
    });
  });

  it('no consulta el repositorio en la segunda llamada (caché)', async () => {
    const repo = fakeDisposalRepo();
    const resolver = createDisposalResolver(repo);
    await resolver.resolve('vidrio', '13657', silentLog());
    await resolver.resolve('plastico', '13657', silentLog());
    expect(repo.listAll).toHaveBeenCalledOnce();
  });

  it('recarga las reglas cuando vence el TTL de 10 minutos', async () => {
    let time = 0;
    const repo = fakeDisposalRepo();
    const resolver = createDisposalResolver(repo, { now: () => time });
    await resolver.resolve('vidrio', '13657', silentLog());
    time = RULES_CACHE_TTL_MS + 1;
    await resolver.resolve('vidrio', '13657', silentLog());
    expect(repo.listAll).toHaveBeenCalledTimes(2);
  });

  it('usa la caché vencida si Supabase falla al recargar', async () => {
    let time = 0;
    const log = silentLog();
    const repo = fakeDisposalRepo();
    const resolver = createDisposalResolver(repo, { now: () => time });
    await resolver.resolve('vidrio', '13657', log);
    repo.listAll.mockRejectedValueOnce(new Error('Supabase caído'));
    time = RULES_CACHE_TTL_MS + 1;
    const disposal = await resolver.resolve('vidrio', '13657', log);
    expect(disposal?.binCode).toBe('WHITE');
    expect(log.warn).toHaveBeenCalledOnce();
  });

  it('no reintenta Supabase en cada petición mientras está caído', async () => {
    let time = 0;
    const repo = fakeDisposalRepo();
    const resolver = createDisposalResolver(repo, { now: () => time });
    await resolver.resolve('vidrio', '13657', silentLog());
    repo.listAll.mockRejectedValue(new Error('Supabase caído'));
    time = RULES_CACHE_TTL_MS + 1;
    await resolver.resolve('vidrio', '13657', silentLog());
    await resolver.resolve('vidrio', '13657', silentLog());
    expect(repo.listAll).toHaveBeenCalledTimes(2);
    time += RULES_RETRY_MS;
    await resolver.resolve('vidrio', '13657', silentLog());
    expect(repo.listAll).toHaveBeenCalledTimes(3);
  });

  it('devuelve null y registra el error si Supabase falla sin caché', async () => {
    const log = silentLog();
    const repo = fakeDisposalRepo();
    repo.listAll.mockRejectedValueOnce(new Error('Supabase caído'));
    const resolver = createDisposalResolver(repo);
    await expect(resolver.resolve('vidrio', '13657', log)).resolves.toBeNull();
    expect(log.error).toHaveBeenCalledOnce();
  });
});
