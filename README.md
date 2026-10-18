# EcoClasifica

PWA móvil (Android primero) que usa visión por computadora para decirte en qué contenedor depositar un residuo, o cómo darle una segunda vida (upcycling), con un chat paso a paso para fabricar la idea elegida.

- **Municipio inicial:** San Juan Nepomuceno (Bolívar, Colombia)
- **Idioma:** español
- **Estado del proyecto:** ver [`docs/STATUS.md`](docs/STATUS.md)

## Stack

| Capa                | Tecnología                                               | Despliegue  |
| ------------------- | -------------------------------------------------------- | ----------- |
| Frontend            | React + Vite + TypeScript + Tailwind + `vite-plugin-pwa` | Vercel      |
| Backend             | Node.js 22 + Express + TypeScript                        | Railway     |
| Datos y auth        | Supabase (PostgreSQL, Auth, Storage)                     | Supabase    |
| IA                  | DeepSeek (visión, imagen en Base64, `max_tokens` 384)    | API externa |
| App nativa (futuro) | Capacitor                                                | Google Play |

## Estructura

```text
ecoclasifica/
├── CLAUDE.md              # contexto permanente para Claude Code (corto, estable)
├── .claude/               # comandos, subagentes y permisos de Claude Code
├── docs/                  # documentación; empieza por docs/INDEX.md
├── shared/                # contrato único: esquemas Zod y constantes
├── backend/               # API Express (capas routes → controllers → services → repositories)
├── frontend/              # PWA (se crea en la fase F2)
└── supabase/              # migraciones SQL y semilla de reglas
```

## Inicio rápido

Requisitos: Node 20.12 o superior (recomendado 22), npm 10 y una cuenta de Supabase.

```bash
npm install
cp .env.example .env        # completar DEEPSEEK_API_KEY, SUPABASE_*
npm run dev:api             # API en http://localhost:3000/api/health
npm run check               # typecheck + lint + pruebas
```

Prueba de la IA con una foto real (fase F0):

```bash
npm run spike:ai -- ./foto.jpg classify
npm run spike:ai -- ./foto.jpg upcycle
```

Base de datos: ejecutar `supabase/migrations/0001_init.sql` y luego `supabase/seed.sql` en el SQL Editor de Supabase (o con la CLI de Supabase).

## Trabajo con Claude Code

El proyecto está preparado para desarrollarse con Claude Code gastando poco contexto:

1. Lee [`docs/METODOLOGIA-CONTEXTO.md`](docs/METODOLOGIA-CONTEXTO.md) (una vez).
2. Abre una sesión en la raíz y pega el prompt de [`docs/INICIO-CLAUDE-CODE.md`](docs/INICIO-CLAUDE-CODE.md).
3. Una sesión por historia de usuario; al terminar, ejecuta `/handoff`.

## Despliegue

Guía paso a paso (orden, variables, dominios y prueba de humo): [`docs/despliegue.md`](docs/despliegue.md).

- **Backend (Railway):** `railway.json` apunta a `backend/Dockerfile`; healthcheck en `/api/health`. Cargar las variables del `.env.example` en el panel.
- **Frontend (Vercel):** directorio raíz `frontend/`, comando `vite build`, `frontend/vercel.json` ya incluye la reescritura para React Router.
- Definir `ALLOWED_ORIGINS` en Railway con el dominio de Vercel, y `VITE_API_URL` en Vercel con el dominio de Railway.

## Convenciones

Commits en formato Conventional Commits, una rama por historia (`feat/HU-05-clasificar`). Detalles en `CLAUDE.md`.
