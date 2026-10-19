# Estado del proyecto

_Actualizado: 2026-10-19 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F2 — Frontend:** base ✅ · despliegue ✅ · HU-02 ✅ · HU-17 ✅ · fix/clasificacion-casos-reales ✅ · **HU-01 ✅** (PWA). Todas las historias de F2 hechas; falta verificar el criterio de salida.

## Hecho en HU-01 (rama feat/HU-01-pwa)

- `vite-plugin-pwa` (prompt) + manifiesto en `frontend/src/pwa/manifest.ts` (standalone, `es-CO`, theme bosque, fondo `#F7FAF5`).
- Workbox: precache del shell, `navigateFallback` a `index.html` (excepto `/api/`), NetworkOnly para `/api/*`.
- Íconos en `frontend/public/icons/` con `npm run icons -w frontend` (`@vite-pwa/assets-generator`; fuentes en `frontend/pwa-assets/`).
- Sin red: `OfflineBanner` global, «Escanear residuo» con `aria-disabled` y «Escanear requiere internet»; `ServiceStatus` se oculta y, con red pero sin backend, dice «Servicio no disponible».
- `UpdatePrompt`: «Hay una versión nueva» → `updateServiceWorker(true)`.
- RNF-03 actualizado (Lighthouse eliminó la categoría PWA).
- Pruebas: backend 67, frontend 101. `npm run check` OK. Code-reviewer pasado.

## Decisiones

- ADR-22: PWA (NetworkOnly para la API, íconos desde SVG versionados, un solo aviso sin red).
- ADR-21: instrucciones genéricas por material. ADR-20: prioridad del punto limpio.

## Problemas abiertos

1. **Offline en `/camara` y `/resultado`:** solo se ve el banner; nada impide entrar por URL o historial, y el `NETWORK_ERROR` del escaneo no dice «requiere internet».
2. **Sin aviso «Lista para usar sin conexión»** (`offlineReady` de `useRegisterSW` no se usa).
3. Vercel instala `sharp` (vía assets-generator) en el build: vigilar el primer despliegue.
4. Solo desarrollo: StrictMode lanza dos `classify` al montar `/resultado`.
5. Prueba intermitente del frontend (sospecha `findBy` de 1 s bajo carga).
6. Probar en Android real: instalación, modo avión, maskable, TalkBack, EXIF, ≤ 300 KB.
7. Rama `fix/arranque-config` pendiente (`''` como faltante, log en Railway, `ALLOWED_ORIGINS`, `https:` en `VITE_API_URL`).
8. Alinear Vitest del backend (v2) con el frontend (v5).
9. Logo: trazado oficial pendiente (los íconos se regeneran con `npm run icons`).
10. Normativa de contenedores de San Juan Nepomuceno sin confirmar.

## Siguiente acción

Verificar CI y despliegue en https://eco-clasifica.vercel.app. En Chrome Android: instalar, revisar DevTools > Application > Manifest sin errores y abrir en modo avión. Luego `/clear` → `/phase-check` (F2).
