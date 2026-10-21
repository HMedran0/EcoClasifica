# Backlog y fases

Estados: Pendiente · En curso · Hecha. Prioridad: M = MVP, D = deseable. Cada fila se actualiza con `/handoff`.

## Historias

| ID    | Historia                                                                              | Prio | Fase | Estado    |
| ----- | ------------------------------------------------------------------------------------- | ---- | ---- | --------- |
| HU-01 | Instalar la app (PWA)                                                                 | M    | F2   | Hecha     |
| HU-02 | Capturar una foto                                                                     | M    | F2   | Hecha     |
| HU-03 | Elegir el modo de escaneo (necesita `/scan/upcycle`)                                  | M    | F3   | Hecha     |
| HU-04 | Registro e inicio de sesión (correo verificado o Google)                              | M    | F4   | Hecha     |
| HU-05 | Identificar el residuo (incluye `NOT_A_WASTE`)                                        | M    | F1   | Hecha     |
| HU-06 | Saber dónde depositarlo                                                               | M    | F1   | Hecha     |
| HU-07 | Baja certeza y alternativas (no-residuo ya en HU-05)                                  | M    | F1   | Hecha     |
| HU-08 | Corregir el resultado                                                                 | D    | v1.1 | Pendiente |
| HU-09 | Recibir ideas de upcycle                                                              | M    | F3   | Hecha     |
| HU-10 | Elegir una alternativa                                                                | M    | F3   | Hecha     |
| HU-11 | Chat paso a paso                                                                      | M    | F3   | Hecha     |
| HU-12 | Guardar como favorita                                                                 | D    | F4   | Hecha     |
| HU-13 | Ver mi historial                                                                      | M    | F4   | Hecha     |
| HU-14 | Eliminar registros                                                                    | D    | F4   | Hecha     |
| HU-15 | Ver mis favoritos                                                                     | M    | F4   | Hecha     |
| HU-16 | Estadísticas personales                                                               | D    | v1.1 | Pendiente |
| HU-17 | Pantalla de resultado (UI de HU-05, HU-06 y HU-07)                                    | M    | F2   | Hecha     |
| HU-18 | Botón «Instalar app» en la portada (`beforeinstallprompt`, solo si no está instalada) | D    | F3   | Hecha     |
| HU-19 | Recuperar contraseña (enlace por correo; fuera de alcance de HU-04)                   | M    | F5   | Pendiente |
| HU-20 | Cuota diaria de IA (`ai_usage`, por usuario, por IP y tope global)                    | M    | F5   | Pendiente |
| HU-21 | Privacidad y autorización de datos (Ley 1581)                                         | M    | F5   | Pendiente |
| HU-22 | Eliminar mi cuenta (derecho de supresión)                                             | M    | F5   | Pendiente |

## Fases y criterios de salida

| Fase        | Contenido                                                                       | Criterio de salida                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| F0 Preparar | Validar la IA con fotos reales; repo y `CLAUDE.md`; Supabase creado             | Una foto produce JSON válido según los esquemas de `shared`                                                                         |
| F1 Backend  | `POST /scan/classify`, reglas locales, esquemas Zod, errores, rate limit        | Contrato probado con IA simulada (Supertest) y un caso real                                                                         |
| F2 Frontend | Proyecto Vite, cámara, resultado, PWA instalable, despliegue en Vercel          | Flujo A completo en un Android real                                                                                                 |
| F3 Upcycle  | `POST /scan/upcycle`, ideas, chat paso a paso                                   | Flujo B completo con chat                                                                                                           |
| F4 Cuentas  | Auth (correo verificado y Google), historial, favoritos, RLS, pruebas de acceso | Lighthouse ≥ 90 (Performance y PWA) y RLS probado entre usuarios                                                                    |
| F5 Piloto   | Arranque, cuota de IA, contraseña, privacidad, borrar cuenta, calidad           | Piloto con 5 a 10 usuarios reales en San Juan Nepomuceno sin errores bloqueantes, con gasto de IA limitado y cumpliendo la Ley 1581 |

Orden de F2: `chore/F2-base` ✅ (proyecto Vite + Tailwind, workspace) → despliegue ✅ (Vercel + CORS con Railway, `chore/F2-despliegue`) → HU-02 ✅ → HU-17 ✅ → `fix/clasificacion-casos-reales` ✅ (prueba en Android real) → HU-01 ✅. **Criterio de salida cumplido (2026-10-19):** Flujo A completo en Android real (7 objetos, 2–3 s, instalación, modo avión, TalkBack, CI verde).

Orden de F3: HU-09 (`POST /scan/upcycle` e ideas) ✅ → HU-03 (interruptor de modo) ✅ → HU-10 ✅ → HU-11 ✅ → mejora HU-18 ✅. **Criterio de salida cumplido (2026-10-19):** Flujo B completo con chat en Android real (frasco y botella con 3 ideas, cargador sin ideas → «Ver dónde depositarlo», idea → chat en pasos con hilo conservado), botón «Instalar app» verificado en escritorio, CI verde.

Orden de F4: HU-04 ✅ → HU-13 ✅ → HU-12 ✅ → HU-15 ✅ → HU-14 ✅. HU-08 y HU-16 pasan a v1.1. **Criterio de salida cumplido (2026-10-20):** en producción, Lighthouse móvil Performance 96 y Accesibilidad 100. Lighthouse 12 ya no tiene categoría PWA: se verificaron el manifiesto (standalone, íconos) y `sw.js`. Prueba manual completa de HU-04, HU-12, HU-13, HU-14 y HU-15, con aislamiento entre dos cuentas (URL ajena → 404) y borrado verificado en Storage. CI de `main` en verde.

Orden de F5: `fix/arranque-config` ✅ → HU-20 (cuota diaria de IA) → HU-19 (recuperar contraseña) → HU-21 (privacidad y autorización) → HU-22 (eliminar cuenta) → `chore/F5-imagenes-huerfanas` (script que borra de `scan-images` las imágenes sin fila en `scans`; los `warn` «pendiente de limpiar» de HU-14 dan los `scanId`) → `chore/F5-calidad` (Lighthouse ≥ 90 en Performance y Accesibilidad, RNF-03).

Tareas manuales de F5 (del responsable, no de Claude Code): SMTP propio en Supabase Auth, dominio y publicación de la app de Google OAuth, validación de las reglas de contenedores con la alcaldía, validación del texto de privacidad y ejecución del piloto.

## v1.1 (después del piloto)

HU-08 (corregir el resultado) y HU-16 (estadísticas personales).

Después del MVP: empaquetado con Capacitor y publicación en Google Play.

## Reglas del backlog

- Una historia que requiera más de 2 sesiones se parte en subhistorias (HU-05a, HU-05b...).
- El orden de las fases es el orden de trabajo; no empezar la siguiente sin cumplir el criterio de salida (`/phase-check`).
