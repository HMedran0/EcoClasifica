# Estado del proyecto

_Actualizado: 2026-10-20 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F4 — Cuentas:** en curso. Hechas HU-04, HU-13, HU-12, HU-15 y **HU-14** (`feat/HU-14-borrar`, fusionada en `main`). Falta HU-16 (y HU-19, opcional).

## HU-14 (eliminar escaneo o todo el historial)

- `DELETE /history/:id` → 204 (ajeno o mal formado → 404). `DELETE /history` → `{ deleted }`. Primero la fila (cascada de la base: `scan_ideas` y `chat_messages`; `favorites.idea_id` → null) y luego la imagen; si falla, se responde igual y queda un `warn` con `scanId`/`scanIds`.
- El borrado total toma las rutas de las filas borradas (no lista la carpeta): un escaneo guardado mientras tanto conserva su imagen. Lotes de 100.
- Frontend: `components/ConfirmDialog` (alertdialog, foco inicial en «Cancelar», trampa de foco, Esc; ocupado → foco en el diálogo). «Eliminar escaneo» en el detalle; «Eliminar todo mi historial» en `/historial` (oculto si está vacío). `forgetDeleted` limpia corazones, hilos `idea:`/`historial:` y la respuesta en caché de ese `scanId`. Avisos «Escaneo eliminado» y «Historial eliminado (N escaneos)» (singular con 1).
- Local: `npm run check` OK (backend 286, frontend 279). Sin migraciones nuevas.

## Decisiones

- ADR-30: borrado con cascada de la base y rutas de imagen derivadas de las filas borradas.

## Problemas abiertos

1. **Sin probar contra Supabase real:** `scans!inner`, `23505`, `scan-images`, URLs firmadas, historial, favoritos, `chat_messages` y ahora `delete … select('id, image_path')` y la cascada (favorito con `idea_id` null) en Android.
2. **F5:** script de mantenimiento que borre de `scan-images` las imágenes sin fila en `scans` (huérfanas por fallos al borrar; anotado en `BACKLOG.md`).
3. **Supabase:** las Redirect URLs deben llevar `/**`. En Railway, borrar `SUPABASE_JWT_SECRET` si existe.
4. PKCE: el enlace de verificación abierto en otro navegador no deja la sesión iniciada.
5. Offline en `/camara`, `/resultado`, `/ideas`, `/chat`, `/historial` y `/favoritos`: solo el banner.
6. Solo en desarrollo: StrictMode duplica peticiones al montar `/resultado` o `/ideas`.
7. Prueba intermitente del frontend (foco en `ResultPage`).
8. Rama `fix/arranque-config` pendiente.
9. Vitest backend (v2) vs frontend (v5): con la unidad en minúscula (`c:\…`) fallan los del frontend.
10. Logo oficial y normativa de contenedores de San Juan Nepomuceno sin confirmar.
11. `/chat` acepta `scanId` sin verificar su dueño (solo métricas).
12. «Guardar este escaneo» vuelve a llamar a la IA (otro costo).
13. Chat: «Reintentar» tras un aborto puede duplicar la pregunta en el hilo guardado.
14. `ConfirmDialog` importa estilos de `features/scan/ScanScreen` (mover a un módulo compartido).

## Siguiente acción

Prueba de humo en producción: escaneo de upcycle con sesión → corazón → chat → «Eliminar escaneo» → `/favoritos` muestra el favorito y abre el chat con el aviso de huérfano; «Eliminar todo» → `{ deleted }` correcto y bucket vacío para ese usuario (punto 1). Luego `/story HU-16`.
