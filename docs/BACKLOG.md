# Backlog y fases

Estados: Pendiente · En curso · Hecha. Prioridad: M = MVP, D = deseable. Cada fila se actualiza con `/handoff`.

## Historias

| ID    | Historia                                                 | Prio | Fase | Estado    |
| ----- | -------------------------------------------------------- | ---- | ---- | --------- |
| HU-01 | Instalar la app (PWA)                                    | M    | F2   | Pendiente |
| HU-02 | Capturar una foto                                        | M    | F2   | Pendiente |
| HU-03 | Elegir el modo de escaneo (necesita `/scan/upcycle`)     | M    | F3   | Pendiente |
| HU-04 | Registro e inicio de sesión (correo verificado o Google) | M    | F4   | Pendiente |
| HU-05 | Identificar el residuo (incluye `NOT_A_WASTE`)           | M    | F1   | Hecha     |
| HU-06 | Saber dónde depositarlo                                  | M    | F1   | Hecha     |
| HU-07 | Baja certeza y alternativas (no-residuo ya en HU-05)     | M    | F1   | Hecha     |
| HU-08 | Corregir el resultado                                    | D    | F4   | Pendiente |
| HU-09 | Recibir ideas de upcycle                                 | M    | F3   | Pendiente |
| HU-10 | Elegir una alternativa                                   | M    | F3   | Pendiente |
| HU-11 | Chat paso a paso                                         | M    | F3   | Pendiente |
| HU-12 | Guardar como favorita                                    | D    | F4   | Pendiente |
| HU-13 | Ver mi historial                                         | M    | F4   | Pendiente |
| HU-14 | Eliminar registros                                       | D    | F4   | Pendiente |
| HU-15 | Ver mis favoritos                                        | M    | F4   | Pendiente |
| HU-16 | Estadísticas personales                                  | D    | F4   | Pendiente |
| HU-17 | Pantalla de resultado (UI de HU-05, HU-06 y HU-07)       | M    | F2   | Pendiente |

## Fases y criterios de salida

| Fase        | Contenido                                                                       | Criterio de salida                                               |
| ----------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| F0 Preparar | Validar la IA con fotos reales; repo y `CLAUDE.md`; Supabase creado             | Una foto produce JSON válido según los esquemas de `shared`      |
| F1 Backend  | `POST /scan/classify`, reglas locales, esquemas Zod, errores, rate limit        | Contrato probado con IA simulada (Supertest) y un caso real      |
| F2 Frontend | Proyecto Vite, cámara, resultado, PWA instalable, despliegue en Vercel          | Flujo A completo en un Android real                              |
| F3 Upcycle  | `POST /scan/upcycle`, ideas, chat paso a paso                                   | Flujo B completo con chat                                        |
| F4 Cuentas  | Auth (correo verificado y Google), historial, favoritos, RLS, pruebas de acceso | Lighthouse ≥ 90 (Performance y PWA) y RLS probado entre usuarios |

Orden de F2: `chore/F2-base` (proyecto Vite + Tailwind, workspace) → despliegue (Vercel + CORS con Railway) → HU-02 → HU-17 → HU-01.

Después del MVP: empaquetado con Capacitor y publicación en Google Play.

## Reglas del backlog

- Una historia que requiera más de 2 sesiones se parte en subhistorias (HU-05a, HU-05b...).
- El orden de las fases es el orden de trabajo; no empezar la siguiente sin cumplir el criterio de salida (`/phase-check`).
