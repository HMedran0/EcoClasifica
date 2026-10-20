# Estado del proyecto

_Actualizado: 2026-10-20 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F4 — Cuentas:** en curso. Hechas HU-04, HU-13 y **HU-12** (`feat/HU-12-favoritos`, fusionada en `main`). Orden: HU-15 (ver favoritos) → HU-14 (eliminar, comprobando que los favoritos se conservan) → HU-16.

## HU-12 (guardar favorita)

- `POST /favorites { ideaId }`: copia armada en el backend (`scan_ideas` + `scans!inner` con `scans.user_id`); ajena o inexistente → 404; ya favorita → 200 (carrera por `23505`). `DELETE /favorites/:id` (204/404) y `GET /favorites` paginado de 20 listos para HU-15.
- `GET /history/:id`: cada idea guardada trae `favoriteId` o `null`. 401 sin cabecera: «Inicia sesión para continuar»; token inválido: «Tu sesión no es válida o venció».
- Frontend: corazón en `/ideas` y en el detalle del historial (optimista, `aria-busy`, no abre el chat); store en memoria `ideaId → favoriteId` que se vacía al cambiar de usuario. Sin sesión, enlace a `/entrar?volver=`.
- Escaneo hecho sin sesión y luego con sesión: «Guardar este escaneo» reenvía la foto con token (`/ideas` y `/resultado`); si falló al guardar con sesión, «No pudimos guardar este escaneo» + «Reintentar».
- Local: `npm run check` OK (backend 245, frontend 241). Sin migraciones nuevas.

## Decisiones

- ADR-28: favoritos como copia armada en el servidor, idempotentes, y store de corazones en memoria compartido.

## Problemas abiertos

1. **Sin probar contra Supabase real:** filtro `scans!inner` + `scans.user_id`, `23505` real, subida a `scan-images`, URLs firmadas, historial y favoritos en Android; registro de HU-04 en Android.
2. **Supabase:** las Redirect URLs deben llevar `/**`. En Railway, borrar `SUPABASE_JWT_SECRET` si existe.
3. PKCE: el enlace de verificación abierto en otro navegador no deja la sesión iniciada.
4. Offline en `/camara`, `/resultado`, `/ideas`, `/chat` e `/historial`: solo el banner.
5. Solo en desarrollo: StrictMode duplica peticiones al montar `/resultado` o `/ideas`.
6. Prueba intermitente del frontend (foco en `ResultPage`).
7. Rama `fix/arranque-config` pendiente.
8. Vitest backend (v2) vs frontend (v5): con la unidad en minúscula (`c:\…`) fallan los del frontend.
9. Logo oficial y normativa de contenedores de San Juan Nepomuceno sin confirmar.
10. `/chat` acepta `scanId` sin verificar su dueño; el chat aún no se guarda (`chat_messages`).
11. «Guardar este escaneo» vuelve a llamar a la IA (otro costo). Un toggle en vuelo puede ser pisado si el detalle del historial se recarga (improbable).
12. En el resultado de clasificar sin regla, «Reintentar» puede aparecer dos veces (acción + aviso de guardado fallido).

## Siguiente acción

Prueba de humo en producción: escaneo con sesión → corazón → `/historial/:id` lo muestra lleno; idea de otro usuario → 404 (punto 1). Luego `/story HU-15` en `feat/HU-15-favoritos`: pantalla `/favoritos` con `RequireAuth` sobre `GET /favorites` y el store existente.
