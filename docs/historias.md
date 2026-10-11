# Historias de usuario y criterios de aceptación

Formato Dado / Cuando / Entonces. Para cargar una sola: `Grep "## HU-05" -A 15`. Prioridad: M = MVP, D = deseable.

## Épica 0 — Acceso, cámara y modo

## HU-01 (M) Instalar la app

Como usuario, quiero instalar EcoClasifica desde el navegador para abrirla como una app.

- Dado que visito el sitio por HTTPS en Chrome Android, cuando cumple los criterios PWA, entonces se ofrece instalarla.
- Dado que la instalé, cuando la abro sin conexión, entonces veo el app shell y un aviso de que escanear requiere internet.

## HU-02 (M) Capturar una foto

Como usuario, quiero abrir la cámara y tomar una foto del residuo.

- Dado que abro la pantalla de cámara, cuando concedo el permiso, entonces veo la vista previa con la cámara trasera por defecto.
- Dado que niego el permiso, entonces veo un mensaje explicativo y un botón para elegir una imagen de la galería.
- Dado que capturo la foto, entonces veo una vista previa con las opciones Repetir y Usar foto.

## HU-03 (M) Elegir el modo de escaneo

Como usuario, quiero un interruptor «Dar segunda vida» antes de la foto.

- Dado que abro la cámara, entonces el modo Clasificar está activo por defecto.
- Dado que activo el interruptor y tomo la foto, entonces la solicitud va a `/scan/upcycle`.
- El modo elegido queda visible en pantalla en todo momento.

## HU-04 (M) Registro e inicio de sesión

Como usuario, quiero registrarme con un correo válido y verificable, o entrar con mi cuenta de Google, para guardar mi historial.

- Dado que no tengo sesión, entonces puedo escanear, pero el historial y los favoritos me piden iniciar sesión.
- Dado que me registro con correo, entonces debo verificarlo antes de iniciar sesión; con Google no se pide verificación adicional.
- Dado que inicio sesión, entonces mis datos solo son accesibles para mí (RLS).

## Épica A — Modo Clasificar

## HU-05 (M) Identificar el residuo

Como usuario, quiero que la app identifique material y objeto de la foto.

- Dado que envío una foto válida (JPEG/PNG/WebP, máx. 4 MB tras comprimir), cuando la IA responde, entonces veo material, objeto y porcentaje de certeza.
- Dado que la respuesta tarda, entonces veo un indicador de progreso y puedo cancelar; el máximo es 20 s.
- Dado que la IA devuelve un JSON inválido, entonces el backend reintenta una vez y, si falla, muestra «No pudimos analizar la imagen, intenta de nuevo».

## HU-06 (M) Saber dónde depositarlo

Como usuario, quiero ver el contenedor exacto con color e ícono.

- Dado que la certeza es ≥ 0,60, entonces veo contenedor (color, nombre, ícono) y una instrucción corta.
- Dado que el material requiere punto limpio (pilas, electrónicos, aceite), entonces se indica «Llevar a punto limpio» y no un contenedor doméstico.

## HU-07 (M) Baja certeza o imagen inválida

Como usuario, quiero que la app me avise cuando no está segura.

- Dado que la certeza es < 0,60, entonces se muestra «No estoy seguro», las 2 mejores hipótesis y la opción de repetir la foto.
- Dado que la foto no contiene un residuo, entonces se informa (`NOT_A_WASTE`) y no se guarda en el historial.

## HU-08 (D) Corregir el resultado

Como usuario, quiero marcar «el resultado es incorrecto» y elegir el material correcto.

- Dado que corrijo, entonces se guarda `user_feedback` ligado al escaneo.

## Épica B — Modo Dar Segunda Vida

## HU-09 (M) Recibir ideas de upcycle

Como usuario, quiero 3 ideas creativas para reutilizar el objeto.

- Dado que envío la foto con el modo activo, entonces recibo nombre del objeto, dificultad (Fácil, Medio o Difícil) y exactamente 3 ideas.
- Cada idea trae título, descripción corta (≤ 120 caracteres) y materiales extra necesarios.
- Dado que la IA devuelve menos o más de 3 ideas, entonces el backend las ajusta o reintenta antes de responder.

## HU-10 (M) Elegir una alternativa

Como usuario, quiero seleccionar una idea para empezar a fabricarla.

- Dado que toco una idea, entonces se abre el chat con objeto, idea y materiales ya cargados.

## HU-11 (M) Chat paso a paso

Como usuario, quiero preguntarle a la IA cómo fabricar la alternativa.

- Dado que el chat está abierto, cuando escribo una duda, entonces la IA responde en el contexto de esa idea y mantiene el hilo.
- Se envían como máximo las últimas 10 interacciones (control de costos).
- Dado que pregunto algo ajeno a la manualidad, entonces la IA reconduce con cortesía al tema.

## HU-12 (D) Guardar como favorita

Como usuario autenticado, quiero guardar una idea para consultarla luego.

- Dado que toco el corazón, entonces la idea queda en Favoritos (con copia: objeto, dificultad, materiales); tocarlo de nuevo la quita.

## Épica H — Historial y favoritos

## HU-13 (M) Ver mi historial

Como usuario autenticado, quiero ver mis escaneos pasados.

- Dado que abro Historial, entonces veo una lista paginada (20 por página) por fecha, con miniatura, modo, objeto y resultado.
- Dado que toco un ítem, entonces veo el detalle completo sin volver a llamar a la IA.

## HU-14 (D) Eliminar registros

Como usuario, quiero borrar un escaneo o todo mi historial.

- Dado que confirmo, entonces el registro y su imagen se eliminan de forma permanente. Los favoritos se conservan (tienen copia).

## HU-15 (M) Ver mis favoritos

Como usuario, quiero una lista de ideas guardadas con acceso a retomar el chat.

- Si el escaneo original ya no existe, el contexto del chat se reconstruye desde la copia y la conversación empieza vacía.

## HU-16 (D) Estadísticas personales

Como usuario, quiero ver cuántos residuos he clasificado por material.

## RNF — Requerimientos no funcionales

| Código | Requisito                    | Meta                                                                   |
| ------ | ---------------------------- | ---------------------------------------------------------------------- |
| RNF-01 | Rendimiento de clasificación | p95 ≤ 8 s de foto a resultado en 4G                                    |
| RNF-02 | Peso de la imagen enviada    | ≤ 300 KB tras compresión                                               |
| RNF-03 | Lighthouse PWA               | ≥ 90 en Performance y PWA                                              |
| RNF-04 | Seguridad                    | API key solo en el servidor; HTTPS; RLS en todas las tablas            |
| RNF-05 | Límites de uso               | 10 escaneos/min por IP y 60/día por usuario (configurable)             |
| RNF-06 | Privacidad                   | Imágenes de usuarios autenticados en bucket privado; opción de borrado |
| RNF-07 | Disponibilidad               | Degradación controlada si DeepSeek falla (error tipificado, sin caída) |
| RNF-08 | Accesibilidad                | Contraste AA, objetivos táctiles ≥ 48 px, textos en español            |
| RNF-09 | Observabilidad               | Logs estructurados con `requestId`, latencia y tokens por llamada      |
