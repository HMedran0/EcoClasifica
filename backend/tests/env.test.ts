import { describe, expect, it } from 'vitest';
import {
  allowedOrigins,
  definedVars,
  envSchema,
  isValidOrigin,
  productionConfigErrors,
  supabaseUrlSchema,
} from '../src/config/env';

describe('supabaseUrlSchema', () => {
  it.each(['https://abc.supabase.co', 'https://abc.supabase.co/'])('acepta %s', (url) => {
    expect(supabaseUrlSchema.safeParse(url).success).toBe(true);
  });

  it.each([
    'https://abc.supabase.co/rest/v1/',
    'https://abc.supabase.co/rest/v1',
    'https://abc.supabase.co/?x=1',
  ])('rechaza %s con un mensaje claro', (url) => {
    const result = supabaseUrlSchema.safeParse(url);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/sin ruta/);
  });
});

describe('definedVars', () => {
  it('una variable vacía (KEY=) cuenta como faltante', () => {
    const vars = definedVars({ NODE_ENV: 'production', DEEPSEEK_API_KEY: '', ALLOWED_ORIGINS: '' });
    expect(vars).toEqual({ NODE_ENV: 'production' });
    expect(productionConfigErrors(envSchema.parse(vars)).missing).toEqual(
      expect.arrayContaining(['DEEPSEEK_API_KEY', 'ALLOWED_ORIGINS']),
    );
  });
});

describe('productionConfigErrors', () => {
  const complete = {
    DEEPSEEK_API_KEY: 'sk-prueba',
    SUPABASE_URL: 'https://abc.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-prueba',
    ALLOWED_ORIGINS: 'https://eco-clasifica.vercel.app',
  };
  const parse = (vars: Record<string, string>) => envSchema.parse(vars);
  const production = (vars: Record<string, string>) =>
    productionConfigErrors(parse({ NODE_ENV: 'production', ...complete, ...vars }));

  it('no exige nada fuera de producción', () => {
    const none = { missing: [], invalid: [] };
    expect(productionConfigErrors(parse({ NODE_ENV: 'development' }))).toEqual(none);
    expect(productionConfigErrors(parse({ NODE_ENV: 'test' }))).toEqual(none);
  });

  it('en producción devuelve los nombres que faltan', () => {
    expect(productionConfigErrors(parse({ NODE_ENV: 'production' })).missing).toEqual([
      'DEEPSEEK_API_KEY',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'ALLOWED_ORIGINS',
    ]);
    const withoutUrl = Object.fromEntries(
      Object.entries(complete).filter(([key]) => key !== 'SUPABASE_URL'),
    );
    expect(productionConfigErrors(parse({ NODE_ENV: 'production', ...withoutUrl }))).toEqual({
      missing: ['SUPABASE_URL'],
      invalid: [],
    });
  });

  it('ALLOWED_ORIGINS solo con comas cuenta como faltante', () => {
    expect(production({ ALLOWED_ORIGINS: ' , ' }).missing).toEqual(['ALLOWED_ORIGINS']);
  });

  it('con todo definido y orígenes válidos no hay errores', () => {
    expect(production({})).toEqual({ missing: [], invalid: [] });
    expect(
      production({ ALLOWED_ORIGINS: 'https://eco-clasifica.vercel.app, http://localhost:5173' }),
    ).toEqual({ missing: [], invalid: [] });
  });

  it.each([
    ['barra final', 'https://eco-clasifica.vercel.app/'],
    ['ruta', 'https://eco-clasifica.vercel.app/app'],
    ['http', 'http://eco-clasifica.vercel.app'],
    ['no es URL', 'eco-clasifica.vercel.app'],
    ['uno inválido entre válidos', 'https://eco-clasifica.vercel.app,http://otro.com'],
  ])('rechaza ALLOWED_ORIGINS con %s', (_case, origins) => {
    expect(production({ ALLOWED_ORIGINS: origins })).toEqual({
      missing: [],
      invalid: ['ALLOWED_ORIGINS'],
    });
  });

  it('nunca incluye valores, solo nombres', () => {
    const errors = production({ DEEPSEEK_API_KEY: '', ALLOWED_ORIGINS: 'http://secreto.com' });
    expect(JSON.stringify(errors)).not.toContain('secreto');
    expect(JSON.stringify(errors)).not.toContain('sk-prueba');
  });
});

describe('isValidOrigin', () => {
  it.each(['https://eco-clasifica.vercel.app', 'http://localhost:5173', 'https://a.b:8443'])(
    'acepta %s',
    (origin) => expect(isValidOrigin(origin)).toBe(true),
  );

  it.each([' https://a.com', 'https://a.com/', 'https://a.com?x=1', 'http://127.0.0.1:5173'])(
    'rechaza %j',
    (origin) => expect(isValidOrigin(origin)).toBe(false),
  );
});

describe('allowedOrigins', () => {
  it('fuera de producción usa localhost:5173 si falta o queda vacía', () => {
    for (const vars of [{}, { ALLOWED_ORIGINS: ' , ' }]) {
      expect(allowedOrigins(envSchema.parse({ NODE_ENV: 'development', ...vars }))).toEqual([
        'http://localhost:5173',
      ]);
    }
  });
});
