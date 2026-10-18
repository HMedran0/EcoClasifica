import { resolve } from 'node:path';
import { z } from 'zod';

// Carga .env desde backend/ o desde la raíz del repo (no sobrescribe variables ya definidas).
for (const file of ['.env', '../.env']) {
  try {
    process.loadEnvFile(resolve(process.cwd(), file));
  } catch {
    /* el archivo no existe: se usan las variables del entorno */
  }
}

// El cliente de Supabase añade `/rest/v1` por su cuenta: con ruta, PostgREST responde PGRST125.
export const supabaseUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => {
      const url = new URL(value);
      return url.pathname === '/' && !url.search && !url.hash;
    },
    {
      message:
        'SUPABASE_URL debe ser solo https://<proyecto>.supabase.co, sin ruta (como /rest/v1/)',
    },
  );

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().url().default('https://api.deepseek.com'),
  DEEPSEEK_MODEL: z.string().default('deepseek-flash'),
  DEEPSEEK_MAX_TOKENS: z.coerce.number().int().positive().default(384),
  DEEPSEEK_CHAT_MAX_TOKENS: z.coerce.number().int().positive().default(512),
  DEEPSEEK_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  // Opcional: vacía o ausente → no se envía `detail` (el proveedor decide).
  DEEPSEEK_IMAGE_DETAIL: z.enum(['low', 'auto']).optional(),

  SUPABASE_URL: supabaseUrlSchema.optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_JWT_SECRET: z.string().optional(),

  ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  DEFAULT_MUNICIPALITY_CODE: z.string().default('13657'),
});

// Una variable vacía (`KEY=` copiada de .env.example) cuenta como no definida.
const definedVars = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => value !== ''),
);

export const env = envSchema.parse(definedVars);
export type Env = typeof env;

/** Opcionales en desarrollo y pruebas, pero sin ellas producción solo responde 500 al escanear. */
export const PRODUCTION_REQUIRED_VARS = [
  'DEEPSEEK_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

/** Nombres (nunca valores) de las variables obligatorias que faltan; vacío fuera de producción. */
export function missingProductionVars(config: Env): string[] {
  if (config.NODE_ENV !== 'production') return [];
  return PRODUCTION_REQUIRED_VARS.filter((key) => !config[key]);
}

/** Devuelve el valor de una variable opcional o falla con un mensaje claro al usarla. */
export function requireEnv<K extends keyof Env>(key: K): NonNullable<Env[K]> {
  const value = env[key];
  if (value === undefined || value === null || value === '') {
    throw new Error(`Falta la variable de entorno ${String(key)}`);
  }
  return value as NonNullable<Env[K]>;
}
