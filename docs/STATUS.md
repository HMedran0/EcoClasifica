# Estado del proyecto

_Actualizado: 2026-10-18 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F2 — Frontend: base ✅ y despliegue ✅** (rama `chore/F2-despliegue`). Orden: base → despliegue → **HU-02** → HU-17 → HU-01.

## Hecho en chore/F2-despliegue

- Producción: backend https://ecoclasificabackend-production.up.railway.app · frontend https://eco-clasifica.vercel.app. Ambos despliegan `main` (Railway espera al CI).
- Humo en producción OK: `/api/health` 200; preflight CORS permite Vercel y rechaza otros orígenes; `frasco.jpeg` → vidrio 0,95 → contenedor blanco.
- `healthResponseSchema` en `shared`; `api.health()` (GET simple, sin preflight) y `ServiceStatus` en la pantalla inicial («Servicio disponible» / «Sin conexión»).
- Build de producción del frontend falla sin `VITE_API_URL`; CI la define. `server.ts` sale con código 1 si faltan secretos en producción.
- `docs/despliegue.md`: orden, variables, humo y fallos típicos (enlazado desde README e INDEX).
- Pruebas: backend 63, frontend 40. `check`, build raíz, `docker build` y contenedor verificados en local.

## Decisiones

- ADR-18: configuración que falla pronto (`VITE_API_URL` al compilar, secretos al arrancar).
- ADR-17: contrato por alias de Vite y `paths`. Aprobadas: zod 3.25, TypeScript 5.9, Node ≥ 22.22.

## Problemas abiertos

1. **Rama aparte `fix/arranque-config`:** (a) `missingProductionVars` debe tratar `''` como faltante (en teoría ya lo hace por `definedVars`; añadir prueba explícita con `KEY=`); (b) «Error no controlado» no aparece al filtrar `@level:error` en Railway: revisar nivel/etiqueta del log en `errorHandler`; (c) exigir `ALLOWED_ORIGINS` en producción o rechazar el valor por defecto `localhost` (code-reviewer); (d) en Vercel (`process.env.VERCEL`) exigir `https:` en `VITE_API_URL` y validar cualquier `--mode` de build.
2. Alinear Vitest del backend (v2) con el del frontend (v5); después quitar el parche de jest-dom.
3. HU-01 (logo): trazado oficial del símbolo de reciclaje; variante maskable (~80 %, zona segura 205 px); variante pequeña sin símbolo ≤ 48 px.
4. HU-17 sin sección en `docs/historias.md` (escribirla antes de `/story HU-17`); incluir `lowConfidence` con `alternatives` vacío.
5. Normativa de contenedores de San Juan Nepomuceno sin confirmar (filas `13657` = `DEFAULT`).
6. Una fila mala de `disposal_rules` invalida toda la carga. Upcycle no rechaza no-residuos (HU-09).
7. `optionalAuth` y guardado en historial llegan con HU-04. Métricas: unificar el log de éxito y el de `NOT_A_WASTE`.

## Siguiente acción

Tras el merge y el push: confirmar que el CI pasa y que Railway y Vercel despliegan `main` (punto verde en https://eco-clasifica.vercel.app) → `/clear` → `fix/arranque-config` o `/story HU-02`.
