# Estado del proyecto

_Actualizado: 2026-10-18 · Reescribir completo en cada `/handoff` (≤ 40 líneas)._

## Fase actual

**F2 — Frontend:** base ✅ · despliegue ✅ · **HU-02 ✅** (rama `feat/HU-02-capturar-foto`). Orden: → **HU-17** → HU-01.

## Hecho en feat/HU-02-capturar-foto

- `/camara` (`features/camera`): cámara trasera (`facingMode: { ideal: 'environment' }`), galería siempre disponible (secundaria con cámara activa), vista previa con Repetir / Usar foto. Botón «Escanear residuo» en la portada.
- `useCamera`: abre al montar, apaga todas las pistas al tener foto y al desmontar, reabre con Repetir; `ended` del sistema → mensaje + «Reintentar cámara» / galería.
- `compressImage.ts`: lado largo 768 px, JPEG 0,7 → 0,5 hasta ≤ 300 KB, EXIF con `createImageBitmap(..., { imageOrientation: 'from-image' })`, Base64 sin prefijo; codificador inyectable.
- `photoStore` (Zustand): foto comprimida + object URL que se revoca al reemplazar/descartar. `/camara` empieza siempre sin foto.
- `ResultPage` provisional en `/resultado`: `api.classify`, carga, objeto/material/contenedor/certeza o error en español con Reintentar y Tomar otra foto; sin foto → `/camara`.
- Pruebas: backend 63, frontend 65. `npm run check` OK. Code-reviewer pasado; hallazgos corregidos.

## Decisiones

- ADR-19: compresión y cámara en el cliente (ver `DECISIONS.md`).
- ADR-18: configuración que falla pronto. ADR-17: contrato por alias de Vite y `paths`.

## Problemas abiertos

1. **Solo desarrollo:** StrictMode lanza dos `classify` al montar `/resultado` (el primero se cancela, pero el backend puede gastar una llamada a DeepSeek).
2. **HU-17:** escribir su sección en `docs/historias.md` antes de `/story HU-17`; tratar `lowConfidence` (con `alternatives`, incluso vacío) y rediseñar `ResultPage`.
3. Probar HU-02 en un Android real (permiso, cámara trasera, orientación EXIF de galería, tamaño final ≤ 300 KB).
4. **Rama `fix/arranque-config`:** `''` como faltante (prueba con `KEY=`), nivel del log «Error no controlado» en Railway, exigir `ALLOWED_ORIGINS` en producción, `https:` en `VITE_API_URL` en Vercel.
5. Alinear Vitest del backend (v2) con el del frontend (v5); después quitar el parche de jest-dom.
6. HU-01 (logo): trazado oficial del símbolo, variante maskable, variante pequeña ≤ 48 px.
7. Normativa de contenedores de San Juan Nepomuceno sin confirmar (`13657` = `DEFAULT`). Una fila mala de `disposal_rules` invalida toda la carga.
8. `optionalAuth` y guardado en historial llegan con HU-04. Upcycle no rechaza no-residuos (HU-09).

## Siguiente acción

Tras el merge y el push: verificar CI y despliegue en https://eco-clasifica.vercel.app (tomar una foto real y clasificarla) → `/clear` → escribir HU-17 en `historias.md` y `/story HU-17`.
