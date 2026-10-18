# Estado del proyecto

_Actualizado: 2026-10-18 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F0 — Preparar: criterio de salida cumplido** (rama `chore/F0-spike-ia`). Falta crear Supabase.

## Hecho en F0

- Modelo verificado en la doc oficial: `deepseek-flash` acepta imágenes Base64 (`image_url` + data URI), solo en mensajes `user`.
- Spike real: 12/12 llamadas (3 fotos × classify/upcycle × `detail` low/auto) con JSON válido según `shared`.
  Classify ≈ 400 tokens de entrada / 90 de salida, ~1,6 s. Upcycle ≈ 380 / 230, ~2,5 s. `response_format` funciona con imágenes.
- `DEEPSEEK_IMAGE_DETAIL` opcional (low|auto; vacía → no se envía). El spike acepta un 3.er argumento y rutas desde la raíz.
- Variables de entorno vacías (`KEY=`) cuentan como no definidas.

## Decisiones de hoy

- ADR-13: `thinking: { type: 'disabled' }` en todas las llamadas. Con el razonamiento activo (por defecto) se truncaba upcycle (5/6 fallos con 384).
- `max_tokens` 384 se mantiene: sobra margen sin razonamiento (salida máx. observada 239).
- `DEEPSEEK_IMAGE_DETAIL` queda sin definir: low y auto dieron lo mismo a 768 px.

## Problemas abiertos

1. **Upcycle no rechaza no-residuos:** con una pared de ladrillos devolvió ideas. Resolver en HU-09 (validar `is_waste` antes o en el prompt).
2. **HU-06 requiere Supabase creado** (`0001_init.sql` y `seed.sql` ejecutados); hoy `SUPABASE_URL` está vacía.
3. HU-04: validar el token con `supabase.auth.getUser(token)`, no con `SUPABASE_JWT_SECRET`.
4. Código DANE `13657` y normativa de contenedores del municipio por confirmar.
5. Desarrollo local en `PORT=3001` (el 3000 lo usa otra app del equipo).

## Siguiente acción

1. `/clear` → `/status` → `/story HU-05` (rama `feat/HU-05-clasificar`).
2. Antes de HU-06: crear Supabase, ejecutar `0001_init.sql` y `seed.sql`, completar `.env`.

## Pendiente de crear

- `frontend/` (fase F2; ver `frontend/README.md`) y añadirlo a `workspaces`.
