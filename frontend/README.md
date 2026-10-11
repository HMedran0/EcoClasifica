# Frontend (se crea en la fase F2)

Todavía no hay proyecto Vite. Pasos para crearlo en la sesión de F2 (Claude Code los ejecuta):

1. Crear el proyecto dentro de esta carpeta (conservando `CLAUDE.md`, `vercel.json` y `.env.example`):
   `npm create vite@latest frontend -- --template react-ts` desde la raíz y mover el contenido, o crearlo en una carpeta temporal y copiarlo aquí.
2. Nombrar el paquete `@ecoclasifica/frontend` y añadir `"frontend"` a `workspaces` en el `package.json` raíz.
3. Dependencias: `@ecoclasifica/shared` (`"*"`), `react-router-dom`, `zustand`, `@supabase/supabase-js`, `tailwindcss`, `vite-plugin-pwa`.
4. Configurar `vite-plugin-pwa`: `registerType: 'prompt'`, manifiesto (`display: standalone`, íconos 192/512 y _maskable_), Workbox con precache del app shell y `NetworkOnly` para `/api/*`.
5. Estructura por funcionalidades (`src/features/{camera,classify,upcycle,chat,history,favorites,auth}`), ver `docs/arquitectura.md`.
6. Despliegue en Vercel: directorio raíz `frontend/`, comando `vite build`, variables `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

Historias de esta fase: HU-01, HU-02, HU-03 (ver `docs/BACKLOG.md`).
