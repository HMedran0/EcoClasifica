# EcoClasifica — contexto para Claude Code

PWA Android que clasifica residuos con IA (Modo Clasificar) y propone ideas de segunda vida con chat (Modo Dar Segunda Vida). Idioma: español. Municipio inicial: San Juan Nepomuceno.

Stack: React + Vite + Tailwind (Vercel) · Node/Express + TypeScript (Railway) · Supabase (Postgres, Auth, Storage) · DeepSeek visión (Base64, `max_tokens` 384).

## Reglas de sesión (obligatorias)

1. **Al empezar:** lee solo `docs/STATUS.md`. No leas `docs/` completo.
2. **Una sesión = una historia (HU-xx) = una rama.** No mezcles historias.
3. **Contexto bajo demanda:** consulta `docs/INDEX.md` para saber qué archivo cargar según la tarea. Para una historia, usa `Grep` con `-A 15` sobre `docs/historias.md`; nunca leas el archivo entero.
4. **Antes de codificar:** si la tarea toca más de 3 archivos, propone un plan de máximo 10 líneas y espera confirmación.
5. **Al terminar:** ejecuta `/handoff` (actualiza `docs/STATUS.md`, propone el commit). Luego el usuario hará `/clear`.
6. Metodología completa: `docs/METODOLOGIA-CONTEXTO.md` (no la cargues salvo que se pida).

## Comandos

```bash
npm run dev:api        # API en :3000
npm run check          # typecheck + lint + test (obligatorio antes de commit)
npm test -w backend -- --reporter=dot   # solo pruebas del backend, salida corta
npm run spike:ai -- ./foto.jpg classify # prueba real contra DeepSeek (F0)
```

## Arquitectura en 10 líneas

- Monorepo npm workspaces: `shared` (contrato Zod), `backend`, `frontend` (se crea en F2).
- El **contrato vive en `shared/src/schemas`**. Nunca dupliques tipos de request/response.
- Backend por capas: `routes → controllers → services → repositories`. Solo `services/ai` conoce al proveedor de IA (interfaz `AiProvider`, adaptador `DeepSeekProvider`).
- La IA responde JSON; se valida con Zod, se reintenta una vez, y si falla → `AI_BAD_RESPONSE`.
- El contenedor lo decide la tabla `disposal_rules` (no la IA). Certeza < 0,60 → `lowConfidence`.
- El backend usa la **service role key de Supabase, que salta RLS**: toda consulta debe filtrar por `req.user.id`.
- La imagen se comprime en el cliente (768 px, JPEG ~0,7) y solo se guarda si el usuario inició sesión.
- Errores con forma `{ error: { code, message, requestId } }` (códigos en `shared/src/schemas/errors.ts`).
- Detrás de Railway: `trust proxy` activo. Escuchar `process.env.PORT`.
- Frontend en Vercel; `VITE_API_URL` apunta a Railway; CORS por `ALLOWED_ORIGINS`.

## Reglas de código

- TypeScript estricto. Sin `any` (usa `unknown` y valida con Zod).
- Funciones pequeñas, nombres en inglés en código, textos de usuario en español.
- Pruebas con Vitest. **Nunca llames a DeepSeek real en pruebas**: usa un `AiProvider` simulado.
- Todo endpoint nuevo: esquema Zod en `shared`, validación con `validate()`, prueba de integración con Supertest.
- Nada de secretos en el repo, logs ni respuestas. No registres imágenes ni Base64 en logs.
- Commits: Conventional Commits (`feat(scan): ...`), ramas `feat/HU-05-clasificar`.

## Ahorro de contexto (resumen; detalle en METODOLOGIA-CONTEXTO.md)

- Lee con `Grep`/`Read` usando `offset` y `limit`; no abras archivos enteros "por si acaso".
- Limita salidas de comandos (`| tail -n 30`, `--reporter=dot`). No pegues logs largos.
- Delega búsquedas amplias a un subagente (`Explore`) y trabaja con su resumen.
- No edites este archivo durante una sesión (rompe la caché del prefijo). Cambios aquí → entre sesiones.
- Si el contexto pasa del ~60 %: `/handoff` y `/clear`. No acumules sesiones largas.

## No hacer

- No instalar dependencias nuevas sin justificarlas en el commit.
- No cambiar el contrato (`shared`) sin actualizar `docs/api.md` y las pruebas.
- No tocar `supabase/migrations/0001_init.sql`; los cambios van en migraciones nuevas numeradas.
- No leer `.env`, `node_modules`, `dist` ni `package-lock.json` (bloqueado en `.claude/settings.json`).

## Archivos de contexto por carpeta

`backend/CLAUDE.md` y `frontend/CLAUDE.md` se cargan solos al trabajar en esas carpetas.
