# Frontend — EcoClasifica

PWA en React 19 + Vite 8 + Tailwind 4. Se despliega en Vercel.

## Comandos (desde la raíz)

```bash
npm run dev:web                   # http://localhost:5173
npm run build -w frontend         # dist/
npm test -w frontend -- --reporter=dot
npm run check                     # typecheck + lint + pruebas de todo el monorepo
npm run check:layout -w frontend  # sin scroll horizontal a 360 y 412 px (con dev:web en marcha; no corre en CI)
```

`VITE_API_URL` (ver `.env.example`) apunta al backend: `http://localhost:3000` en local, Railway en producción.

## Estructura

```
frontend/
├── index.html
├── vite.config.ts        # alias @ecoclasifica/shared → ../shared/src, dedupe de zod, Vitest
├── tsconfig.json         # autónomo; paths hacia ../shared/src y zod
├── dev/                # medir-ancho.html: solo desarrollo, no entra en el build
├── scripts/            # check-overflow.mjs (usa Chrome headless)
├── vercel.json           # SPA rewrites; sin caché para sw.js y el manifiesto
├── public/brand/         # logo.svg (la referencia original está en docs/brand/)
└── src/
    ├── main.tsx
    ├── app/App.tsx       # rutas: / y /resultado
    ├── api/              # client.ts (fetch + timeout 25 s + Zod), errors.ts (código → mensaje)
    ├── features/         # home, classify (y camera, upcycle, chat… según las historias)
    ├── styles/index.css  # Tailwind + tokens de marca (@theme)
    └── test/             # setup de Vitest y tipos de jest-dom
```

## Contrato compartido (ADR-17)

El frontend **no** depende del paquete `@ecoclasifica/shared`: lo lee como código fuente con un alias de Vite y `paths` de tsconfig. Así Vercel puede instalar y construir solo con `frontend/` y `shared/`, sin el `package.json` de la raíz. Por eso `shared/tsconfig.json` es autónomo (no extiende `tsconfig.base.json`).

## Despliegue en Vercel

- Directorio raíz: `frontend/`. Comando de build: `npm run build`. Salida: `dist`.
- Activar **«Include files outside the Root Directory in the Build Step»** (viene activo por defecto): sin `shared/` no hay contrato.
- `VITE_API_URL` es obligatoria en producción: sin ella las llamadas van al propio dominio de Vercel, el rewrite devuelve `index.html` y todo acaba en «respuesta inesperada».
- Variables: `VITE_API_URL` (y en F4 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- En Railway, `ALLOWED_ORIGINS` debe incluir el dominio de Vercel.

## Pendiente por historia

- HU-02: cámara (`features/camera`). HU-17: pantalla de resultado (`features/classify`).
- HU-01: `vite-plugin-pwa`, manifiesto e íconos (incluida la variante _maskable_).
