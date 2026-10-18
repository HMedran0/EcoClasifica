# Estado del proyecto

_Actualizado: 2026-10-18 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F2 — Frontend:** base ✅ · despliegue ✅ · HU-02 ✅ · **HU-17 ✅** (rama `feat/HU-17-resultado`). Queda: **HU-01** (PWA).

## Hecho en feat/HU-17-resultado

- Sección HU-17 añadida a `docs/historias.md` (tras HU-08).
- `resultView.ts`: prioridad `dropOff` (con `unsure` si hay baja certeza) > `unsure` > `binCard` > `noRule`. Con baja certeza nunca se propone un contenedor doméstico.
- `ResultPage` rediseñada: miniatura, objeto (o material si viene vacío), material «Etiqueta · detalle», certeza, `BinCard` (color + ícono SVG por `binCode` + nombre en texto, borde oscuro siempre, `colorHex` validado), «No estoy seguro» con hasta 2 alternativas, errores (`NOT_A_WASTE` y otros) con `role="alert"` fuera de la región `aria-live="polite"`.
- Acciones por estado: Cancelar (aborta y vuelve a la cámara), Reintentar, Repetir foto, Tomar otra foto, Escanear otro residuo. El foco pasa al título al cambiar de estado.
- `MATERIAL_LABELS` (12 materiales) y `formatPercent` que **trunca** (0,595 → «59 %») con tolerancia de coma flotante.
- Pruebas: backend 63, frontend 86. `npm run check` y build de producción OK. Code-reviewer pasado; hallazgos corregidos.

## Decisiones

- ADR-20: prioridad del punto limpio y porcentaje truncado (ver `DECISIONS.md`).
- ADR-19: compresión y cámara en el cliente. ADR-18: configuración que falla pronto.

## Problemas abiertos

1. **Solo desarrollo:** StrictMode lanza dos `classify` al montar `/resultado` (el primero se cancela; el backend puede gastar una llamada a DeepSeek).
2. **Prueba intermitente del frontend:** un `npm run check` falló en vitest sin poder reproducirse (7 ejecuciones verdes); sospecha: `findBy` (1 s) bajo carga. Si reaparece, anotar el nombre y subir el `timeout` o usar temporizadores falsos.
3. Probar HU-02 + HU-17 en un Android real (permiso, cámara trasera, EXIF, ≤ 300 KB, lectura con TalkBack).
4. **Rama `fix/arranque-config`:** `''` como faltante (prueba con `KEY=`), nivel del log «Error no controlado» en Railway, exigir `ALLOWED_ORIGINS` en producción, `https:` en `VITE_API_URL` en Vercel.
5. Alinear Vitest del backend (v2) con el del frontend (v5); después quitar el parche de jest-dom.
6. HU-01 (logo): trazado oficial del símbolo, variante maskable, variante pequeña ≤ 48 px.
7. Normativa de contenedores de San Juan Nepomuceno sin confirmar (`13657` = `DEFAULT`). Una fila mala de `disposal_rules` invalida toda la carga.
8. HU-08 (corregir resultado) e historial (HU-04) fuera de alcance de HU-17.

## Siguiente acción

Tras el merge y el push: verificar CI y despliegue en https://eco-clasifica.vercel.app con una foto real (clasificación completa) → `/clear` → `/story HU-01`.
