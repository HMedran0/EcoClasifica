# Estado del proyecto

_Actualizado: 2026-10-19 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F3 — Upcycle:** en curso. HU-09 hecha y fusionada. HU-03 **hecha** (rama `feat/HU-03-modo-escaneo`, fusionada en `main`).

## HU-03 (solo frontend)

- Interruptor «Clasificar» | «Dar segunda vida» en `/camara` (radios nativos, grupo «Modo de escaneo», ≥ 48 px), visible con cámara y en la vista previa. `useScanModeStore`: Clasificar al abrir, se conserva en la sesión (sin localStorage).
- `api.upcycle()` → `/api/v1/scan/upcycle`. «Usar foto» va a `/resultado` o `/ideas` según el modo; cada pantalla muestra la etiqueta del modo.
- `/ideas` (`features/upcycle/IdeasPage.tsx`): objeto, dificultad y 3 tarjetas no interactivas («Pronto: guía paso a paso»); con `canUpcycle: false`, motivo y «Ver dónde depositarlo» (misma foto → `/resultado`).
- Común extraído de `ResultPage`: `features/scan/useScan.ts` (petición, abort, reintento, caché) y `ScanScreen.tsx` (foto, modo, carga, error, acciones, foco).
- Caché en memoria por modo e `id` de foto en `photoStore`; «Reintentar» la salta; `setPhoto`/`clear` la borran. No se guardan fotos en el navegador (decisión del usuario).
- `npm run check` OK (backend 128, frontend 122). `code-reviewer` sin bloqueantes; aplicado el menor de reintento.

## Decisiones

- ADR-24: modo en memoria y caché de respuestas por foto. ADR-23: respaldos de upcycle en el backend.

## Problemas abiertos

1. **Offline en `/camara`, `/resultado` e `/ideas`:** solo el banner; el `NETWORK_ERROR` no dice «requiere internet».
2. Sin aviso «Lista para usar sin conexión» (`offlineReady` sin usar).
3. Solo desarrollo: StrictMode lanza dos peticiones al montar `/resultado` o `/ideas`.
4. Prueba intermitente del frontend (sospecha `findBy` de 1 s bajo carga).
5. Rama `fix/arranque-config` pendiente (`''` como faltante, log en Railway, `ALLOWED_ORIGINS`, `https:` en `VITE_API_URL`).
6. Alinear Vitest del backend (v2) con el frontend (v5).
7. Logo: trazado oficial pendiente. Normativa de contenedores de San Juan Nepomuceno sin confirmar.
8. Upcycle: menores del review de HU-09 sin aplicar (no partir emojis al recortar; `parse` final).
9. Sin confirmar: despliegue de `/scan/upcycle` en Railway; contorno de foco del interruptor en un móvil real.

## Siguiente acción

Desplegar (Railway + Vercel) y probar en el móvil: interruptor, `/ideas` con un frasco y con una pila. Luego `/story HU-10` (guía paso a paso de una idea; las tarjetas de `IdeasPage` pasan a ser botones). Orden de F3: HU-10 → HU-11 → HU-18.
