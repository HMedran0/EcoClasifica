# Índice de documentación (mapa "tarea → qué leer")

No leas todo. Busca tu tarea y carga solo lo indicado (con `Grep`/`Read` y `limit`).

| Tarea                               | Leer                                                     | Notas                                   |
| ----------------------------------- | -------------------------------------------------------- | --------------------------------------- |
| Retomar trabajo                     | `STATUS.md`                                              | Siempre primero                         |
| Implementar una historia            | Sección en `historias.md`                                | `Grep "## HU-05" -A 15`                 |
| Endpoint nuevo o cambio de contrato | `api.md` (sección del endpoint) + `shared/src/schemas/*` | Actualizar ambos                        |
| Prompts o integración con DeepSeek  | `api.md` §DeepSeek + `backend/src/services/ai/`          |                                         |
| Tablas, consultas, RLS              | `modelo-datos.md` + `supabase/migrations/0001_init.sql`  | Cambios = migración nueva               |
| Reglas de contenedores              | `modelo-datos.md` §Reglas + `supabase/seed.sql`          |                                         |
| Estructura de carpetas              | `arquitectura.md` §Estructura                            |                                         |
| Decisión de arquitectura            | `DECISIONS.md`                                           | Solo si hay duda; añadir ADR al decidir |
| Fases y criterios de salida         | `BACKLOG.md` §Fases                                      | Con `/phase-check`                      |
| Despliegue (Railway/Vercel)         | `despliegue.md`                                          | Orden, variables, dominios, humo        |
| Cómo ahorrar contexto               | `METODOLOGIA-CONTEXTO.md`                                | Una vez                                 |
| Primer prompt para Claude Code      | `INICIO-CLAUDE-CODE.md`                                  | Solo el humano lo usa                   |

## Mapa por historia

| Historia                       | Archivos relevantes                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| HU-01 Instalar PWA             | `frontend/vite.config.ts`, `frontend/public/icons/`                                                             |
| HU-02, HU-03 Cámara y modo     | `frontend/src/features/camera/`                                                                                 |
| HU-04 Cuentas                  | `backend/src/middlewares/auth.ts`, `frontend/src/features/auth/`, `modelo-datos.md` §RLS                        |
| HU-05, HU-06, HU-07 Clasificar | `backend/src/services/{ai,classification}*`, `routes/scan.routes.ts`, `shared/src/schemas/{ai,scan}.ts`         |
| HU-08 Corregir resultado       | `scans.user_feedback`, `routes/scan.routes.ts`                                                                  |
| HU-09, HU-10 Upcycle           | `backend/src/services/ai/`, `frontend/src/features/upcycle/`                                                    |
| HU-11 Chat                     | `backend/src/routes/chat.routes.ts`, `frontend/src/features/chat/`, `shared/src/schemas/chat.ts`                |
| HU-12, HU-15 Favoritos         | `routes/favorites.routes.ts`, `repositories/favorites.repo.ts`                                                  |
| HU-13, HU-14, HU-16 Historial  | `routes/history.routes.ts`, `repositories/scans.repo.ts`                                                        |
| HU-19 Recuperar contraseña     | `frontend/src/features/auth/` (`LoginPage`, `authActions.ts`, `authErrors.ts`), `despliegue.md` (Redirect URLs) |
| HU-20 Cuota de IA              | `middlewares/rateLimit.ts`, `services/ai/`, `shared/src/schemas/errors.ts`, `modelo-datos.md` (`ai_usage`)      |
| HU-21 Privacidad               | `frontend/src/features/auth/`, `frontend/src/features/home/`, `modelo-datos.md` (`profiles`)                    |
| HU-22 Eliminar cuenta          | `routes/me.routes.ts`, `services/me.service.ts`, `repositories/scans.repo.ts`, `components/ConfirmDialog.tsx`   |
