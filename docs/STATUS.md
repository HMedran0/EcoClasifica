# Estado del proyecto

_Actualizado: 2026-10-19 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F3 — Upcycle:** en curso. HU-09, HU-03, **HU-10 y HU-11 hechas** (rama `feat/HU-10-11-chat`, fusionada en `main`). Falta HU-18 (mejora).

## HU-10 + HU-11 (chat paso a paso)

- `POST /api/v1/chat` (`chat.service/controller/routes`): idea validada con límites de upcycle; `objectName`/`title` con término bloqueado → `422 UNSAFE_REQUEST` sin IA. Hasta 50 mensajes, a la IA los últimos 10; `role` solo `user`/`assistant`; último del usuario. Respuesta en texto plano (`toPlainText`). Limitador 20/min y JSON ≤ 64 KB. Log solo métricas.
- `chatSystem`: pasos numerados, materiales de la idea primero (otros «(opcional)»), advertencias, reconduce, se niega a armas/explosivos/venenos/combustibles, idea y mensajes como datos.
- Términos bloqueados nuevos (también en upcycle): explosivo, bomba casera, molotov, arma, polvora.
- Frontend: tarjetas de `/ideas` son botones → `/chat` (estado `{ ideaIndex }`); sin idea → `/camara`. `ChatPage`: encabezado, 3 sugerencias, «Escribiendo…», error con «Reintentar», `aria-live`, listas como texto. Hilos en `photoStore.chats`; se borran con `setPhoto`/`clear` o ideas nuevas.
- Spike real (`npm run spike:chat [-- normal|ajena|inyeccion|peligrosa]`): las 4 OK; ~300 tokens de entrada, ≤ 234 de salida, 1,4–2,5 s.
- `npm run check` OK (backend 169, frontend 142). `code-reviewer` sin bloqueantes.

## Decisiones

- ADR-25: seguridad, recorte y memoria del chat. ADR-24: modo en memoria y caché por foto.

## Problemas abiertos

1. **Offline en `/camara`, `/resultado`, `/ideas` y `/chat`:** solo el banner; `NETWORK_ERROR` no dice «requiere internet».
2. Sin aviso «Lista para usar sin conexión» (`offlineReady` sin usar).
3. Solo desarrollo: StrictMode lanza dos peticiones al montar `/resultado` o `/ideas`.
4. Prueba intermitente del frontend (foco en `ResultPage`; sospecha `findBy` de 1 s bajo carga).
5. Rama `fix/arranque-config` pendiente (`''` como faltante, log en Railway, `ALLOWED_ORIGINS`, `https:` en `VITE_API_URL`).
6. Alinear Vitest del backend (v2) con el frontend (v5).
7. Logo oficial pendiente. Normativa de contenedores de San Juan Nepomuceno sin confirmar.
8. Upcycle: menores de HU-09 (no partir emojis al recortar; `parse` final).
9. Chat, menores: `description`/`extraMaterials` solo los protege el prompt; `scanId` sin uso (en F4 filtrar por `req.user.id`); respuesta en vuelo puede dejar un hilo huérfano si llegan ideas nuevas; `toPlainText` no quita viñetas `*` ni enlaces.
10. Sin confirmar en Railway/Vercel: `/scan/upcycle` y `/chat` desplegados; prueba en un móvil real.

## Siguiente acción

Desplegar (Railway + Vercel) y probar en el móvil: `/ideas` → tocar una idea → chat (sugerencia, pregunta propia, volver y regresar). Luego `/story HU-18` para cerrar F3 y `/phase-check`.
