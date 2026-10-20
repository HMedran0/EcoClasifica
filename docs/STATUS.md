# Estado del proyecto

_Actualizado: 2026-10-20 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F4 — Cuentas:** en curso. **HU-04 y HU-13 hechas** (HU-13 en `feat/HU-13-historial`, fusionada en `main`). Siguen HU-15 (favoritos), HU-14 (eliminar) y HU-16.

## HU-13 (historial)

- Migración `0003_scans_result.sql` (ya ejecutada en Supabase): `scans.result` jsonb `not null` con `check` de objeto. Su `delete` de filas sin `result` no borró nada (no había escaneos guardados).
- Guardado con sesión en `/scan/*` (`services/scanSave.service.ts`, `repositories/scans.repo.ts`): imagen, `scans` y `scan_ideas`, con rollback. Si falla → `saved: false` y `error` en el log sin datos personales.
- `GET /history?page=N` y `GET /history/:id` (`history.routes.ts`), filtrados por `user_id`; id ajeno → 404. Filas con `result` inválido: se omiten de la lista (`warn` con su id) y el detalle responde 500.
- Frontend: `/historial` y `/historial/:id` con `RequireAuth`, chat desde ideas guardadas (hilo `historial:<scanId>:<i>`), «Mi historial» en la portada y aviso en la cámara.
- Local: `npm run check` OK (backend 224, frontend 219).

## Decisiones

- ADR-27: copia en `scans.result`, ids de ideas generados en el backend, orden `created_at desc, id desc`, URLs firmadas de 10 min, 404 para lo ajeno.

## Problemas abiertos

1. **Sin probar contra Supabase real:** subida a `scan-images`, URLs firmadas, rollback e historial en Android. Tampoco el registro de HU-04 en Android (correo, Google, regreso a la ruta de origen).
2. **Supabase:** las Redirect URLs deben llevar `/**`. En Railway, borrar `SUPABASE_JWT_SECRET` si existe.
3. PKCE: el enlace de verificación abierto en otro navegador no deja la sesión iniciada.
4. Offline en `/camara`, `/resultado`, `/ideas`, `/chat` e `/historial`: solo el banner; `NETWORK_ERROR` no dice «requiere internet».
5. Solo en desarrollo: StrictMode duplica peticiones al montar `/resultado` o `/ideas`.
6. Prueba intermitente del frontend (foco en `ResultPage`).
7. Rama `fix/arranque-config` pendiente.
8. Vitest del backend (v2) frente al del frontend (v5): con la unidad en minúscula (`c:\…`) fallan los archivos del frontend.
9. Logo oficial y normativa de contenedores de San Juan Nepomuceno sin confirmar.
10. `/chat` acepta `scanId` sin verificar su dueño. Hoy no se usa, pero si HU-14/15 lo usan, deben filtrar por `user_id`. El chat aún no se guarda (`chat_messages`).
11. Las imágenes se guardan siempre como `.jpg` (el cliente solo envía JPEG). HU-19 pendiente.

## Siguiente acción

Probar en producción un escaneo con sesión, revisar `/historial` y su detalle (punto 1). Luego `/story HU-15` en la rama `feat/HU-15-favoritos`: `POST/GET/DELETE /favorites` con `ideaId` de `scan_ideas` (verificando que el escaneo sea de `req.user.id`) y snapshot en `favorites`.
