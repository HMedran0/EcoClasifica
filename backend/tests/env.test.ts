import { describe, expect, it } from 'vitest';
import { envSchema, missingProductionVars, supabaseUrlSchema } from '../src/config/env';

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

describe('missingProductionVars', () => {
  const secrets = {
    DEEPSEEK_API_KEY: 'sk-prueba',
    SUPABASE_URL: 'https://abc.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-prueba',
  };
  const parse = (vars: Record<string, string>) => envSchema.parse(vars);

  it('no exige nada fuera de producción', () => {
    expect(missingProductionVars(parse({ NODE_ENV: 'development' }))).toEqual([]);
    expect(missingProductionVars(parse({ NODE_ENV: 'test' }))).toEqual([]);
  });

  it('en producción devuelve los nombres que faltan', () => {
    expect(missingProductionVars(parse({ NODE_ENV: 'production' }))).toEqual([
      'DEEPSEEK_API_KEY',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
    ]);
    const withoutUrl = Object.fromEntries(
      Object.entries(secrets).filter(([key]) => key !== 'SUPABASE_URL'),
    );
    expect(missingProductionVars(parse({ NODE_ENV: 'production', ...withoutUrl }))).toEqual([
      'SUPABASE_URL',
    ]);
  });

  it('nunca incluye valores, solo nombres', () => {
    const missing = missingProductionVars(
      parse({ NODE_ENV: 'production', DEEPSEEK_API_KEY: 'sk-secreta' }),
    );
    expect(missing.join(' ')).not.toContain('sk-secreta');
  });

  it('en producción con las tres variables no falta ninguna', () => {
    expect(missingProductionVars(parse({ NODE_ENV: 'production', ...secrets }))).toEqual([]);
  });
});
