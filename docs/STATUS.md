# Estado del proyecto

_Actualizado: 2026-10-18 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F0 — Preparar: cerrada.** Siguiente fase: F1 (backend), empezando por HU-05.

## Hecho en F0

- Modelo verificado en la doc oficial: `deepseek-flash` acepta imágenes Base64 (`image_url` + data URI), solo en mensajes `user`.
- Spike real: 12/12 llamadas (3 fotos × classify/upcycle × `detail` low/auto) con JSON válido según `shared`.
  Classify ≈ 400 tokens de entrada / 90 de salida, ~1,6 s. Upcycle ≈ 380 / 230, ~2,5 s. `response_format` funciona con imágenes.
- Supabase creado y verificado: `0001_init.sql` y `seed.sql` ejecutados; `disposal_rules` DEFAULT=12 y 13657=12.
  `SUPABASE_SERVICE_ROLE_KEY` usa la clave nueva `sb_secret_`.
- `env.ts`: variables vacías (`KEY=`) cuentan como no definidas; `SUPABASE_URL` con ruta (p. ej. `/rest/v1/`) se rechaza.

## Decisiones

- ADR-13: `thinking: { type: 'disabled' }` en escaneos y chat. Con el razonamiento activo se truncaba upcycle (5/6 fallos con 384).
- `max_tokens` 384 se mantiene (salida máx. observada 239).
- `DEEPSEEK_IMAGE_DETAIL` queda sin definir: low y auto dieron lo mismo a 768 px.
- HU-04: validar el token con `supabase.auth.getUser(token)`; `SUPABASE_JWT_SECRET` no se usa (queda vacía).
- Desarrollo local en `PORT=3001` (el 3000 lo usa otra app del equipo).

## Problemas abiertos

1. **Upcycle no rechaza no-residuos:** con una pared de ladrillos devolvió ideas. Resolver en HU-09.
2. Código DANE `13657` y normativa de contenedores del municipio por confirmar.

## Siguiente acción

`/clear` → `/status` → `/story HU-05` (rama `feat/HU-05-clasificar`).

## Pendiente de crear

- `frontend/` (fase F2; ver `frontend/README.md`) y añadirlo a `workspaces`.
