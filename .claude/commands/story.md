---
description: Implementa una historia de usuario con contexto mínimo (ej. /story HU-05)
argument-hint: HU-xx
---

Vas a implementar la historia **$ARGUMENTS**.

1. Carga solo su sección: usa `Grep` con patrón `## $ARGUMENTS` y `-A 15` sobre `docs/historias.md`.
2. Consulta `docs/INDEX.md` y lee únicamente los archivos que la tabla indique para esa historia (con `offset`/`limit` si son largos).
3. Verifica que estás en una rama `feat/$ARGUMENTS-...`; si no, créala.
4. Propón un plan de máximo 10 líneas (archivos a crear o tocar, pruebas) y espera confirmación si toca más de 3 archivos.
5. Implementa primero el contrato en `shared` si cambia, luego pruebas, luego código.
6. Ejecuta `npm run check` mostrando solo las últimas 30 líneas de salida.
7. Cuando todos los criterios de aceptación estén cumplidos, ejecuta `/handoff`.

No leas otras historias, `METODOLOGIA-CONTEXTO.md` ni la documentación completa.
