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

| Variable                                               | Valor                                                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `NODE_ENV`                                             | `production`                                                                                                       |
| `DEEPSEEK_API_KEY`                                     | secreta                                                                                                            |
| `DEEPSEEK_MODEL`, `DEEPSEEK_BASE_URL`                  | solo si difieren del valor por defecto                                                                             |
| `SUPABASE_URL`                                         | `https://<proyecto>.supabase.co` (**sin** `/rest/v1`)                                                              |
| `SUPABASE_SERVICE_ROLE_KEY`                            | secreta                                                                                                            |
| `ALLOWED_ORIGINS`                                      | `https://eco-clasifica.vercel.app` (obligatoria; varios separados por coma; `https` y sin `/` final)               |
| `DEFAULT_MUNICIPALITY_CODE`                            | `13657`                                                                                                            |
| `IP_HASH_SALT`                                         | secreta, ≥ 32 caracteres (obligatoria; `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `QUOTA_*`, `AI_DAILY_TOKEN_CAP`, `AI_ANON_TOKEN_SHARE` | solo si difieren de 60/100 (usuario), 30/60 (IP) y 1 000 000 tokens con corte de anónimos al 0,7 (HU-20)           |

## 2. Vercel (frontend)

- _Add New Project_ → mismo repositorio → **Root Directory: `frontend`**. Framework: Vite (build `npm run build`, salida `dist`).
- Comprueba que esté activo _Include source files outside of the Root Directory_ (viene activo por defecto; el contrato se importa de `../shared/src`, ADR-17).
- Variables (se publican en el bundle: **nunca secretos**):

| Variable                 | Valor                               |
| ------------------------ | ----------------------------------- |
| `VITE_API_URL`           | dominio de Railway, con `https://`  |
| `VITE_SUPABASE_URL`      | `https://<proyecto>.supabase.co`    |
| `VITE_SUPABASE_ANON_KEY` | clave publicable `sb_publishable_…` |

Sin estas tres variables el build de producción **falla a propósito** (`vite.config.ts`); antes, la app llamaba a su propio dominio.
Cambiar una variable `VITE_*` exige redesplegar: se fijan al compilar.

### Supabase Auth (HU-04)

- _Authentication → Sign In / Providers_: Email con **Confirm email** activo; Google con Client ID y Secret.
- _URL Configuration_: Site URL = dominio de Vercel. En **Redirect URLs** usa comodín de ruta, `https://eco-clasifica.vercel.app/**` y `http://localhost:5173/**`: la app vuelve a la ruta de origen (`?volver=`), y una URL sin `/**` hace que Supabase redirija a la Site URL.
- El cliente usa PKCE: el enlace de verificación abierto en otro navegador confirma el correo, pero no deja la sesión iniciada (hay que entrar con la contraseña).
- El backend valida el token con `getClaims`: no necesita el secreto JWT (si `SUPABASE_JWT_SECRET` sigue en Railway, bórrala).

### Recuperar contraseña (HU-19)

- El enlace vuelve a `/restablecer`, que ya cubre el comodín `/**` de **Redirect URLs** (no hay que añadir nada).
- Con PKCE el enlace solo funciona en el mismo dispositivo y navegador donde se pidió; en otro, la app lo explica y ofrece «Pedir otro enlace».
- Riesgo aceptado: Supabase limita a un correo por minuto por cuenta. Dos peticiones seguidas a un correo registrado dan «espera», y a uno no registrado no, así que eso podría revelar qué correos existen. La app nunca lo dice en el texto; el límite lo aplica Supabase.
- _Authentication → Emails → Templates → Reset password_ (en español; conserva `{{ .ConfirmationURL }}`):
  - Asunto: `Elige una contraseña nueva para EcoClasifica`
  - Cuerpo:

    ```html
    <h2>Recupera tu cuenta de EcoClasifica</h2>
    <p>
      Pediste elegir una contraseña nueva. Abre este enlace en el mismo teléfono y navegador donde
      lo pediste:
    </p>
    <p><a href="{{ .ConfirmationURL }}">Elegir contraseña nueva</a></p>
    <p>
      El enlace vence pronto y solo sirve una vez. Si no lo pediste, ignora este correo: tu
      contraseña no cambia.
    </p>
    ```

### Correo de Auth: SMTP con Gmail (F5)

Sin dominio propio por ahora (proyecto universitario): el SMTP por defecto de Supabase solo envía unos pocos correos por hora, así que se usa una cuenta de Gmail.

- En la cuenta de Gmail: activa la verificación en dos pasos y crea una **contraseña de aplicación** (16 caracteres). Es secreta: solo va en Supabase, nunca en el repo.
- _Authentication → Emails → SMTP Settings_: host `smtp.gmail.com`, puerto `465`, usuario = la dirección de Gmail completa, contraseña = la de aplicación. El remitente debe ser esa misma dirección.
- Límite de Gmail: unos 500 destinatarios al día, de sobra para el piloto. Prueba con un registro real y revisa la carpeta de spam.

### Google OAuth en modo de prueba (F5)

- La app de Google queda en **Testing**, sin publicar ni verificar (exigiría dominio propio).
- _Google Auth Platform → Audience → Test users_: añade el correo de Google de cada participante del piloto. Máximo **100** en total (los eliminados siguen contando).
- Quien no esté en la lista ve «Acceso bloqueado» al entrar con Google; puede usar correo y contraseña.
- La pantalla de consentimiento muestra el dominio `<proyecto>.supabase.co`: es normal sin dominio propio.

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

| Síntoma                                                              | Causa probable                                                                                                                      |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| «Sin conexión» en Vercel, pero `curl` a `/api/health` responde       | `ALLOWED_ORIGINS` sin el dominio exacto de Vercel (esquema, sin `/` final)                                                          |
| `/api/health` 200 pero clasificar da 500 `INTERNAL_ERROR` rápido     | Secreto vacío (p. ej. `DEEPSEEK_API_KEY`); buscar el `requestId` en _Deploy Logs_                                                   |
| Railway no arranca: «Configuración inválida. Faltan: … Inválidas: …» | La variable nombrada falta, está vacía o, en `ALLOWED_ORIGINS`, algún origen no es `https://dominio` exacto (sin `/` final ni ruta) |
| El build de Vercel falla con «VITE_API_URL debe ser…»                | Falta la variable en Vercel o no empieza por `https://`                                                                             |
| Vercel no encuentra `@ecoclasifica/shared`                           | _Include source files outside of the Root Directory_ desactivado                                                                    |
| Railway no despliega tras el push                                    | El CI falló (_Wait for CI_)                                                                                                         |
| Healthcheck de Railway falla                                         | Variable con formato inválido (p. ej. `SUPABASE_URL` con ruta); ver logs                                                            |
| Las vistas previas de Vercel dan «Sin conexión»                      | Normal: su dominio no está en `ALLOWED_ORIGINS`                                                                                     |
