# Arquitectura de API

Base: `/api/v1` (salud en `/api/health`). JSON siempre. Auth: `Authorization: Bearer <JWT de Supabase>`. El contrato ejecutable vive en `shared/src/schemas/`; este archivo es la referencia legible.

## Endpoints

| Método | Ruta                    | Auth     | Descripción                             |
| ------ | ----------------------- | -------- | --------------------------------------- |
| POST   | `/api/v1/scan/classify` | Opcional | Modo A: clasifica y devuelve contenedor |
| POST   | `/api/v1/scan/upcycle`  | Opcional | Modo B: 3 ideas de segunda vida         |
| POST   | `/api/v1/chat`          | Opcional | Chat paso a paso sobre una idea         |
| GET    | `/api/v1/history`       | Sí       | Escaneos del usuario (paginado)         |
| GET    | `/api/v1/history/:id`   | Sí       | Detalle de un escaneo                   |
| DELETE | `/api/v1/history/:id`   | Sí       | Elimina escaneo e imagen                |
| GET    | `/api/v1/favorites`     | Sí       | Ideas favoritas                         |
| POST   | `/api/v1/favorites`     | Sí       | Guarda una idea (`{ ideaId }`)          |
| DELETE | `/api/v1/favorites/:id` | Sí       | Quita una favorita                      |
| GET    | `/api/health`           | No       | Estado del servicio                     |

Sin token, los endpoints de escaneo funcionan pero no guardan nada (`saved: false`).

## POST /scan/classify

Solicitud: `{ image: <base64 sin prefijo>, mimeType: 'image/jpeg', locale?: 'es-CO', municipalityCode?: '13657' }`

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

Si `lowConfidence` es `true`, `disposal` es `null` y el cliente muestra las `alternatives` en lugar de un contenedor definitivo (HU-07).

## POST /scan/upcycle

Solicitud igual a classify. Respuesta 200:

```json
{
  "scanId": "uuid | null",
  "mode": "upcycle",
  "result": {
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

## POST /chat

Solo texto. Solicitud: `{ scanId?: uuid, ideaIndex: 0-2, idea: { objectName, title, description, extraMaterials }, messages: [{ role, content }] }` (máximo 10 mensajes, 1 000 caracteres c/u). Respuesta: `{ reply: string, usage: { promptTokens, completionTokens } }`.

## Errores

Forma única: `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`.

| HTTP | `code`              | Cuándo                                         |
| ---- | ------------------- | ---------------------------------------------- |
| 400  | `VALIDATION_ERROR`  | El cuerpo no cumple el esquema                 |
| 400  | `INVALID_IMAGE`     | Falta imagen, tipo no permitido o > 4 MB       |
| 401  | `UNAUTHORIZED`      | Token ausente o inválido en endpoint protegido |
| 404  | `NOT_FOUND`         | No existe o no es del usuario                  |
| 413  | `PAYLOAD_TOO_LARGE` | Cuerpo > 6 MB                                  |
| 422  | `NOT_A_WASTE`       | La imagen no contiene un residuo               |
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

Salida esperada de la IA al clasificar: `{ is_waste, object, material, material_detail, confidence, alternatives[≤2] }`. Al hacer upcycle: `{ object_name, difficulty, ideas[3]: { title, description, extra_materials[≤5] } }`. Prompts en `backend/src/services/ai/prompts.ts`.

## Seguridad transversal

- Secretos solo en variables de entorno del servidor.
- Validación Zod de entrada y de la salida de la IA; verificación del MIME por los bytes.
- `express-rate-limit` 10/min por IP en `/scan/*`; cuota diaria por usuario (`ai_usage`).
- CORS por lista blanca (`ALLOWED_ORIGINS`); `helmet`; `trust proxy` = 1 (Railway).
- El texto dentro de la imagen es dato, no instrucción (prompt injection): la salida se valida contra el esquema.
- Imagen guardada solo si hay sesión; bucket privado con URLs firmadas de corta duración.
