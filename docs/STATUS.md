# Estado del proyecto

_Actualizado: 2026-10-21 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F5 — Lanzamiento piloto: en curso.** Criterio de salida: piloto con 5 a 10 usuarios reales en San Juan Nepomuceno sin errores bloqueantes, con gasto de IA limitado y cumpliendo la Ley 1581.

Orden: `fix/arranque-config` ✅ → HU-20 ✅ → HU-19 ✅ → HU-21 (privacidad y autorización) → HU-22 (eliminar cuenta) → `chore/F5-imagenes-huerfanas` (también purga `ai_usage` > 90 días) → `chore/F5-calidad` (Lighthouse ≥ 90).

## Terminado hoy: HU-19 (recuperar contraseña)

- `/entrar` → «¿Olvidaste tu contraseña?» (`ForgotPasswordForm`; `/entrar?recuperar=1` lo abre directo). Mensaje neutro siempre; solo se distinguen límite de envíos («espera»), red y correo mal escrito.
- `/restablecer` (`ResetPasswordPage`): cuenta como recuperación `PASSWORD_RECOVERY` o `SIGNED_IN` con sesión, o la sesión que deja `initialize()`, **solo si el `?code=` ya no está en la URL** (supabase-js lo quita al canjearlo). Así una sesión previa en otro navegador no permite cambiar la contraseña. Tiempo máximo 10 s.
- Mensajes distintos: vencido/usado (`otp_expired`) vs. otro dispositivo (`bad_code_verifier`, `flow_state_not_found`, canje sin sesión), ambos con «Pedir otro enlace». Sin código: con sesión → `/`, sin sesión → `/entrar`.
- `updateUser` (≥ 8, confirmación) → `signOut({ scope: 'others' })` (su fallo no se reporta) → portada con aviso «Contraseña actualizada» (estado de navegación en `HomePage`).
- `authForm.ts` reúne estilos y validación de correo de las pantallas de cuenta. Plantilla «Reset password» en español en `docs/despliegue.md`.

## Tareas manuales del responsable (F5)

Sin dominio propio: SMTP con Gmail · Google OAuth en modo de prueba (test users) · **pegar la plantilla «Reset password» en Supabase** · reglas de contenedores con la alcaldía · texto de privacidad revisado por el tutor · ejecución del piloto. Detalle en `docs/BACKLOG.md` y `docs/despliegue.md`.

## Problemas abiertos

1. **Supabase:** las Redirect URLs deben llevar `/**`. En Railway, borrar `SUPABASE_JWT_SECRET` si existe.
2. **Railway:** tras desplegar, confirmar `ALLOWED_ORIGINS` exacto y que `@level:error` filtra; probar un 429 real de cuota.
3. PKCE: los enlaces de verificación y de recuperación solo sirven en el mismo navegador donde se pidieron (la app lo explica).
4. Probar HU-19 de punta a punta con Supabase real (eventos y limpieza del `?code=` simulados en pruebas).
5. Riesgo aceptado: el límite de 1 correo/min de Supabase podría revelar qué correos existen con dos peticiones seguidas.
6. Offline en `/camara`, `/resultado`, `/ideas`, `/chat`, `/historial` y `/favoritos`: solo el banner.
7. Solo en desarrollo: StrictMode duplica peticiones al montar `/resultado` o `/ideas`.
8. Logo oficial y normativa de contenedores de San Juan Nepomuceno sin confirmar.
9. «Guardar este escaneo» vuelve a llamar a la IA y gasta cuota (aceptado). Chat: «Reintentar» tras un aborto puede duplicar la pregunta.
10. `ConfirmDialog` importa estilos de `ScanScreen`; `readNotice` duplicado en `HomePage` e `HistoryPage` (unificar). Cuota no atómica (aceptado).

## Siguiente acción

`/story HU-21` en la rama `feat/HU-21-privacidad`.
