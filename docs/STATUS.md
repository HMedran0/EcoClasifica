# Estado del proyecto

_Actualizado: 2026-10-21 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F4 — Cuentas: cumplida (2026-10-20).** En producción: Lighthouse móvil Performance 96 y Accesibilidad 100; manifiesto y `sw.js` correctos (Lighthouse 12 no tiene categoría PWA). Prueba manual de HU-04, HU-12, HU-13, HU-14 y HU-15 completa, con aislamiento entre dos cuentas y borrado verificado en Storage. CI de `main` en verde.

**F5 — Lanzamiento piloto: empieza.** Criterio de salida: piloto con 5 a 10 usuarios reales en San Juan Nepomuceno sin errores bloqueantes, con gasto de IA limitado y cumpliendo la Ley 1581.

Orden: `fix/arranque-config` → HU-20 (cuota diaria de IA) → HU-19 (recuperar contraseña) → HU-21 (privacidad y autorización) → HU-22 (eliminar cuenta) → `chore/F5-imagenes-huerfanas` → `chore/F5-calidad` (Lighthouse ≥ 90 en Performance y Accesibilidad). HU-08 y HU-16 pasan a v1.1.

## Tareas manuales del responsable (F5)

SMTP propio en Supabase Auth · dominio y publicación de la app de Google OAuth · validación de reglas de contenedores con la alcaldía · validación del texto de privacidad · ejecución del piloto.

## Decisiones

- Sin ADR nuevo. Las historias HU-20, HU-21 y HU-22 tienen sección en `historias.md`. HU-19 sube a prioridad M (necesaria para el piloto) y todavía no tiene sección.

## Problemas abiertos

1. **Supabase:** las Redirect URLs deben llevar `/**`. En Railway, borrar `SUPABASE_JWT_SECRET` si existe.
2. PKCE: el enlace de verificación abierto en otro navegador no deja la sesión iniciada.
3. Offline en `/camara`, `/resultado`, `/ideas`, `/chat`, `/historial` y `/favoritos`: solo el banner.
4. Solo en desarrollo: StrictMode duplica peticiones al montar `/resultado` o `/ideas`.
5. Prueba intermitente del frontend (foco en `ResultPage`).
6. Vitest backend (v2) vs frontend (v5): con la unidad en minúscula (`c:\…`) fallan los del frontend.
7. Logo oficial y normativa de contenedores de San Juan Nepomuceno sin confirmar (tarea manual).
8. `/chat` acepta `scanId` sin verificar su dueño (solo métricas; revisar en HU-20 al registrar `ai_usage`).
9. «Guardar este escaneo» vuelve a llamar a la IA (otro costo; cuenta para la cuota de HU-20).
10. Chat: «Reintentar» tras un aborto puede duplicar la pregunta en el hilo guardado.
11. `ConfirmDialog` importa estilos de `features/scan/ScanScreen` (mover a un módulo compartido).

## Siguiente acción

Retomar la rama `fix/arranque-config` (pendiente desde F3): revisar qué contiene frente a `main`, terminarla, pasar `npm run check` y fusionarla. Luego `/story HU-20`.
