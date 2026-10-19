# Frontend — reglas específicas

- Stack: React 19 + Vite 8 + TypeScript 5.9 + Tailwind 4 (Mobile-First) + React Router 8 + Zustand 5. `vite-plugin-pwa` (HU-01); Supabase, en F4.
- Contrato: `import … from '@ecoclasifica/shared'` resuelve por **alias de Vite y `paths` de tsconfig** hacia `../shared/src` (ADR-17). No es una dependencia del `package.json`: no la añadas. `zod` es dependencia directa (v3, la misma API que `shared`).
- No redefinir tipos de la API. Para el cuerpo de una solicitud usa `z.input<typeof scanRequestSchema>`.
- API: solo a través de `src/api/client.ts` (timeout de 25 s, respuesta validada con Zod). Errores → `ApiError` con `code` y mensaje en español (`src/api/errors.ts`); muestra `err.message`, nunca el texto del backend.
- Estructura: `src/app` (router), `src/api`, `src/features/{home,camera,classify,upcycle,chat,history,favorites,auth}`, `src/styles`, `src/test`.
- Paleta (tokens en `src/styles/index.css`): `lima` solo acentos y botones grandes, **nunca texto sobre blanco**; `hoja` solo en texto grande (≥ 24 px); `bosque` y `petroleo` para texto normal.
- Objetivos táctiles ≥ 48 px: `min-h-tactil` / `min-w-tactil`. Tema claro, contraste AA, textos en español.
- Cámara: `getUserMedia` con cámara trasera; galería si se niega el permiso. Imagen comprimida en `canvas` (768 px, JPEG 0,7 → 0,5 hasta ≤ 300 KB) con `features/camera/compressImage.ts`; la foto lista vive en `photoStore` (Zustand).
- PWA (HU-01): manifiesto en `src/pwa/manifest.ts`, precache del app shell y **NetworkOnly para `/api/*`**. Nunca cachear escaneos. Red: `useOnlineStatus` (`src/pwa`); en pruebas, `setOnline()` de `src/test/network.ts`. `virtual:pwa-register/react` se simula con `vi.mock`. Íconos: `npm run icons`.
- Pruebas: Vitest 5 + Testing Library + jsdom. Inyecta `fetchFn` en `createApiClient`; no llames al backend real.
- Los matchers de jest-dom se registran en `src/test/setup.ts` con `expect.extend`: **no** uses `@testing-library/jest-dom/vitest` (cargaría el Vitest 2 del backend).
