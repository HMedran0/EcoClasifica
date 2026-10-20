# Estado del proyecto

_Actualizado: 2026-10-19 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F4 — Cuentas:** por empezar, con **HU-04** (registro e inicio de sesión: correo verificado o Google). **F3 cerrada** (criterio de salida cumplido el 2026-10-19).

## Cierre de F3 (prueba en Android real, https://eco-clasifica.vercel.app)

- HU-03: interruptor de modo visible; modo «Dar segunda vida».
- HU-09: frasco y botella → 3 ideas; cargador → sin ideas y «Ver dónde depositarlo».
- HU-10/HU-11: tocar una idea abre el chat con la idea cargada; responde en pasos, mantiene el hilo y lo conserva al volver.
- HU-18 (en escritorio; el móvil ya tenía la app instalada): el botón aparece, desaparece al cancelar y no aparece en la app instalada.
- Local: `npm run check` OK (backend 169, frontend 151); build OK con `VITE_API_URL`; `/api/health` 200; `/api/v1/scan/upcycle` y `/api/v1/chat` validan (400). CI de `main` en verde.

## Decisiones

- Sin ADR nuevo. Vigentes recientes: ADR-25 (chat), ADR-24 (modo en memoria y caché por foto).

## Problemas abiertos

1. **Offline en `/camara`, `/resultado`, `/ideas` y `/chat`:** solo el banner; `NETWORK_ERROR` no dice «requiere internet».
2. Sin aviso «Lista para usar sin conexión» (`offlineReady` sin usar).
3. Solo desarrollo: StrictMode lanza dos peticiones al montar `/resultado` o `/ideas`.
4. Prueba intermitente del frontend (foco en `ResultPage`; sospecha `findBy` de 1 s bajo carga).
5. Rama `fix/arranque-config` pendiente (`''` como faltante, log en Railway, `ALLOWED_ORIGINS`, `https:` en `VITE_API_URL`).
6. Alinear Vitest del backend (v2) con el frontend (v5). **Ligado:** si la ruta llega con la unidad en minúscula (`c:\…`, típico de la terminal de VS Code), `npm run check` hace fallar los 18 archivos del frontend («Vitest failed to find the current suite»); con `C:\` pasan. Sospecha: se carga Vitest dos veces (2.1.9 vía `@testing-library/jest-dom` y 5.0.5).
7. Logo oficial pendiente. Normativa de contenedores de San Juan Nepomuceno sin confirmar.
8. Upcycle: menores de HU-09 (no partir emojis al recortar; `parse` final).
9. Chat, menores: `description`/`extraMaterials` solo los protege el prompt; `scanId` sin uso (en F4 filtrar por `req.user.id`); hilo huérfano posible; `toPlainText` no quita viñetas `*` ni enlaces.
10. HU-18: el botón no reacciona a un cambio de `display-mode` sin `appinstalled` (irrelevante en la práctica).

## Siguiente acción

`/story HU-04` en la rama `feat/HU-04-auth`: Supabase Auth (correo con verificación y Google), middleware que fija `req.user.id` y avisos «inicia sesión» en historial y favoritos. Tocará más de 3 archivos → plan de ≤ 10 líneas primero.
