# Estado del proyecto

_Actualizado: 2026-10-18 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F1 — Backend: en curso.** HU-05 y HU-06 hechas. Falta HU-07 (baja certeza y alternativas).

## Hecho en HU-06 (rama `feat/HU-06-contenedor`, 2 commits sin merge)

- `disposal` sale de `disposal_rules` (repo `repositories/disposalRules.repo.ts`, cliente perezoso `repositories/supabase.ts`).
- Resolución: `(material, municipio)` → `DEFAULT` → regla `BLACK` de `DEFAULT`. Municipio = `municipalityCode` o `DEFAULT_MUNICIPALITY_CODE` (13657).
- `binName` tal cual de la tabla (ADR-7). Certeza < 0,60 → `null`, salvo `requiresDropOff` (electrónico, peligroso).
- Caché por instancia de `createApp` (ADR-15); `disposalRepo` inyectable en `AppDeps`.
- `fix(shared)`: `image` ≤ 5 592 408 car. Base64 y `locale` ≤ 35 → `VALIDATION_ERROR`; `api.md` actualizado.
- 45 pruebas en verde. Prueba real `frasco.jpeg` (PORT=3001, Supabase real): vidrio 0,95 → contenedor blanco.
- Dos pasadas de `code-reviewer`: sin bloqueantes; aplicadas las sugerencias (log solo `err.message`, reintento al minuto, error si falta `BLACK`).

## Decisiones

- ADR-15 (nuevo): caché de reglas y excepción de punto limpio con certeza baja.
- «Llevar a punto limpio» lo muestra el frontend si `requiresDropOff` (F2, pantalla de resultado); `binName` queda como está.
- ADR-14: proveedor IA perezoso y rate limiter por instancia. ADR-13: `thinking` off, `max_tokens` 384.
- HU-04: validar el token con `supabase.auth.getUser(token)`. Desarrollo local en `PORT=3001`.

## Problemas abiertos

1. Normativa de contenedores de San Juan Nepomuceno sin confirmar (las filas `13657` copian `DEFAULT`).
2. Una fila de `disposal_rules` con material o `bin_code` fuera del catálogo invalida toda la carga (Zod estricto). Valorar descartar solo esa fila.
3. Upcycle no rechaza no-residuos (pared de ladrillos → ideas). Resolver en HU-09.
4. `optionalAuth` en `/scan/*` llega con HU-04. Progreso y cancelar de HU-05 → frontend (F2).

## Siguiente acción

Merge de `feat/HU-06-contenedor` a `main` → `/clear` → `/story HU-07` (rama `feat/HU-07-baja-certeza`):
con certeza < 0,60 devolver «No estoy seguro», las 2 mejores hipótesis y opción de repetir la foto.

## Pendiente de crear

- `frontend/` (fase F2; ver `frontend/README.md`) y añadirlo a `workspaces`.
