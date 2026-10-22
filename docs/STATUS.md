# Estado del proyecto

_Actualizado: 2026-10-21 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F5 — Lanzamiento piloto: en curso.** Criterio de salida: piloto con 5 a 10 usuarios reales en San Juan Nepomuceno sin errores bloqueantes, con gasto de IA limitado y cumpliendo la Ley 1581.

Orden: `fix/arranque-config` ✅ → HU-20 ✅ → HU-19 ✅ → HU-21 ✅ → HU-22 ✅ → `chore/F5-imagenes-huerfanas` (también purga `ai_usage` > 90 días) → `chore/F5-calidad` (Lighthouse ≥ 90).

## Terminado hoy: HU-22 (eliminar mi cuenta), rama `feat/HU-22-eliminar-cuenta`

- `DELETE /api/v1/me` → 204. Lista `scan-images/<user_id>/` (páginas de 100; ignora subcarpetas), borra en lotes de 100, vuelve a listar y solo si está vacía llama a `auth.admin.deleteUser`. Cascadas de `0001` verificadas; `ai_usage.user_id` → null.
- Fallo de Storage o Auth, o imágenes restantes (`warn` solo con `remainingImages`) → `503 ACCOUNT_DELETE_FAILED` «No pudimos eliminar tu cuenta. Intenta de nuevo.», sin borrar la cuenta. Nuevo `AccountsRepo` inyectable. Los logs llevan solo el código o status de Supabase (`SupabaseOpError`), nunca su mensaje (ADR-33).
- Frontend: `/cuenta` (RequireAuth, enlace «Mi cuenta» en la portada) con correo, política y «Eliminar mi cuenta». `ConfirmDialog` admite `confirmText` (escribir ELIMINAR). Tras borrar: portada con «Tu cuenta y tus datos fueron eliminados»; al desmontar `/cuenta` se vacían los stores y se cierra la sesión local (antes, `RequireAuth` mandaba a /entrar).
- `/privacidad` describe el proceso (sin cambiar `PRIVACY_VERSION`: no cambia el tratamiento).

## Tareas manuales del responsable (F5)

SMTP con Gmail · Google OAuth en modo de prueba · plantilla «Reset password» en Supabase · reglas de contenedores con la alcaldía · **revisión del texto de privacidad por el tutor** · **reemplazar los datos provisionales del responsable en `/privacidad` («cipa 0», domicilio, correo, teléfono) antes del piloto** · ejecución del piloto.

## Problemas abiertos

1. Carrera aceptada: un escaneo guardado desde otro dispositivo entre la verificación y `deleteUser` deja una imagen huérfana → la borra `chore/F5-imagenes-huerfanas` (debe listar carpetas sin usuario en Auth).
2. Probar HU-22 con Supabase real: borrar una cuenta con fotos y verificar Storage, tablas y `ai_usage` anonimizado.
3. Las Redirect URLs de Supabase deben llevar `/**`. En Railway, borrar `SUPABASE_JWT_SECRET` si existe; confirmar `ALLOWED_ORIGINS` y un 429 real de cuota.
4. Probar HU-19 y HU-21 de punta a punta con Supabase real.
5. PKCE: los enlaces de correo solo sirven en el mismo navegador. Cuota no atómica. Lectura extra de `profiles` por petición (aceptados).
6. `ConfirmDialog` importa estilos de `ScanScreen`; `readNotice` está duplicado; `AccountPage` reutiliza `useConfirmedDelete` de `history`.

## Siguiente acción

Rama `chore/F5-imagenes-huerfanas` desde `main` (incluir las carpetas de `scan-images` sin usuario en Auth). Antes, probar HU-22 con Supabase real.
