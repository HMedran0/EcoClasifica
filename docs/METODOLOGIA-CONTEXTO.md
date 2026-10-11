# Metodología de uso eficiente de tokens y contexto

Objetivo: que cada sesión de Claude Code gaste solo los tokens que la tarea necesita, sin perder continuidad entre sesiones. Se lee una vez; las reglas operativas ya están resumidas en `CLAUDE.md`.

## 1. Principios

1. **El contexto es un presupuesto, no un archivo.** Todo lo que se lee o se imprime ocupa espacio y se paga en cada turno siguiente. Se carga lo mínimo, justo a tiempo.
2. **La memoria del proyecto vive en archivos, no en la conversación.** Lo que importa entre sesiones se escribe en `docs/STATUS.md`; la conversación se descarta.
3. **Una sesión, una historia.** Sesiones cortas y enfocadas rinden más que una sesión larga que arrastra todo.
4. **Lo estable arriba, lo volátil abajo.** `CLAUDE.md` casi no cambia (mantiene la caché del prefijo); el estado cambiante va en `STATUS.md`, que se lee bajo demanda.
5. **Delegar lo ruidoso.** Búsquedas amplias y revisiones largas van a subagentes que devuelven un resumen.

## 2. Capas de contexto

| Capa        | Archivo                                             | Cuándo se carga                      | Tamaño objetivo |
| ----------- | --------------------------------------------------- | ------------------------------------ | --------------- |
| Permanente  | `CLAUDE.md`                                         | Siempre, al iniciar la sesión        | ≤ 120 líneas    |
| Por carpeta | `backend/CLAUDE.md`, `frontend/CLAUDE.md`           | Al trabajar en esa carpeta           | ≤ 40 líneas     |
| Estado      | `docs/STATUS.md`                                    | Al iniciar (`/status`)               | ≤ 40 líneas     |
| Mapa        | `docs/INDEX.md`                                     | Cuando se duda qué leer              | ≤ 60 líneas     |
| Historia    | sección de `docs/historias.md`                      | Con `/story HU-xx` (solo su sección) | ~15 líneas      |
| Referencia  | `docs/api.md`, `modelo-datos.md`, `arquitectura.md` | Solo la sección necesaria (Grep)     | Bajo demanda    |
| Histórico   | `docs/DECISIONS.md`, `BACKLOG.md`                   | Casi nunca; el handoff las actualiza | —               |

Regla: **si un archivo supera su tamaño objetivo, se divide o se resume**, no se ignora.

## 3. Ciclo de vida de una sesión

```text
/status  →  /story HU-xx  →  trabajo (plan → pruebas → código → check)  →  /handoff  →  /clear
```

1. **Inicio:** `/status` lee solo `STATUS.md` y propone la siguiente acción (≈ 1 000 tokens).
2. **Historia:** `/story HU-xx` carga la sección de la historia y solo los archivos del `INDEX.md` para esa historia.
3. **Plan corto:** si toca más de 3 archivos, plan de ≤ 10 líneas y confirmación antes de codificar. Evita rehacer trabajo.
4. **Implementación:** contrato en `shared` → pruebas → código → `npm run check`.
5. **Cierre:** `/handoff` reescribe `STATUS.md` (reemplaza, no acumula), actualiza `BACKLOG.md` y propone el commit.
6. **Limpieza:** `/clear` antes de la siguiente historia. La nueva sesión arranca con ~3–5 mil tokens de contexto, no con 80 mil.

## 4. Umbrales de contexto

Consultar con `/context` (o `/ctx-audit`). Referencia sobre la ventana disponible:

| Uso                | Acción                                                            |
| ------------------ | ----------------------------------------------------------------- |
| < 40 %             | Seguir.                                                           |
| 40–60 %            | Terminar el paso actual; considerar `/compact` con instrucciones. |
| > 60 %             | `/handoff` y `/clear`. No seguir acumulando.                      |
| Cambio de historia | Siempre `/clear`, sin importar el uso.                            |

Instrucción tipo para `/compact`: _"Conserva: historia en curso, decisiones tomadas, archivos modificados y siguiente paso. Descarta salidas de comandos y exploraciones."_

## 5. Higiene de lectura y salida

