import { describe, expect, it } from 'vitest';
import { supabaseUrlSchema } from '../src/config/env';

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
