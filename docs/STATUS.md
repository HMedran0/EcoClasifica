# Estado del proyecto

_Actualizado: 2026-10-11 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F0 — Preparar.** Esqueleto del repositorio creado; falta validar la IA con una foto real.

## Hecho

- Documentación de arquitectura y diseño aprobada (stack, API, modelo de datos, historias).
- Repositorio inicial: monorepo `shared` + `backend`, `CLAUDE.md`, comandos y subagentes de Claude Code.
- Backend base: `app.ts`, `server.ts`, env con Zod, errores tipificados, `/api/health`, interfaz `AiProvider`, `DeepSeekProvider` y prompts.
- Migración SQL inicial (`supabase/migrations/0001_init.sql`) y semilla de reglas (`supabase/seed.sql`).

## Decisiones confirmadas

React + Vite · Supabase · backend en Railway · frontend en Vercel · municipio San Juan Nepomuceno · español · registro con correo verificado o Google (escanear sin cuenta no guarda historial).

## Riesgos abiertos

1. **Modelo de IA:** confirmar en la documentación oficial de DeepSeek el nombre exacto del modelo (`deepseek-flash`), que acepte imágenes en Base64 y el formato del mensaje. Si no, cambiar solo el adaptador `DeepSeekProvider`.
2. Código DANE de San Juan Nepomuceno (`13657`) por verificar.
3. Normativa de contenedores del municipio por confirmar antes de fijar la semilla definitiva.

## Siguiente acción (F0)

1. Crear el repositorio en Git y hacer el primer commit (`chore: initial scaffold`).
2. `npm install`, `cp .env.example .env`, completar `DEEPSEEK_API_KEY`.
3. Ejecutar `npm run spike:ai -- ./foto.jpg classify` y `... upcycle` con 3–5 fotos reales.
4. Ajustar `prompts.ts` y el adaptador según el resultado; anotar hallazgos aquí.
5. Criterio de salida F0: una foto produce JSON válido según los esquemas de `shared`.

## Pendiente de crear

- Proyecto Supabase (ejecutar migración y semilla).
- `frontend/` (fase F2; ver `frontend/README.md`) y añadirlo a `workspaces`.
