# Arquitectura de API

Base: `/api/v1` (salud en `/api/health`). JSON siempre. Auth: `Authorization: Bearer <JWT de Supabase>`. El contrato ejecutable vive en `shared/src/schemas/`; este archivo es la referencia legible.

## Endpoints

| Método | Ruta                    | Auth     | Descripción                             |
| ------ | ----------------------- | -------- | --------------------------------------- |
| POST   | `/api/v1/scan/classify` | Opcional | Modo A: clasifica y devuelve contenedor |
| POST   | `/api/v1/scan/upcycle`  | Opcional | Modo B: 3 ideas de segunda vida         |
| POST   | `/api/v1/chat`          | Opcional | Chat paso a paso sobre una idea         |
| GET    | `/api/v1/me`            | Sí       | Perfil del usuario con sesión           |
| GET    | `/api/v1/history`       | Sí       | Escaneos del usuario (paginado)         |
| GET    | `/api/v1/history/:id`   | Sí       | Detalle de un escaneo                   |
| DELETE | `/api/v1/history/:id`   | Sí       | Elimina escaneo e imagen                |
| GET    | `/api/v1/favorites`     | Sí       | Ideas favoritas                         |
| POST   | `/api/v1/favorites`     | Sí       | Guarda una idea (`{ ideaId }`)          |
| DELETE | `/api/v1/favorites/:id` | Sí       | Quita una favorita                      |
| GET    | `/api/health`           | No       | Estado del servicio                     |

Respuesta de `/api/health` (`healthResponseSchema`): `{ status: 'ok', service: 'ecoclasifica-api', time: <ISO 8601> }`. La pantalla inicial la usa como indicador de conexión (prueba de humo de CORS).

Sin token, los endpoints de escaneo funcionan pero no guardan nada (`saved: false`).

### Autenticación (HU-04)

- `optionalAuth` (`/scan/*`, `/chat`): sin cabecera `Authorization` → anónimo; con cabecera y token inválido, vencido o mal formado → `401 UNAUTHORIZED`. Por ahora no se guarda nada aunque haya sesión (guardar: HU-13).
- `requireAuth` (`/me`, historial, favoritos): sin token o inválido → `401 UNAUTHORIZED`.
- El token se valida con `supabase.auth.getClaims(token)`: con claves de firma asimétricas verifica en local contra el JWKS (en caché); con el secreto simétrico (HS256) recurre a `getUser()` (una llamada a Supabase Auth). Rechaza tokens vencidos.
- Con «Confirm email» activo, Supabase no emite sesión a correos sin verificar.
- Los logs ocultan `authorization` y `cookie` (`redact` de pino).
- Cliente web: si un endpoint responde 401 a una petición con token, llama a `refreshSession()`. Si renueva, reintenta una vez con el token nuevo; si la renovación falla (sesión revocada, usuario borrado), cierra la sesión local y reintenta una vez sin token, así que escanear sigue funcionando. Nunca hay más de un reintento.

## GET /me

Respuesta 200 (`meResponseSchema`): `{ "id": "uuid", "email": "ana@ejemplo.com", "displayName": "Ana" }`. `email` sale del token; `displayName`, de `profiles` (filtrado por `req.user.id`; `null` si no hay perfil o nombre).

## POST /scan/classify

Solicitud: `{ image: <base64 sin prefijo>, mimeType: 'image/jpeg', locale?: 'es-CO', municipalityCode?: '13657' }`

Límites: `image` ≤ 5 592 408 caracteres Base64 (4 MB decodificados), `locale` ≤ 35, `municipalityCode` ≤ 20. Se rechazan sin llamar a la IA. Aplican también a `/scan/upcycle` (mismo esquema).

- Cualquier fallo en `image` (falta, no es texto, muy corta, muy grande, Base64 mal formado o tipo real distinto de `mimeType`) → 400 `INVALID_IMAGE`, aunque fallen también otros campos.
- Fallos en los demás campos (`mimeType`, `locale`, `municipalityCode`) con una imagen válida → 400 `VALIDATION_ERROR`.

Respuesta 200:

```json
{
  "scanId": "uuid | null",
  "mode": "classify",
  "result": {
    "object": "Botella de gaseosa",
    "material": "plastico",
    "materialDetail": "PET transparente",
    "confidence": 0.93,
    "lowConfidence": false,
    "alternatives": []
  },
  "disposal": {
    "binCode": "WHITE",
    "binName": "Contenedor blanco (aprovechables)",
    "colorHex": "#F5F5F5",
    "icon": "bin-white",
    "instructions": "Vacíala, aplástala y ponle la tapa.",
    "requiresDropOff": false
  },
  "saved": true
}
```

`disposal` sale de la tabla `disposal_rules` (ADR-7), nunca de la IA; `binName` se devuelve tal como está en la tabla:

