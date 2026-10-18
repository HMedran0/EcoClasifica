# Estado del proyecto

_Actualizado: 2026-10-18 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F1 — Backend: en curso.** HU-05 hecha (rama `feat/HU-05-clasificar`). Faltan HU-06 y HU-07.

## Hecho en HU-05

- `POST /api/v1/scan/classify`: valida cuerpo (Zod), Base64, tamaño ≤ 4 MB y MIME real por bytes → `INVALID_IMAGE`.
- `classification.service` mapea la IA al contrato y calcula `lowConfidence` (< 0,60). `is_waste: false` → 422 `NOT_A_WASTE`.
- Por ahora `disposal: null`, `scanId: null`, `saved: false` (contenedor = HU-06; guardado = HU-04).
- Log por escaneo: tokens y latencia (`Escaneo completado`), sin imagen ni Base64 (verificado en el log real).
- Revisión de seguridad: JSON roto → 400 sin loguear el cuerpo; rate limit antes del parser; tope de longitud Base64 antes de decodificar.
- 11 pruebas de integración + 5 unitarias de imagen; incluye 429, 502, 504 y mimeType ≠ bytes. Total 30 en verde.
- Prueba real (`fotos-prueba/frasco.jpeg`, PORT=3001): vidrio, certeza 0,95, 416/90 tokens, 1,6 s.

## Decisiones

- ADR-14: `createApp()` crea el `DeepSeekProvider` de forma perezosa (`lazyAiProvider`) y el rate limiter por instancia (`createScanLimiter`).
- `NOT_A_WASTE` se movió a HU-05; **HU-07 conserva solo baja certeza y alternativas**.
- ADR-13 sigue: `thinking` desactivado; `max_tokens` 384.
- HU-04: validar el token con `supabase.auth.getUser(token)`; `SUPABASE_JWT_SECRET` no se usa.
- Desarrollo local en `PORT=3001`.

## Problemas abiertos

1. Upcycle no rechaza no-residuos (pared de ladrillos → ideas). Resolver en HU-09.
2. Código DANE `13657` y normativa de contenedores del municipio por confirmar (afecta HU-06).
3. Revisión: `image` y `locale` sin `.max()` en `scanRequestSchema` (cambio de contrato → HU-06/07 con `api.md`); `optionalAuth` en `/scan/*` llega con HU-04.
4. Progreso y cancelar (criterio 2 de HU-05) quedan para el frontend (F2); el backend corta a 20 s con `AI_TIMEOUT`.

## Siguiente acción

Commit y merge de `feat/HU-05-clasificar` → `/clear` → `/story HU-06` (rama `feat/HU-06-contenedor`):
leer `disposal_rules` desde Supabase (repositorio nuevo) y rellenar `disposal` cuando la certeza ≥ 0,60.

## Pendiente de crear

- `frontend/` (fase F2; ver `frontend/README.md`) y añadirlo a `workspaces`.
