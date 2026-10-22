# Estado del proyecto

_Actualizado: 2026-10-22 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F5 — Lanzamiento piloto: en curso.** Criterio de salida: piloto con 5 a 10 usuarios reales en San Juan Nepomuceno sin errores bloqueantes, con gasto de IA limitado y cumpliendo la Ley 1581.

Orden: `fix/arranque-config` ✅ → HU-20 ✅ → HU-19 ✅ → HU-21 ✅ → HU-22 ✅ → `chore/F5-mantenimiento` ✅ → `chore/F5-calidad` (Lighthouse ≥ 90).

## Terminado hoy: `chore/F5-mantenimiento` (antes `chore/F5-imagenes-huerfanas`)

- `npm run maintenance` (raíz) → `backend/scripts/maintenance.ts`. Simulación por defecto; `--apply` borra; `--force` salta el freno. Carga `.env` como `dev:api` (alternativa: `railway run`).
- Huérfana = imagen de `scan-images` sin fila en `scans.image_path` y > 24 h (sin fecha → se respeta). Borra en lotes de 100. Purga `ai_usage` > 90 días. Cubre las carpetas de cuentas borradas (problema abierto de HU-22).
- Protecciones (ADR-34): lee todo antes de borrar; cualquier error de Storage/`scans`/`ai_usage` aborta con salida 1 sin borrar. Freno con ≥ 20 revisadas y > 50 % huérfanas (la simulación avisa). `in (...)` en grupos de 50.
- Salida solo con conteos; errores solo con el código de Supabase. `MaintenanceRepo` inyectable; 23 pruebas. Docs: sección 4 de `docs/despliegue.md` (semanal durante el piloto).

## Tareas manuales del responsable (F5)

SMTP con Gmail · Google OAuth en modo de prueba · plantilla «Reset password» en Supabase · reglas de contenedores con la alcaldía · **revisión del texto de privacidad por el tutor** · **reemplazar los datos provisionales del responsable en `/privacidad`** · ejecución del piloto · **`npm run maintenance` cada semana (primero la simulación)**.

## Problemas abiertos

1. Ejecutar `npm run maintenance` (simulación) contra Supabase real y revisar los conteos antes del primer `--apply`.
2. Probar HU-22 con Supabase real: borrar una cuenta con fotos y verificar Storage, tablas y `ai_usage` anonimizado.
3. Las Redirect URLs de Supabase deben llevar `/**`. En Railway, borrar `SUPABASE_JWT_SECRET` si existe; confirmar `ALLOWED_ORIGINS` y un 429 real de cuota.
4. Probar HU-19 y HU-21 de punta a punta con Supabase real.
5. PKCE: los enlaces de correo solo sirven en el mismo navegador. Cuota no atómica. Lectura extra de `profiles` por petición (aceptados).
6. `ConfirmDialog` importa estilos de `ScanScreen`; `readNotice` está duplicado; `AccountPage` reutiliza `useConfirmedDelete` de `history`.

## Siguiente acción

Rama `chore/F5-calidad` desde `main` (Lighthouse ≥ 90 en Performance y Accesibilidad, RNF-03). Antes, `npm run maintenance` en simulación con Supabase real.
