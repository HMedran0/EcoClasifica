# Estado del proyecto

_Actualizado: 2026-10-21 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F5 — Lanzamiento piloto: en curso.** Criterio de salida: piloto con 5 a 10 usuarios reales en San Juan Nepomuceno sin errores bloqueantes, con gasto de IA limitado y cumpliendo la Ley 1581.

Orden: `fix/arranque-config` ✅ → HU-20 (cuota diaria de IA) → HU-19 (recuperar contraseña) → HU-21 (privacidad y autorización) → HU-22 (eliminar cuenta) → `chore/F5-imagenes-huerfanas` → `chore/F5-calidad` (Lighthouse ≥ 90 en Performance y Accesibilidad).

## Terminado hoy: `fix/arranque-config`

- Producción no arranca sin `ALLOWED_ORIGINS` o con un origen no limpio (`new URL(o).origin === o`) o sin `https` (salvo `localhost`). Solo se registran nombres de variables.
- Logs: nivel de pino como texto (Railway solo reconoce `debug/info/warn/error`; con `50` todo salía como `info`). pino-http: 5xx → `error`, 4xx → `warn`.
- El build de Vercel exige `VITE_API_URL` con `https` (el `localhost` del CI se permite).
- Vitest 5.0.5 único en el monorepo. `scripts/vitest.mjs` lanza Vitest desde su ruta canónica: con `c:\` en minúscula cargaba dos copias de sí mismo (no era la versión).
- Foco del título en `ScanScreen` con `useLayoutEffect` (prueba intermitente de `ResultPage`).

## Tareas manuales del responsable (F5)

Sin dominio propio (proyecto universitario): SMTP con Gmail y contraseña de aplicación · Google OAuth en modo de prueba con los participantes como _test users_ (máx. 100) · reglas de contenedores con la alcaldía · texto de privacidad revisado por el director o tutor · ejecución del piloto. Detalle en `docs/BACKLOG.md` y `docs/despliegue.md`.

## Problemas abiertos

1. **Supabase:** las Redirect URLs deben llevar `/**`. En Railway, borrar `SUPABASE_JWT_SECRET` si existe.
2. **Railway:** tras desplegar, confirmar que `ALLOWED_ORIGINS` es exactamente `https://eco-clasifica.vercel.app` (si no, ya no arranca) y que `@level:error` filtra.
3. PKCE: el enlace de verificación abierto en otro navegador no deja la sesión iniciada.
4. Offline en `/camara`, `/resultado`, `/ideas`, `/chat`, `/historial` y `/favoritos`: solo el banner.
5. Solo en desarrollo: StrictMode duplica peticiones al montar `/resultado` o `/ideas`.
6. Logo oficial y normativa de contenedores de San Juan Nepomuceno sin confirmar (tarea manual).
7. `/chat` acepta `scanId` sin verificar su dueño (revisar en HU-20 al registrar `ai_usage`).
8. «Guardar este escaneo» vuelve a llamar a la IA (cuenta para la cuota de HU-20).
9. Chat: «Reintentar» tras un aborto puede duplicar la pregunta en el hilo guardado.
10. `ConfirmDialog` importa estilos de `features/scan/ScanScreen` (mover a un módulo compartido).
11. Duplicado menor de Vite (8.3.4 frontend, 8.3.5 backend vía Vitest); sin impacto.

## Siguiente acción

`/story HU-20` en la rama `feat/HU-20-cuota-ia`.