- Municipio: `municipalityCode` de la solicitud o, si falta, `DEFAULT_MUNICIPALITY_CODE` (`13657`).
- Resolución: `(material, municipio)` → `(material, 'DEFAULT')` → regla `BLACK` de `DEFAULT` (con advertencia en el log).
- Si `lowConfidence` es `true`, `disposal` es `null` y el cliente muestra las `alternatives` (HU-07), **salvo** que la regla exija punto limpio (`requiresDropOff: true`, p. ej. `electronico` y `peligroso`): entonces se devuelve igual.
- `alternatives`: hasta 2 hipótesis con materiales distintos del principal, sin repetidos y ordenadas de mayor a menor certeza (el backend normaliza lo que diga la IA). Puede venir vacío.
- Con `lowConfidence: true` el cliente muestra «No estoy seguro», las `alternatives` y el botón «Repetir foto» (pantalla de resultado, F2). El umbral es 0,60 (`LOW_CONFIDENCE_THRESHOLD`).
- Si la foto no contiene un residuo → 422 `NOT_A_WASTE`; no se consultan las reglas y el escaneo **nunca** se guarda en el historial (tampoco con sesión).
- Las reglas se cachean en memoria 10 min por instancia. Si Supabase falla se usa la caché vencida (y se reintenta al minuto); sin caché, `disposal` es `null` (error en el log) y la clasificación responde 200 igualmente.

## POST /scan/upcycle

Solicitud igual a classify. Respuesta 200:

```json
{
  "scanId": "uuid | null",
  "mode": "upcycle",
  "result": {
    "canUpcycle": true,
    "objectName": "Frasco de vidrio",
    "difficulty": "Fácil",
    "ideas": [
      {
        "ideaIndex": 0,
        "title": "Portalápices decorado",
        "description": "Forra el frasco con cuerda y píntalo.",
        "extraMaterials": ["Cuerda de yute", "Pegamento"]
      },
      {
        "ideaIndex": 1,
        "title": "Lámpara de luciérnagas",
        "description": "Luces LED pequeñas dentro del frasco.",
        "extraMaterials": ["Tira LED a pilas"]
      },
      {
        "ideaIndex": 2,
        "title": "Mini maceta",
        "description": "Siembra suculentas en capas de grava.",
        "extraMaterials": ["Tierra", "Grava", "Suculenta"]
      }
    ]
  },
  "saved": true
}
```

`result` es una unión por `canUpcycle`. Si el objeto es peligroso (pilas, baterías, medicamentos, químicos, aceites, aerosoles), sanitario (pañales, toallas higiénicas, papel higiénico usado), vidrio roto o una bolsa cerrada cuyo contenido no se ve, no hay ideas ni `difficulty`:

```json
{
  "scanId": null,
  "mode": "upcycle",
  "result": {
    "canUpcycle": false,
    "objectName": "Bolsa de plástico cerrada con contenido",
    "reason": "Bolsa cerrada y opaca: puede ocultar residuos sanitarios o peligrosos."
  },
  "saved": false
}
```

- El cliente sugiere el modo Clasificar cuando `canUpcycle` es `false`.
- Respaldos del backend (fallan hacia lo seguro, aunque la IA dé ideas): `material` de la IA `peligroso` o `electronico`, u `objectName` con un término bloqueado (por palabra, sin mayúsculas ni tildes, admite plural: pila, bateria, medicamento, jeringa, aguja, pañal, toalla higienica, aerosol, insecticida, veneno, quimico, cloro, thinner, gasolina, bombillo, fluorescente, vidrio roto, explosivo, bomba casera, molotov, arma, polvora; «aceite» no) → `canUpcycle: false`. Se registra un `warn` con `objectName`, `material` y la regla.
- Siempre 3 ideas (`ideaIndex` 0–2): si la IA da más, se toman las 3 primeras; si da menos, se reintenta una vez y luego `502 AI_BAD_RESPONSE`.
- Recortes en palabra completa con «…»: `title` ≤ 60, `description` ≤ 120, `reason` ≤ 160 caracteres. `extraMaterials` ≤ 5.
- `difficulty` se normaliza sin distinguir mayúsculas ni tildes («facil», «FÁCIL» → «Fácil»; «Media» → «Medio»).
- Sin residuo → `422 NOT_A_WASTE` (aunque la IA diga `can_upcycle: true`). Misma validación de imagen, límite de peticiones y errores que classify.
- `scanId` es `null` y `saved` es `false` hasta el guardado con sesión (HU-04).

## POST /chat

Solo texto, sesión opcional. Guía paso a paso sobre una idea de upcycle (HU-10, HU-11). Solicitud:

