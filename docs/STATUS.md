# Estado del proyecto

_Actualizado: 2026-10-20 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F4 — Cuentas:** en curso. **HU-04 hecha** (rama `feat/HU-04-auth`, fusionada en `main`). Siguen HU-13 (historial) y HU-15 (favoritos).

## HU-04 (registro e inicio de sesión)

- Backend: `optionalAuth`/`requireAuth` (`middlewares/auth.ts`) con `getClaims` (`services/auth.service.ts`); `optionalAuth` en `/scan/*` y `/chat` (aún `saved: false`); `GET /api/v1/me` (`meResponseSchema`); logger inyectable con `redact` probado.
- Frontend: `/entrar` (pestañas, Google con `redirectTo` = origen + `?volver=` validado, «Reenviar correo», errores traducidos), `authStore` + `initAuth` en `main.tsx`, `RequireAuth` (sin usar aún), cuenta en la portada, Bearer en `api/client.ts` con renovación ante 401. PKCE.
- Build y CI exigen `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Se quitó `SUPABASE_JWT_SECRET`.
- Local: `npm run check` OK (backend 186, frontend 203).

## Decisiones

- ADR-26: validación con `getClaims`, códigos 401/500, PKCE, `?volver=` interno y 401 → `refreshSession` → reintento único.

## Problemas abiertos

1. **Sin probar en Android real:** registro con correo (verificación y reenvío), Google y regreso a la ruta de origen.
2. **Supabase:** las Redirect URLs deben llevar `/**` (`https://eco-clasifica.vercel.app/**`, `http://localhost:5173/**`); si no, se vuelve siempre a la Site URL. En Railway, borrar `SUPABASE_JWT_SECRET` si existe.
3. PKCE: el enlace de verificación abierto en otro navegador confirma el correo, pero no deja la sesión iniciada.
4. Offline en `/camara`, `/resultado`, `/ideas` y `/chat`: solo el banner; `NETWORK_ERROR` no dice «requiere internet». Sin aviso «Lista para usar sin conexión».
5. Solo desarrollo: StrictMode lanza dos peticiones al montar `/resultado` o `/ideas`.
6. Prueba intermitente del frontend (foco en `ResultPage`; sospecha `findBy` de 1 s bajo carga).
7. Rama `fix/arranque-config` pendiente (`''` como faltante, log en Railway, `ALLOWED_ORIGINS`, `https:` en `VITE_API_URL`).
8. Vitest del backend (v2) frente al del frontend (v5): con la unidad en minúscula (`c:\…`) fallan los 18 archivos del frontend.
9. Logo oficial pendiente. Normativa de contenedores de San Juan Nepomuceno sin confirmar.
10. Upcycle y chat, menores: emojis al recortar; `description`/`extraMaterials` solo los protege el prompt; `scanId` sin uso (filtrar por `req.user.id` en HU-13); `toPlainText` no quita viñetas `*` ni enlaces.
11. HU-19 (recuperar contraseña) pendiente.

## Siguiente acción

Probar HU-04 en Android (puntos 1 y 2). Luego `/story HU-13` en la rama `feat/HU-13-historial`: guardar escaneos con sesión (`saved: true`), `GET /history` filtrado por `req.user.id`, pruebas de acceso entre usuarios y `/historial` con `RequireAuth`.