- **Leer lo mínimo:** `Grep` primero, luego `Read` con `offset` y `limit`. Nunca abrir un archivo entero "por si acaso".
- **Salidas cortas:** `npm test -w backend -- --reporter=dot`, `| tail -n 30`, `git diff --stat` antes de `git diff`.
- **Sin ruido:** `.claude/settings.json` bloquea la lectura de `node_modules`, `dist`, `package-lock.json` y `.env`.
- **No repetir:** no volver a leer un archivo que ya se editó en la sesión; el cambio quedó registrado.
- **Pegar poco:** al reportar un error, solo las 10–20 líneas relevantes de la traza.
- **Imágenes:** en el desarrollo de la IA, usar fotos de prueba pequeñas (≤ 300 KB), igual que en producción.

## 6. Ruteo de modelos y subagentes

Usar el modelo más barato que resuelva la tarea (cambiar con `/model`):

| Tarea                                                               | Modelo sugerido      |
| ------------------------------------------------------------------- | -------------------- |
| Implementar una historia con plan claro, refactors, pruebas         | Sonnet (por defecto) |
| Decisiones de arquitectura, depuración difícil, cambios de contrato | Opus                 |
| Búsquedas, renombrados, tareas mecánicas, escribir pruebas          | Haiku (subagente)    |

Subagentes incluidos (`.claude/agents/`):

- `code-reviewer`: revisa `git diff` y devuelve ≤ 15 líneas. Úsalo antes de commits grandes.
- `test-writer`: escribe pruebas de un módulo ya hecho sin llenar el contexto principal.
- `Explore` (integrado): para "¿dónde está X?" en muchos archivos; devuelve solo la conclusión.

Regla: si una tarea implica leer más de ~5 archivos solo para entender algo, va a un subagente.

## 7. Presupuesto de tokens por tipo de sesión (referencia)

| Sesión                                        | Contexto inicial esperado | Meta de duración |
| --------------------------------------------- | ------------------------- | ---------------- |
| Historia pequeña (un endpoint, un componente) | 4–6 mil                   | 1 sesión corta   |
| Historia mediana (flujo completo A o B)       | 6–10 mil                  | 1–2 sesiones     |
| Spike de IA (F0)                              | 3–5 mil                   | 1 sesión         |
| Revisión / refactor                           | 5–8 mil                   | 1 sesión         |

Si una historia necesita más de 2 sesiones, se parte en subhistorias en `BACKLOG.md` antes de seguir.

## 8. Ahorro de tokens en el producto (llamadas a DeepSeek)

El mismo criterio aplica al código que se construye:

- `max_tokens` 384 en escaneos; chat con `DEEPSEEK_CHAT_MAX_TOKENS` (512, ajustable).
- Imagen comprimida en el cliente (768 px, JPEG ~0,7, ≤ 300 KB).
- Chat solo con texto y máximo 10 mensajes (`MAX_CHAT_MESSAGES`).
- Prompts de sistema cortos y estables, en `backend/src/services/ai/prompts.ts`.
- Registrar `promptTokens` y `completionTokens` por llamada en `ai_usage` y revisar el consumo semanal.
- Cuota diaria por usuario (`daily_scan_quota`) y rate limit por IP.

## 9. Definición de "listo para empezar" y "terminado"

**Listo para empezar una historia:** sección de la historia leída, rama creada, archivos a tocar identificados, plan aprobado si toca > 3 archivos.

**Terminada:**

- Criterios de aceptación de la historia cumplidos.
- Esquemas en `shared` actualizados y `docs/api.md` al día si cambió el contrato.
- `npm run check` en verde.
- Sin secretos, imágenes ni Base64 en logs.
- `/handoff` ejecutado (STATUS y BACKLOG actualizados) y commit hecho.

## 10. Errores comunes a evitar

| Error                                    | Costo                                  | Corrección                          |
| ---------------------------------------- | -------------------------------------- | ----------------------------------- |
| Sesión de varias historias               | Contexto inflado, mezcla de decisiones | Una historia por sesión             |
| Leer `docs/` completo al empezar         | 20–30 mil tokens inútiles              | `/status` + `INDEX.md`              |
| Pegar logs completos                     | Miles de tokens por turno              | `tail`, filtrar, 10–20 líneas       |
| Editar `CLAUDE.md` en medio de la sesión | Invalida la caché del prefijo          | Editar entre sesiones               |
| `STATUS.md` como diario                  | Crece sin control                      | Reescribirlo completo (≤ 40 líneas) |
| Explorar el repo "para entender"         | Muchos archivos leídos                 | Subagente `Explore`                 |
| Seguir al 80 % de contexto               | Respuestas peores y más caras          | `/handoff` y `/clear` al 60 %       |