```json
{
  "scanId": "uuid (opcional)",
  "ideaIndex": 0,
  "idea": {
    "objectName": "Frasco de vidrio",
    "title": "Portalápices decorado",
    "description": "Forra el frasco con cuerda y píntalo.",
    "extraMaterials": ["Cuerda de yute", "Pegamento"]
  },
  "messages": [{ "role": "user", "content": "¿Cómo empiezo?" }]
}
```

Respuesta 200: `{ "reply": "1. Lava el frasco…\n2. …", "usage": { "promptTokens": 380, "completionTokens": 210 } }`.

- `idea` la envía el cliente y no es confiable: mismos límites que upcycle (`objectName` ≤ 80, `title` ≤ 60, `description` ≤ 120, `extraMaterials` ≤ 5 de ≤ 60 caracteres). Si `objectName` o `title` tienen un término bloqueado de upcycle → `422 UNSAFE_REQUEST` sin llamar a la IA.
- `messages`: 1 a 50, `role` solo `user` | `assistant` (nunca `system`), `content` de 1 a 1 000 caracteres y el último debe ser del usuario. A la IA solo van los **últimos 10** (control de costos).
- `reply` en texto plano: el backend quita HTML y negritas de markdown; conserva saltos de línea y listas numeradas. Vacía → `502 AI_BAD_RESPONSE`.
- Prompt (`chatSystem`): solo esa manualidad, pasos numerados cortos, advertencias (corte, calor, vidrio, adulto), reconduce lo ajeno, se niega a armas, explosivos, venenos, mezclas peligrosas y almacenar combustibles. Mensajes e idea son datos, no instrucciones.
- `DEEPSEEK_CHAT_MAX_TOKENS` (512), `thinking` desactivado, mismo timeout (`504 AI_TIMEOUT`). Límite propio: 20 mensajes por minuto por IP (`429 RATE_LIMITED`). Sin sesión no se guarda nada (persistencia en `chat_messages`: F4).

## Errores

Forma única: `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`.

| HTTP | `code`              | Cuándo                                         |
| ---- | ------------------- | ---------------------------------------------- |
| 400  | `VALIDATION_ERROR`  | El cuerpo no cumple el esquema (salvo `image`) |
| 400  | `INVALID_IMAGE`     | Falla `image`: falta, tamaño, Base64 o tipo    |
| 401  | `UNAUTHORIZED`      | Token ausente o inválido en endpoint protegido |
| 404  | `NOT_FOUND`         | No existe o no es del usuario                  |
| 413  | `PAYLOAD_TOO_LARGE` | Cuerpo > 6 MB                                  |
| 422  | `NOT_A_WASTE`       | La imagen no contiene un residuo               |
| 422  | `UNSAFE_REQUEST`    | Idea del chat con un término bloqueado         |
| 429  | `RATE_LIMITED`      | Límite por IP o cuota diaria                   |
| 502  | `AI_BAD_RESPONSE`   | JSON inválido o truncado tras el reintento     |
| 504  | `AI_TIMEOUT`        | DeepSeek no respondió en 20 s                  |
| 500  | `INTERNAL_ERROR`    | Error no controlado                            |

## DeepSeek (llamada del backend)

Formato compatible con OpenAI `POST {DEEPSEEK_BASE_URL}/chat/completions` (**confirmar contra la documentación oficial en la fase F0**):

```json
{
  "model": "deepseek-flash",
  "max_tokens": 384,
  "temperature": 0.1,
  "response_format": { "type": "json_object" },
  "messages": [
    { "role": "system", "content": "<prompt de clasificar | upcycle>" },
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "Clasifica el residuo de la imagen." },
        { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,<BASE64>" } }
      ]
    }
  ]
}
```

Salida esperada de la IA al clasificar: `{ is_waste, object, material, material_detail, confidence, alternatives[≤2] }` (el validador tolera hasta 4 alternativas y el backend deja las 2 mejores). Al hacer upcycle: `{ is_waste, can_upcycle, reason, object_name, material, difficulty, ideas[3]: { title, description, extra_materials[≤5] } }` (con `can_upcycle: false` van `ideas: []` y sin `difficulty`; el validador tolera hasta 8 ideas y textos largos, y el backend recorta). Con 384 tokens alcanza: 3 ideas ≈ 240 tokens de salida (spike 2026-10-19). Prompts en `backend/src/services/ai/prompts.ts`.

## Seguridad transversal

- Secretos solo en variables de entorno del servidor.
- Validación Zod de entrada y de la salida de la IA; verificación del MIME por los bytes.
- `express-rate-limit` 10/min por IP en `/scan/*`; cuota diaria por usuario (`ai_usage`).
- CORS por lista blanca (`ALLOWED_ORIGINS`); `helmet`; `trust proxy` = 1 (Railway).
- El texto dentro de la imagen es dato, no instrucción (prompt injection): la salida se valida contra el esquema.
- Imagen guardada solo si hay sesión; bucket privado con URLs firmadas de corta duración.
