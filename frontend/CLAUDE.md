# Frontend — reglas específicas

Aún no está creado el proyecto Vite (se hace en la fase F2, ver `frontend/README.md`).

- Stack: React 18 + Vite + TypeScript + Tailwind (Mobile-First) + `vite-plugin-pwa` + Zustand + React Router.
- Tipos y esquemas: importar de `@ecoclasifica/shared`. No redefinir interfaces de la API.
- Estructura por funcionalidades: `src/features/{camera,classify,upcycle,chat,history,favorites,auth}`.
- Cámara: `getUserMedia` con cámara trasera; alternativa de galería si se niega el permiso.
- Imagen: comprimir en un `canvas` (lado largo 768 px, JPEG ~0,7, objetivo ≤ 300 KB) antes de enviar.
- PWA: `display: standalone`, Service Worker con precache del app shell y **network-only para `/api/*`**. Nunca cachear escaneos.
- Supabase: solo la **anon key** (`VITE_SUPABASE_ANON_KEY`). Nunca la service role.
- Accesibilidad: contraste AA, objetivos táctiles ≥ 48 px, textos en español.
- Pruebas con Vitest + Testing Library; la API se simula con MSW o funciones inyectadas.
