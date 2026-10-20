# Estado del proyecto

_Actualizado: 2026-10-19 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F3 — Upcycle:** por empezar. **F2 cerrada** (criterio de salida cumplido el 2026-10-19).

## Cierre de F2 (prueba en Android real, Chrome, https://eco-clasifica.vercel.app)

- Instalación PWA: ícono maskable correcto, standalone con barra verde; Chrome de escritorio ofrece «Instalar EcoClasifica».
- Flujo A con 7 objetos: plástico → blanco, ahuyama → verde, cargador y cable → punto limpio, persona → «No parece un residuo», bolsa con pañal → baja certeza. 2–3 s por respuesta; foto vertical sin girar.
- Modo avión: banner y «Escanear residuo» deshabilitado; al volver la red, «Servicio disponible».
- TalkBack: recorrido completo sin problemas. CI de `main` en verde.
- Local: `npm run check` OK (backend 67, frontend 101); build OK con `VITE_API_URL`; `/api/health` en Railway 200; CORS desde Vercel 204.

## Decisiones

- ADR-22: PWA (NetworkOnly para la API, íconos desde SVG versionados, un solo aviso sin red).
- ADR-21: instrucciones genéricas por material. ADR-20: prioridad del punto limpio.

## Problemas abiertos

1. **Offline en `/camara` y `/resultado`:** solo se ve el banner; nada impide entrar por URL o historial, y el `NETWORK_ERROR` del escaneo no dice «requiere internet».
2. **Sin aviso «Lista para usar sin conexión»** (`offlineReady` de `useRegisterSW` no se usa).
3. Solo desarrollo: StrictMode lanza dos `classify` al montar `/resultado`.
4. Prueba intermitente del frontend (sospecha `findBy` de 1 s bajo carga).
5. Rama `fix/arranque-config` pendiente (`''` como faltante, log en Railway, `ALLOWED_ORIGINS`, `https:` en `VITE_API_URL`).
6. Alinear Vitest del backend (v2) con el frontend (v5).
7. Logo: trazado oficial pendiente (los íconos se regeneran con `npm run icons`).
8. Normativa de contenedores de San Juan Nepomuceno sin confirmar.

## Siguiente acción

Empezar F3 con `/story HU-09` (rama `feat/HU-09-upcycle`): esquema Zod de `POST /scan/upcycle` en `shared`, prompt y servicio con `AiProvider` simulado en pruebas. Orden de F3 en `docs/BACKLOG.md`: HU-09 → HU-03 → HU-10 → HU-11 → HU-18 (botón «Instalar app» con `beforeinstallprompt`, solo si no está instalada).
