# Estado del proyecto

_Actualizado: 2026-10-18 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F2 — Frontend: por empezar.** F1 cerrada: `/phase-check` cumplido y HU-07 mergeada en `main` (`aa50515`).
Orden de F2 (BACKLOG): base → despliegue → HU-02 → HU-17 (pantalla de resultado) → HU-01. HU-03 pasa a F3.

## Hecho en HU-07 (commit `a2af925`, merge `aa50515`)

- `pickAlternatives`: sin material principal ni repetidos (gana la certeza mayor), ordenadas, máx. 2. Contrato `.max(2)`; la IA tolera 4.
- Prompt de clasificación: alternativas distintas, ordenadas y obligatorias si confidence < 0,6. **Costo: ~24 tokens de entrada más por escaneo.**
- Fallo de Zod en `image` → `INVALID_IMAGE` (mensaje en español, prioridad sobre otros campos); resto → `VALIDATION_ERROR`.
- `NOT_A_WASTE`: registra tokens y latencia, no consulta reglas, nunca se guarda.
- 58 pruebas en verde (umbral 0,59/0,60 incluido). Code-reviewer: sin bloqueantes.
- Prueba real (PORT=3001, dos tandas), prompt anterior → nuevo:
  - botella: plástico 0,98 → 0,97 (ruido, aceptado), contenedor blanco; 974 → 998 tokens de entrada.
  - frasco: vidrio 0,95, contenedor blanco; 416 → 440 tokens.
  - dificil: 422 `NOT_A_WASTE`; 439 tokens.

## Decisiones

- ADR-16 (nuevo): un solo código `INVALID_IMAGE`; las alternativas las normaliza el backend.
- «No estoy seguro», alternativas y «Repetir foto» los pinta el frontend si `lowConfidence` (F2).
- ADR-15: caché de reglas; con certeza baja solo se devuelve `disposal` si `requiresDropOff`.
- ADR-14: proveedor IA perezoso. ADR-13: `thinking` off, `max_tokens` 384. Local en `PORT=3001`.

## Problemas abiertos

1. Normativa de contenedores de San Juan Nepomuceno sin confirmar (las filas `13657` copian `DEFAULT`).
2. Una fila mala de `disposal_rules` invalida toda la carga (Zod estricto). Valorar descartar solo esa fila.
3. Upcycle no rechaza no-residuos. Resolver en HU-09.
4. `optionalAuth` y guardado en historial llegan con HU-04. Progreso y cancelar de HU-05 → F2.
5. Con `lowConfidence` y `alternatives` vacío, definir qué muestra el cliente (F2).
6. Métricas de uso: el log de éxito está en el controlador; el de `NOT_A_WASTE`, en el servicio. Unificar.

## Siguiente acción

`/clear` → sesión `chore/F2-base`: crear `frontend/` (Vite + React + Tailwind), añadirlo a `workspaces` y a `npm run check`.

## Pendiente de crear

- `frontend/` (fase F2; ver `frontend/README.md`) y añadirlo a `workspaces`.
