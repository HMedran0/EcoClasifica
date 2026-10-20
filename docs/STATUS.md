# Estado del proyecto

_Actualizado: 2026-10-19 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F3 — Upcycle:** en curso. HU-09 **hecha** (rama `feat/HU-09-upcycle`, pendiente de commit y merge). F2 cerrada el 2026-10-19.

## HU-09 (solo backend)

- `POST /api/v1/scan/upcycle`: mismo cuerpo, validación, límite y errores que classify. `result` es una unión por `canUpcycle`: `{ objectName, difficulty, ideas[3] }` o `{ objectName, reason }`.
- Exactamente 3 ideas (más → recorta; menos → reintento → 502). Recortes en palabra completa: title 60, description 120, reason 160; extraMaterials ≤ 5. `difficulty` se normaliza («facil», «FÁCIL», «Media»).
- `is_waste: false` → 422 aunque `can_upcycle` venga true. Respaldos del backend en `upcycle.safety.ts` (material peligroso/electronico y términos bloqueados), con `warn`.
- Spike real (384 tokens bastan, ≈ 250 de salida, 2–3 s): frasco y botella → 3 ideas; bolsa-panal → `can_upcycle: false` (gracias a la regla «bolsa cerrada u opaca» del prompt).
- `npm run check` OK (backend 128, frontend 101). `code-reviewer` sin bloqueantes.

## Decisiones

- ADR-23: respaldos de seguridad de upcycle en el backend, 3 ideas exactas, `max_tokens` 384.
- ADR-22: PWA. ADR-21: instrucciones genéricas. ADR-20: prioridad del punto limpio.

## Problemas abiertos

1. **Offline en `/camara` y `/resultado`:** solo el banner; el `NETWORK_ERROR` no dice «requiere internet».
2. Sin aviso «Lista para usar sin conexión» (`offlineReady` sin usar).
3. Solo desarrollo: StrictMode lanza dos `classify` al montar `/resultado`.
4. Prueba intermitente del frontend (sospecha `findBy` de 1 s bajo carga).
5. Rama `fix/arranque-config` pendiente (`''` como faltante, log en Railway, `ALLOWED_ORIGINS`, `https:` en `VITE_API_URL`).
6. Alinear Vitest del backend (v2) con el frontend (v5).
7. Logo: trazado oficial pendiente.
8. Normativa de contenedores de San Juan Nepomuceno sin confirmar.
9. Upcycle: menores del review sin aplicar (no partir emojis al recortar; `parse` final de la respuesta). La bolsa-panal depende del prompt (la IA no ve el pañal).
10. `docs/BACKLOG.md` no pasaba prettier en `main`; se formateó en esta rama.

## Siguiente acción

Commit y merge de `feat/HU-09-upcycle`; desplegar en Railway y probar `/scan/upcycle` en producción. Luego `/story HU-03` (interruptor de modo en la cámara, consume `/scan/upcycle`; con `canUpcycle: false` sugerir Clasificar). Orden de F3: HU-03 → HU-10 → HU-11 → HU-18.
