# Backend — reglas específicas

- Stack: Express 4, TypeScript, Zod, pino, helmet, cors, express-rate-limit, Supabase JS, Vitest + Supertest.
- Build con `tsup` (empaqueta `@ecoclasifica/shared`); desarrollo con `tsx watch`.
- Alias `@ecoclasifica/shared` → `../shared/src/index.ts` (tsconfig `paths` y `vitest.config.ts`).
- Variables de entorno: solo a través de `src/config/env.ts` (Zod). No uses `process.env` en otros archivos.

## Capas

```text
routes/        define rutas y middlewares; sin lógica
controllers/   traducen HTTP ↔ servicios
services/      lógica de negocio (ai/, classification, scan, storage, usage)
repositories/  único acceso a Supabase
middlewares/   auth, optionalAuth, validate, rateLimit, upload, errorHandler
```

## Reglas

- Los errores se lanzan como `AppError(code, message)`; el `errorHandler` los formatea.
- Todo handler async va envuelto con `asyncHandler` (evita promesas sin capturar).
- Auth: JWT de Supabase en `Authorization: Bearer`. `optionalAuth` en `/scan/*` y `/chat`; `auth` en historial y favoritos.
- Los repositorios reciben `userId` explícito y **siempre** filtran por él (el service role salta RLS).
- Verifica el tipo MIME real de la imagen con los primeros bytes (JPEG, PNG, WebP), no solo el encabezado.
- `trust proxy` = 1 (Railway). Rate limit: 10/min por IP en `/scan/*`; cuota diaria por usuario en `usage.service`.
- Pruebas: inyectar `AiProvider` simulado en `createApp({ aiProvider })`.

## Estado de implementación

Consulta `docs/STATUS.md`. El esqueleto incluye: `app.ts`, `server.ts`, `config/env.ts`, errores, health, `AiProvider` + `DeepSeekProvider` + prompts y el script `scripts/spike-deepseek.ts`.
