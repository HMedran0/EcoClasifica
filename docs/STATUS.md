# Estado del proyecto

_Actualizado: 2026-10-20 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F4 — Cuentas:** en curso. Hechas HU-04, HU-13, HU-12 y **HU-15** (`feat/HU-15-favoritos`, fusionada en `main`). Faltan HU-14 (eliminar, comprobando que los favoritos se conservan) y HU-16.

## HU-15 (ver favoritos + chat persistente)

- `POST /chat` con sesión e `ideaId`: idea desde la base (ajena → 404), contexto = últimos 9 de `chat_messages` + la pregunta nueva; guarda el intercambio; si guardar falla, responde igual (`warn` con código). `GET /chat/:ideaId/messages` (últimos 50). Limitador solo en `POST`.
- `/favoritos` (`RequireAuth`): lista paginada, corazón para quitar, vacío «Aún no guardas ideas.». Favorito con idea → retoma el hilo; huérfano (`ideaId` null) → copia, sin guardar y con aviso. `/ideas` e historial también retoman el hilo con sesión. Enlace «Mis favoritos» en la portada.
- Un solo «Reintentar» en clasificar sin regla con guardado fallido. `usePagedList` compartido por historial y favoritos.
- `favorites.repo` y `chatMessages.repo`: fila corrupta → 500 y errores solo con el código de Postgres.
- Local: `npm run check` OK (backend 264, frontend 256). Sin migraciones nuevas.

## Decisiones

- ADR-29: chat persistente con contexto armado en el servidor.

## Problemas abiertos

1. **Sin probar contra Supabase real:** `scans!inner` + `scans.user_id`, `23505`, `scan-images`, URLs firmadas, historial, favoritos y ahora `chat_messages` (orden por `created_at`) en Android; registro de HU-04 en Android.
2. **Supabase:** las Redirect URLs deben llevar `/**`. En Railway, borrar `SUPABASE_JWT_SECRET` si existe.
3. PKCE: el enlace de verificación abierto en otro navegador no deja la sesión iniciada.
4. Offline en `/camara`, `/resultado`, `/ideas`, `/chat`, `/historial` y `/favoritos`: solo el banner.
5. Solo en desarrollo: StrictMode duplica peticiones al montar `/resultado` o `/ideas`.
6. Prueba intermitente del frontend (foco en `ResultPage`).
7. Rama `fix/arranque-config` pendiente.
8. Vitest backend (v2) vs frontend (v5): con la unidad en minúscula (`c:\…`) fallan los del frontend.
9. Logo oficial y normativa de contenedores de San Juan Nepomuceno sin confirmar.
10. `/chat` acepta `scanId` sin verificar su dueño (solo métricas; el contexto ya usa `ideaId`).
11. «Guardar este escaneo» vuelve a llamar a la IA (otro costo).
12. **Chat:** «Reintentar» tras un aborto puede duplicar la pregunta en el hilo guardado si el servidor ya la había guardado. Solución futura: volver a leer el hilo antes de reenviar.

## Siguiente acción

Prueba de humo en producción: escaneo con sesión → corazón → `/favoritos` → chat (2 mensajes) → volver y reabrir: el hilo se conserva; idea de otro usuario → 404 (punto 1). Luego `/story HU-14` en `feat/HU-14-eliminar`: al borrar un escaneo, sus favoritos quedan con `ideaId` null y su chat se borra en cascada.
