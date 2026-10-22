# Estado del proyecto

_Actualizado: 2026-10-21 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F5 — Lanzamiento piloto: en curso.** Criterio de salida: piloto con 5 a 10 usuarios reales en San Juan Nepomuceno sin errores bloqueantes, con gasto de IA limitado y cumpliendo la Ley 1581.

Orden: `fix/arranque-config` ✅ → HU-20 ✅ → HU-19 (recuperar contraseña) → HU-21 (privacidad y autorización) → HU-22 (eliminar cuenta) → `chore/F5-imagenes-huerfanas` (también purga `ai_usage` > 90 días) → `chore/F5-calidad` (Lighthouse ≥ 90).

## Terminado hoy: HU-20 (cuota diaria de IA, ADR-31)

- Cuota diaria (medianoche de America/Bogota): con sesión 60 escaneos y 100 mensajes; sin sesión, por IP, 30 y 60 (CGNAT). Tope global de 1 000 000 tokens (`503 SERVICE_PAUSED`); anónimos cortados al 70 % (`AI_ANON_TOKEN_SHARE`). Todo por variables `QUOTA_*` / `AI_*`.
- `429 QUOTA_EXCEEDED` (código nuevo) con `Retry-After` y mensaje del servidor; el frontend lo muestra en resultado, ideas y chat sin «Reintentar».
- `ai_usage` registra cada llamada, también las fallidas con sus tokens (`AiCallError`). Sin IP en claro: `ip_hash` = HMAC-SHA256 con `IP_HASH_SALT` (obligatoria en producción, ≥ 32), IPv6 por /64. Si Supabase falla, se deja pasar con `warn`.
- Migración `0004_ai_usage_quota.sql` ejecutada en Supabase; `IP_HASH_SALT` cargada en Railway.
- `backend/tests/setup.ts` vacía las claves de DeepSeek y Supabase: ninguna prueba toca servicios reales.
- Problema abierto 7 resuelto: el `scanId` del chat no se registra (queda `null`).

## Tareas manuales del responsable (F5)

Sin dominio propio: SMTP con Gmail · Google OAuth en modo de prueba (test users) · reglas de contenedores con la alcaldía · texto de privacidad revisado por el tutor · ejecución del piloto. Detalle en `docs/BACKLOG.md` y `docs/despliegue.md`.

## Problemas abiertos

1. **Supabase:** las Redirect URLs deben llevar `/**`. En Railway, borrar `SUPABASE_JWT_SECRET` si existe.
2. **Railway:** tras desplegar, confirmar `ALLOWED_ORIGINS` exacto y que `@level:error` filtra; probar un 429 real de cuota.
3. PKCE: el enlace de verificación abierto en otro navegador no deja la sesión iniciada.
4. Offline en `/camara`, `/resultado`, `/ideas`, `/chat`, `/historial` y `/favoritos`: solo el banner.
5. Solo en desarrollo: StrictMode duplica peticiones al montar `/resultado` o `/ideas`.
6. Logo oficial y normativa de contenedores de San Juan Nepomuceno sin confirmar.
7. «Guardar este escaneo» vuelve a llamar a la IA y gasta cuota (aceptado).
8. Chat: «Reintentar» tras un aborto puede duplicar la pregunta en el hilo guardado.
9. `ConfirmDialog` importa estilos de `features/scan/ScanScreen` (mover a un módulo compartido).
10. Cuota no atómica (ráfagas simultáneas pueden pasar por 1) y `flush` de `ai_usage` añade la latencia del insert; aceptado para el piloto.

## Siguiente acción

`/story HU-19` en la rama `feat/HU-19-recuperar-contrasena`.
