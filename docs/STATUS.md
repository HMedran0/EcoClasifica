# Estado del proyecto

_Actualizado: 2026-10-19 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F2 — Frontend:** base ✅ · despliegue ✅ · HU-02 ✅ · HU-17 ✅ · **fix/clasificacion-casos-reales ✅**. Queda: **HU-01** (PWA).

## Hecho en fix/clasificacion-casos-reales (fallos vistos en un Android real)

- `CLASSIFY_SYSTEM`: sanitarios y empaques con comida → `mixto`; bolsa cerrada sin contenido visible → material de la bolsa, certeza ≤ 0,5, alternativas `mixto` + contenido probable; no inferir moho, descomposición ni suciedad. Ejemplos del prompt neutros (no las fotos de prueba). `tests/prompts.test.ts`.
- Migración `0002_instrucciones_genericas.sql` (**ya ejecutada en Supabase**): 8 instrucciones genéricas, en `DEFAULT` y `13657`; `seed.sql` y fixtures del backend coinciden.
- Título del resultado con mayúscula inicial (`capitalizeFirst`).
- Spike real: bolsa-pañal → plástico 0,50 (baja certeza, alternativa mixto) ✅; frasco → vidrio 0,95 ✅; ahuyama → orgánico sin moho, pero nombrada «cáscara de fruta cítrica» (aceptado: límite de reconocimiento).
- Pruebas: backend 67, frontend 89. `npm run check` OK. Code-reviewer pasado.

## Decisiones

- ADR-21: instrucciones genéricas por material; migraciones de datos filtran por el texto anterior.
- ADR-20: prioridad del punto limpio y porcentaje truncado. ADR-19: compresión en el cliente.

## Problemas abiertos

1. **Solo desarrollo:** StrictMode lanza dos `classify` al montar `/resultado` (el primero se cancela; puede gastar una llamada a DeepSeek).
2. **Prueba intermitente del frontend** (sospecha `findBy` de 1 s bajo carga). Si reaparece, anotar el nombre.
3. Falta probar en Android real: permiso, EXIF, ≤ 300 KB, TalkBack. Volver a probar la bolsa con pañal tras el despliegue.
4. **Rama `fix/arranque-config`:** `''` como faltante, nivel del log en Railway, exigir `ALLOWED_ORIGINS` en producción, `https:` en `VITE_API_URL`.
5. Alinear Vitest del backend (v2) con el del frontend (v5); quitar el parche de jest-dom.
6. HU-01 (logo): trazado oficial, variante maskable, variante ≤ 48 px.
7. Normativa de contenedores de San Juan Nepomuceno sin confirmar (`13657` = copia de `DEFAULT`).
8. HU-08 (corregir resultado) e historial (HU-04) pendientes.

## Siguiente acción

Verificar CI y despliegue en https://eco-clasifica.vercel.app con la foto de la bolsa con pañal → `/clear` → `/story HU-01`.
