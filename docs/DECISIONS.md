# Decisiones de arquitectura (ADR)

Formato: decisión · motivo. Añadir al final con `/handoff` cuando se decida algo nuevo (3 líneas).

| #      | Decisión                                                                           | Motivo                                                               |
| ------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| ADR-1  | React (no Vue)                                                                     | Ecosistema, soporte de Capacitor y de Claude Code. Confirmada.       |
| ADR-2  | Supabase (no Firebase)                                                             | PostgreSQL relacional, RLS, modelo de datos relacional.              |
| ADR-3  | Solo el backend habla con DeepSeek                                                 | Protege la API key, centraliza costos, permite cambiar de proveedor. |
| ADR-4  | Interfaz `AiProvider` + adaptador `DeepSeekProvider`                               | Aísla el riesgo del modelo y facilita pruebas con simulados.         |
| ADR-5  | La IA responde solo JSON, validado con Zod; un reintento                           | La salida de un LLM no es confiable.                                 |
| ADR-6  | Imagen comprimida en el cliente (768 px, JPEG ~0,7)                                | Menos latencia, costo y datos móviles.                               |
| ADR-7  | El contenedor lo decide `disposal_rules`, no la IA                                 | Las reglas cambian por municipio.                                    |
| ADR-8  | Escanear sin cuenta; historial y favoritos con cuenta (correo verificado o Google) | Menos fricción en el primer uso.                                     |
| ADR-9  | Backend en Railway (Docker), frontend en Vercel                                    | Decisión del equipo; HTTPS automático en ambos.                      |
| ADR-10 | Monorepo con workspaces `shared` + `backend`; `frontend` se añade en F2            | Contrato único sin duplicar tipos.                                   |
| ADR-11 | `max_tokens` 384 en escaneos; 512 en chat (`DEEPSEEK_CHAT_MAX_TOKENS`, ajustable)  | 384 es poco para pasos de fabricación; se valida en F0/F3.           |
| ADR-12 | Ramas por historia + `STATUS.md` como memoria entre sesiones                       | Metodología de contexto (`METODOLOGIA-CONTEXTO.md`).                 |
| ADR-13 | DeepSeek con `thinking: { type: 'disabled' }` en escaneos y chat                   | El razonamiento consume `max_tokens` y truncaba el JSON; más rápido y barato. |
| ADR-14 | `createApp()` crea el `DeepSeekProvider` de forma perezosa y un rate limiter por instancia | Health y pruebas sin `DEEPSEEK_API_KEY`; cada prueba con su contador. |
| ADR-15 | `disposal_rules` en caché por instancia (TTL 10 min; ante fallo, caché vencida y reintento al minuto; sin caché → `disposal: null`). Con certeza < 0,60 solo se devuelve `disposal` si `requiresDropOff` | Supabase caído no rompe la clasificación; ante la duda, pilas y electrónicos nunca van al contenedor doméstico. |
| ADR-16 | Cualquier fallo de `image` (Zod o `assertValidImage`) → `INVALID_IMAGE`, con prioridad sobre otros campos; `alternatives` las normaliza el backend (sin el principal ni repetidos, ordenadas, máx. 2; la IA tolera 4) | Un solo código para que el cliente ofrezca «Repetir foto»; no se depende de que la IA cumpla el formato. |
| ADR-17 | El frontend lee `shared` por alias de Vite y `paths` de tsconfig (no dependencia `"*"`); `zod` es dependencia directa del frontend y `shared/tsconfig.json` es autónomo | Vercel puede construir solo con `frontend/` y `shared/`, sin la raíz; verificado en una copia aislada (pruebas + build que importa `src/api`). |
