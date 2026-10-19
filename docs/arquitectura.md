# Arquitectura

## Visión

```text
[PWA React · Vercel] ──HTTPS──> [API Express · Railway] ──> [DeepSeek (visión)]
        │                              │
        └── Supabase Auth (JWT) ───────┴──> [Supabase: Postgres · Storage]
```

El cliente nunca llama a DeepSeek: la API key vive solo en el backend (ADR-3).

## Flujo de clasificación

1. El cliente comprime la foto (768 px, JPEG ~0,7) y la envía en Base64 a `/scan/classify`.
2. El backend valida con Zod, verifica el MIME por bytes y aplica rate limit.
3. `ai.service` llama a `AiProvider.classify`, valida la salida con Zod y reintenta una vez si es inválida.
4. `classification.service` resuelve la regla en `disposal_rules` (municipio → `DEFAULT`).
5. Si hay sesión: guarda imagen y escaneo; responde con resultado y contenedor.

## Estructura

```text
ecoclasifica/
├── CLAUDE.md · README.md · railway.json · package.json (workspaces: shared, backend)
├── .claude/ (settings.json, commands/, agents/)
├── docs/
├── shared/src/ { schemas/, constants/, index.ts }
├── backend/
│   ├── Dockerfile · tsup · vitest
│   ├── scripts/spike-deepseek.ts
│   └── src/ { server.ts, app.ts, config/, routes/, controllers/, services/{ai/,...}, repositories/, middlewares/, utils/ }
├── frontend/ (se crea en F2) { src/{api,features,components,store,lib,pwa}, vercel.json }
└── supabase/ { migrations/, seed.sql }
```

## Decisiones (resumen; ver `DECISIONS.md`)

React · Supabase · backend como único cliente de IA · interfaz `AiProvider` · IA devuelve JSON validado con Zod · reglas de contenedor en datos · imagen comprimida en el cliente.

## Despliegue

- **Railway (backend):** `railway.json` → `backend/Dockerfile`; escucha `process.env.PORT`; healthcheck `/api/health`; `trust proxy` = 1.
- **Vercel (frontend):** raíz `frontend/`, `vite build`, `vercel.json` con reescritura a `index.html`. HTTPS automático (requisito de cámara y PWA).
- **Variables:** ver `.env.example`. `ALLOWED_ORIGINS` (Railway) incluye el dominio de Vercel; `VITE_API_URL` (Vercel) apunta a Railway.
- **Supabase:** ejecutar `0001_init.sql` y `seed.sql`; configurar proveedor Google y confirmación de correo obligatoria en Auth.

## PWA

`display: standalone`, manifiesto en `frontend/src/pwa/manifest.ts` (`lang: es-CO`, `theme_color` bosque, `background_color` fondo). Íconos en `public/icons/` (192/512, _maskable_ 512 con fondo sólido y zona segura, apple-touch 180, favicon sin el símbolo de reciclaje), generados con `npm run icons -w frontend` desde `public/brand/logo.svg` y `frontend/pwa-assets/*.svg`; los PNG se versionan. Service Worker (Workbox) con precache del app shell, `navigateFallback` a `index.html` y _NetworkOnly_ para `/api/*`: nunca se cachean escaneos ni fotos. `registerType: 'prompt'` con aviso «Hay una versión nueva». Sin red: `OfflineBanner` y «Escanear residuo» deshabilitado. `vercel.json` sirve `sw.js` y el manifiesto con `no-cache`. Ruta a Google Play con Capacitor; la cámara puede migrar a `@capacitor/camera` sin cambiar el contrato de API.
