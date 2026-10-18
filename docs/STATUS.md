# Estado del proyecto

_Actualizado: 2026-10-18 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F2 — Frontend: base hecha** (rama `chore/F2-base`). Orden: base ✅ → despliegue → HU-02 → HU-17 → HU-01.

## Hecho en chore/F2-base

- `frontend/`: Vite 8, React 19, TS 5.9, Tailwind 4 (tokens `lima`, `hoja`, `bosque`, `petroleo`, `tactil` = 48 px), React Router 8 (`/`, `/resultado`), Zustand 5.
- `src/api/client.ts`: timeout de 25 s (cubre el cuerpo), cancelación, respuesta validada con Zod, `ApiError` con mensaje en español por código.
- Contrato por alias y `paths` (ADR-17); `shared/tsconfig.json` autónomo. Simulación Vercel (solo `frontend/` + `shared/`): pruebas y build con `src/api` en verde.
- Pruebas: frontend 32 (Vitest 5 + Testing Library + jsdom), backend 58. `check` y `build` del monorepo en verde.
- Dockerfile con `frontend/package.json`: `docker build` OK y `/api/health` 200. Node ≥ 22.22 (`engines`, CI).
- `logo.svg` plano, **aprobado como PROVISIONAL** (reciclaje dibujado a mano). Referencia en `docs/brand/`.
- Sin scroll horizontal a 360 y 412 px: `npm run check:layout -w frontend` (Chrome + `dev:web`; no corre en CI).

## Decisiones

- ADR-17: contrato por alias de Vite y `paths`; `zod` 3 directo en el frontend; `shared` sin extender `tsconfig.base.json`.
- Aprobadas: zod 3.25 (no 4), TypeScript 5.9 (no 7), Node ≥ 22.22. Matchers de jest-dom con `expect.extend` (no `/vitest`).
- ADR-16: un solo `INVALID_IMAGE`. Prompt de clasificación: ~24 tokens de entrada más por escaneo.

## Problemas abiertos

1. **Alinear Vitest del backend (v2) con el del frontend (v5)**; después quitar el parche de jest-dom.
2. **HU-01 (logo):** usar el trazado oficial del símbolo universal de reciclaje (dominio público) en vez del dibujado a mano;
   variante maskable al ~80 % con degradado hasta los bordes (corchetes a 226 px del centro, zona segura 205 px);
   variante pequeña sin símbolo para ≤ 48 px.
3. HU-17 sin sección en `docs/historias.md` (escribirla antes de `/story HU-17`). Incluir qué mostrar si `lowConfidence` y `alternatives` vacío.
4. `VITE_API_URL` vacía en producción → llamadas al propio dominio; validarla en la sesión de despliegue.
5. Normativa de contenedores de San Juan Nepomuceno sin confirmar (filas `13657` = `DEFAULT`).
6. Una fila mala de `disposal_rules` invalida toda la carga. Upcycle no rechaza no-residuos (HU-09).
7. `optionalAuth` y guardado en historial llegan con HU-04. Métricas: unificar el log de éxito y el de `NOT_A_WASTE`.

## Siguiente acción

Commit de `chore/F2-base` → merge a `main` → `/clear` → sesión de despliegue (Vercel + `ALLOWED_ORIGINS` en Railway).
