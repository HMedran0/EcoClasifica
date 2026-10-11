---
description: Cierra la sesión: actualiza docs/STATUS.md y BACKLOG.md y propone el commit
---

Cierra la sesión de trabajo:

1. Ejecuta `npm run check` (últimas 30 líneas). Si falla, dilo y no marques la historia como terminada.
2. Reescribe `docs/STATUS.md` completo, en **máximo 40 líneas**, con: fase actual, historia en curso o terminada, decisiones tomadas hoy, problemas abiertos y la **siguiente acción concreta**. No es un diario: reemplaza el contenido anterior.
3. Actualiza la fila de la historia en `docs/BACKLOG.md` (estado: Pendiente, En curso o Hecha).
4. Si se tomó una decisión de arquitectura nueva, añádela como ADR al final de `docs/DECISIONS.md` (3 líneas).
5. Muestra `git status` corto y propone el mensaje del commit (Conventional Commits). Haz el commit solo si el usuario lo confirma.
6. Termina con: "Sesión cerrada. Usa /clear antes de la próxima historia."
