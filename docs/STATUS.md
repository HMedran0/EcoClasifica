# Estado del proyecto

_Actualizado: 2026-10-21 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F5 — Lanzamiento piloto: en curso.** Criterio de salida: piloto con 5 a 10 usuarios reales en San Juan Nepomuceno sin errores bloqueantes, con gasto de IA limitado y cumpliendo la Ley 1581.

Orden: `fix/arranque-config` ✅ → HU-20 ✅ → HU-19 ✅ → HU-21 ✅ → HU-22 (eliminar cuenta) → `chore/F5-imagenes-huerfanas` (también purga `ai_usage` > 90 días) → `chore/F5-calidad` (Lighthouse ≥ 90).

## Terminado hoy: HU-21 (privacidad y autorización, Ley 1581)

- `/privacidad` pública, enlazada desde la portada, `/entrar`, `/autorizacion` y la cámara. Muestra `PRIVACY_VERSION` (`shared/src/constants/privacy.ts`, hoy `2026-10-1`). Responsable: cipa 0, San Juan Nepomuceno.
- Migración `0005_privacy_consent.sql` (ya ejecutada, en versión repetible): `profiles.privacy_version` y `privacy_accepted_at`. `anon` y `authenticated` solo pueden escribir `display_name` y `avatar_url`.
- `POST /me/consent`: usa la versión y la hora del servidor. Si esa versión ya estaba aceptada, conserva la primera fecha. `GET /me` devuelve `privacyVersion`.
- Sin la versión vigente: el escaneo responde `saved: false`, el chat funciona como anónimo y `POST /favorites` devuelve `403 CONSENT_REQUIRED`.
- Frontend: `ConsentGate` lleva a `/autorizacion` si la versión no coincide y siempre deja pasar `/privacidad`, `/autorizacion` y `/restablecer`. La casilla empieza sin marcar y su enlace abre en una pestaña nueva. «No acepto» cierra la sesión.
- Al crear una cuenta con correo, la casilla va en `user_metadata.privacy_version` y la autorización se registra al entrar. La prueba legal es la fila de `profiles`.

## Tareas manuales del responsable (F5)

SMTP con Gmail · Google OAuth en modo de prueba · pegar la plantilla «Reset password» en Supabase · reglas de contenedores con la alcaldía · **revisión del texto de privacidad por el tutor** · ejecución del piloto.

## Problemas abiertos

1. La política dice que borrar la cuenta es inmediato desde la app: depende de HU-22, que debe estar antes del piloto.
2. Las Redirect URLs de Supabase deben llevar `/**`. En Railway, borrar `SUPABASE_JWT_SECRET` si existe.
3. Railway: confirmar `ALLOWED_ORIGINS`, el filtro `@level:error` y un 429 real de cuota.
4. Probar HU-19 y HU-21 de punta a punta con Supabase real (registro con correo, Google y «No acepto»).
5. Si `/me` falla (sin internet), el gate deja pasar y vuelve a intentar. El backend igual no guarda nada.
6. Cada escaneo, chat y favorito con sesión hace una lectura extra de `profiles` (aceptado).
7. PKCE: los enlaces de los correos solo sirven en el mismo navegador. El límite de 1 correo/min podría revelar qué correos existen (aceptado).
8. Offline solo muestra el banner. StrictMode duplica peticiones en desarrollo. Logo y normativa sin confirmar.
9. `ConfirmDialog` importa estilos de `ScanScreen`; `readNotice` está duplicado. Cuota no atómica (aceptado).

## Siguiente acción

`/story HU-22` en la rama `feat/HU-22-eliminar-cuenta`.
