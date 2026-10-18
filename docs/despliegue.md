# Despliegue (Railway + Vercel)

Ambos despliegan la rama `main` automáticamente. Railway espera a que pase el CI (`.github/workflows/ci.yml`).

## Dominios de producción

| Servicio          | Dominio                                               |
| ----------------- | ----------------------------------------------------- |
| Backend (Railway) | https://ecoclasificabackend-production.up.railway.app |
| Frontend (Vercel) | https://eco-clasifica.vercel.app                      |

## Orden (la primera vez)

1. **Railway primero:** el frontend necesita su dominio al compilar.
2. **Vercel después**, con `VITE_API_URL` = dominio de Railway.
3. **De vuelta en Railway:** añade el dominio de Vercel a `ALLOWED_ORIGINS` (se redespliega solo).
4. Prueba de humo (abajo).

## 1. Railway (backend)

- Nuevo proyecto → _Deploy from GitHub repo_ → rama `main`. Directorio raíz: **la raíz del repo** (no `backend/`).
  `railway.json` ya fija el `Dockerfile` (`backend/Dockerfile`) y el healthcheck `/api/health`.
- Settings → _Wait for CI_ activado.
- Settings → Networking → _Generate Domain_. No definas `PORT`: Railway la inyecta.
- Variables:

| Variable                                           | Valor                                                                         |
| -------------------------------------------------- | ----------------------------------------------------------------------------- |
| `NODE_ENV`                                         | `production`                                                                  |
| `DEEPSEEK_API_KEY`                                 | secreta                                                                       |
| `DEEPSEEK_MODEL`, `DEEPSEEK_BASE_URL`              | solo si difieren del valor por defecto                                        |
| `SUPABASE_URL`                                     | `https://<proyecto>.supabase.co` (**sin** `/rest/v1`)                         |
| `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` | secretas                                                                      |
| `ALLOWED_ORIGINS`                                  | `https://eco-clasifica.vercel.app` (varios separados por coma; sin `/` final) |
| `DEFAULT_MUNICIPALITY_CODE`                        | `13657`                                                                       |

## 2. Vercel (frontend)

- _Add New Project_ → mismo repositorio → **Root Directory: `frontend`**. Framework: Vite (build `npm run build`, salida `dist`).
- Comprueba que esté activo _Include source files outside of the Root Directory_ (viene activo por defecto; el contrato se importa de `../shared/src`, ADR-17).
- Variables (se publican en el bundle: **nunca secretos**):

| Variable                                      | Valor                              |
| --------------------------------------------- | ---------------------------------- |
| `VITE_API_URL`                                | dominio de Railway, con `https://` |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | llegan en F4                       |

Sin `VITE_API_URL` el build de producción **falla a propósito** (`vite.config.ts`); antes, la app llamaba a su propio dominio.
Cambiar una variable `VITE_*` exige redesplegar: se fijan al compilar.

## 3. Prueba de humo

```bash
API=https://ecoclasificabackend-production.up.railway.app
WEB=https://eco-clasifica.vercel.app

curl -s $API/api/health                      # {"status":"ok",...}

# CORS: el origen permitido recibe Access-Control-Allow-Origin; otro origen no recibe la cabecera.
curl -s -o /dev/null -D - -X OPTIONS $API/api/v1/scan/classify \
  -H "Origin: $WEB" -H "Access-Control-Request-Method: POST" | grep -i access-control-allow-origin
```

En el navegador, la pantalla inicial muestra un punto **«Servicio disponible»** (verde) o **«Sin conexión»** (rojo):
es un `GET /api/health` real desde el dominio de Vercel.

## Verificar en local lo que harán las plataformas

```bash
docker build -f backend/Dockerfile -t ecoclasifica-api .     # lo que hace Railway
docker run --rm -e PORT=8091 -p 8091:8091 ecoclasifica-api   # luego curl localhost:8091/api/health
cd frontend && VITE_API_URL=https://ejemplo.up.railway.app npm run build   # lo que hace Vercel
```

## Fallos típicos

| Síntoma                                                          | Causa probable                                                                    |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| «Sin conexión» en Vercel, pero `curl` a `/api/health` responde   | `ALLOWED_ORIGINS` sin el dominio exacto de Vercel (esquema, sin `/` final)        |
| `/api/health` 200 pero clasificar da 500 `INTERNAL_ERROR` rápido | Secreto vacío (p. ej. `DEEPSEEK_API_KEY`); buscar el `requestId` en _Deploy Logs_ |
| El origen de Vercel no recibe `Access-Control-Allow-Origin`      | `ALLOWED_ORIGINS` con el valor por defecto `http://localhost:5173`                |
| El build de Vercel falla con «VITE_API_URL debe ser…»            | Falta la variable en Vercel                                                       |
| Vercel no encuentra `@ecoclasifica/shared`                       | _Include source files outside of the Root Directory_ desactivado                  |
| Railway no despliega tras el push                                | El CI falló (_Wait for CI_)                                                       |
| Healthcheck de Railway falla                                     | Variable con formato inválido (p. ej. `SUPABASE_URL` con ruta); ver logs          |
| Las vistas previas de Vercel dan «Sin conexión»                  | Normal: su dominio no está en `ALLOWED_ORIGINS`                                   |
