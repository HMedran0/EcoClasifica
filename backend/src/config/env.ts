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

  // Sin valor por defecto: en producción su ausencia aborta el arranque (ver productionConfigErrors).
  ALLOWED_ORIGINS: z
    .string()
    .optional()
    .transform((v) =>
      v
        ?.split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  DEFAULT_MUNICIPALITY_CODE: z.string().default('13657'),
});

/** Una variable vacía (`KEY=` copiada de .env.example) cuenta como no definida. */
export function definedVars(vars: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(vars).filter((entry): entry is [string, string] => !!entry[1]),
  );
}

export const env = envSchema.parse(definedVars(process.env));
export type Env = typeof env;

/** Opcionales en desarrollo y pruebas, pero sin ellas producción solo responde 500 al escanear. */
export const PRODUCTION_REQUIRED_VARS = [
  'DEEPSEEK_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

/** Solo para desarrollo y pruebas: en producción ALLOWED_ORIGINS es obligatoria. */
export const DEV_ALLOWED_ORIGINS = ['http://localhost:5173'];

export function allowedOrigins(config: Env): string[] {
  return config.ALLOWED_ORIGINS?.length ? config.ALLOWED_ORIGINS : DEV_ALLOWED_ORIGINS;
}

/** Origen limpio (sin `/` final, ruta ni espacios) y con https, salvo `localhost` (no 127.0.0.1 ni [::1]). */
export function isValidOrigin(origin: string): boolean {
  if (!URL.canParse(origin)) return false;
  const url = new URL(origin);
  if (url.origin !== origin) return false;
  return url.protocol === 'https:' || url.hostname === 'localhost';
}

export interface ProductionConfigErrors {
  missing: string[];
  invalid: string[];
}

/** Nombres (nunca valores) de las variables que faltan o son inválidas; vacío fuera de producción. */
export function productionConfigErrors(config: Env): ProductionConfigErrors {
  if (config.NODE_ENV !== 'production') return { missing: [], invalid: [] };
  const missing: string[] = PRODUCTION_REQUIRED_VARS.filter((key) => !config[key]);
  const invalid: string[] = [];
  const origins = config.ALLOWED_ORIGINS;
  if (!origins?.length) missing.push('ALLOWED_ORIGINS');
  else if (!origins.every(isValidOrigin)) invalid.push('ALLOWED_ORIGINS');
  return { missing, invalid };
}

/** Devuelve el valor de una variable opcional o falla con un mensaje claro al usarla. */
export function requireEnv<K extends keyof Env>(key: K): NonNullable<Env[K]> {
  const value = env[key];
  if (value === undefined || value === null || value === '') {
    throw new Error(`Falta la variable de entorno ${String(key)}`);
  }
  return value as NonNullable<Env[K]>;
}
