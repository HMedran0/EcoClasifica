# Estado del proyecto

_Actualizado: 2026-10-19 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F3 — Upcycle:** historias completas (HU-09, HU-03, HU-10, HU-11 y **HU-18 hecha**, rama `feat/HU-18-instalar-app` fusionada en `main`). Falta verificar el criterio de salida con `/phase-check`.

## HU-18 (botón «Instalar app»)

- `pwa/installPrompt.ts`: `listenForInstallPrompt()` se llama en `main.tsx` antes de renderizar (Chrome puede emitir `beforeinstallprompt` antes de montar la portada); `preventDefault` + guarda el evento; `appinstalled` lo descarta. `useCanInstall()` con `useSyncExternalStore`; oculto en `display-mode: standalone` o sin soporte (iOS).
- `promptInstall()` descarta el evento al tocar (evita doble `prompt()`); acepte o cancele, no se vuelve a ofrecer en la sesión aunque llegue otro evento.
- `pwa/InstallButton.tsx`: secundario (borde `petroleo`, sin lima, `min-h-tactil`), debajo de «Escanear residuo» en `HomePage`.
- Sección HU-18 añadida a `docs/historias.md`. Pruebas: sin soporte, evento temprano, aceptar, cancelar sin reofrecer, `appinstalled`, standalone, estilo, orden en portada.
- `npm run check` OK (backend 169, frontend 151). `code-reviewer` sin bloqueantes.

## Decisiones

- Sin ADR nuevo. Vigentes recientes: ADR-25 (chat), ADR-24 (modo en memoria y caché por foto).

## Problemas abiertos

1. **Offline en `/camara`, `/resultado`, `/ideas` y `/chat`:** solo el banner; `NETWORK_ERROR` no dice «requiere internet».
2. Sin aviso «Lista para usar sin conexión» (`offlineReady` sin usar).
3. Solo desarrollo: StrictMode lanza dos peticiones al montar `/resultado` o `/ideas`.
4. Prueba intermitente del frontend (foco en `ResultPage`; sospecha `findBy` de 1 s bajo carga).
5. Rama `fix/arranque-config` pendiente (`''` como faltante, log en Railway, `ALLOWED_ORIGINS`, `https:` en `VITE_API_URL`).
6. Alinear Vitest del backend (v2) con el frontend (v5).
7. Logo oficial pendiente. Normativa de contenedores de San Juan Nepomuceno sin confirmar.
8. Upcycle: menores de HU-09 (no partir emojis al recortar; `parse` final).
9. Chat, menores: `description`/`extraMaterials` solo los protege el prompt; `scanId` sin uso (en F4 filtrar por `req.user.id`); hilo huérfano posible; `toPlainText` no quita viñetas `*` ni enlaces.
10. HU-18: el botón no reacciona a un cambio de `display-mode` sin `appinstalled` (irrelevante en la práctica).
11. Sin confirmar en Railway/Vercel: `/scan/upcycle`, `/chat` y el botón «Instalar app» en un móvil Android real.

## Siguiente acción

Desplegar (Railway + Vercel) y probar en un Android real: botón «Instalar app» (aparece, instala, desaparece), `/ideas` → idea → chat. Luego `/phase-check` para cerrar F3.
