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

## HU-19 (M) Recuperar contraseña

Como usuario registrado con correo, quiero recuperar el acceso si olvido mi contraseña.

- Dado que olvidé mi contraseña, cuando pido recuperarla con mi correo, entonces recibo un enlace para elegir una nueva.
- El mensaje es el mismo exista o no la cuenta: no revela qué correos están registrados.
- El enlace vuelve a la app y, tras cambiar la contraseña, inicio sesión con la nueva.

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

## HU-17 (M) Pantalla de resultado del Modo Clasificar

Como usuario, quiero ver con claridad qué es el residuo y dónde va, para depositarlo bien sin pensarlo.

- Dado que la certeza es ≥ 0,60 y hay `disposal`, entonces veo la miniatura de mi foto, el objeto, el material (con su detalle), la certeza en % y una tarjeta del contenedor con su color, ícono, nombre e instrucción.
- Dado que `requiresDropOff` es verdadero (también con baja certeza), entonces veo «Llevar a punto limpio» con su instrucción y no un contenedor doméstico.
- Dado que `lowConfidence` es verdadero, entonces veo «No estoy seguro», hasta 2 alternativas y el botón «Repetir foto».
- Dado que `disposal` es null sin baja certeza (regla no disponible), entonces veo el material y «No pudimos obtener dónde depositarlo; intenta de nuevo» con «Reintentar».
- Dado que la respuesta es `NOT_A_WASTE`, entonces veo «No parece un residuo» y «Tomar otra foto».
- Dado que la respuesta tarda, entonces veo un indicador de progreso y puedo «Cancelar», que aborta la petición y vuelve a la cámara.
- El color nunca es la única señal: el nombre del contenedor va en texto, el contenedor blanco lleva borde visible, el contraste es AA y el resultado se anuncia con aria-live.

Fuera de alcance: corregir el resultado (HU-08) y guardar en el historial.

## HU-18 (D) Botón «Instalar app»

Como usuario, quiero un botón visible para instalar la app sin buscarla en el menú del navegador.

- Dado que el navegador permite instalarla (`beforeinstallprompt`), entonces veo «Instalar app» en la portada, debajo de «Escanear residuo» y con menos peso visual.
- Dado que lo toco, entonces se abre el cuadro de instalación del navegador; acepte o cancele, el botón desaparece en esa sesión.
- Dado que la app ya está instalada o el navegador no lo permite (por ejemplo iOS), entonces no veo el botón.

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

## Épica P — Lanzamiento piloto

## HU-20 (M) Cuota diaria de IA

Como responsable del piloto, quiero limitar el gasto diario en IA para que no se dispare con pocos usuarios.

- Cada llamada a DeepSeek (clasificar, upcycle, chat) registra una fila en `ai_usage` con usuario (o `null` sin sesión), endpoint, tokens y latencia. Nunca la imagen ni el texto del usuario. Si registrar falla, se responde igual con un `warn`.
- Con sesión: cuota diaria de 60 escaneos (RNF-05) y de 100 mensajes de chat, configurables por variable de entorno. Al superarla → `429` con un código nuevo en `errors.ts`, mensaje en español y la hora de reinicio (medianoche de `America/Bogota`). No se llama a la IA.
- Sin sesión: cuota diaria por IP de escaneos y de mensajes de chat, ambas más bajas que las de usuario.
- Tope global diario de tokens del servicio (variable de entorno): al alcanzarlo, las nuevas llamadas responden un error tipificado sin llamar a la IA y queda un `warn`. El frontend lo muestra como «Servicio en pausa por hoy».
- Pruebas con `AiProvider` simulado: cuota por usuario, por IP, tope global, reinicio diario y aislamiento entre usuarios.

## HU-21 (M) Privacidad y autorización de datos

Como usuario, quiero saber qué datos se guardan y autorizar su uso antes de registrarme (Ley 1581 de 2012 y Decreto 1377 de 2013).

- `/privacidad` es accesible sin sesión desde la portada y el registro. Incluye: responsable y contacto, finalidades, datos tratados (correo, fotos, escaneos, favoritos, chats), encargados y transferencia internacional (Supabase, DeepSeek, Vercel, Railway), derechos del titular (conocer, actualizar, rectificar, suprimir, revocar) y cómo ejercerlos.
- El registro con correo y con Google exige una autorización previa, expresa e informada: casilla sin marcar por defecto y enlace a la política. Sin marcarla no se crea la cuenta.
- Queda prueba de la autorización: versión de la política y fecha en el perfil (migración nueva). Si cambia la versión, se vuelve a pedir al iniciar sesión.
- Sin sesión, antes del primer escaneo hay un aviso breve: la foto se envía a un proveedor de IA y no se guarda.
- El texto de la política lo valida una persona responsable (alcaldía o asesoría) antes del piloto. Es tarea manual y no bloquea el código.

## HU-22 (M) Eliminar mi cuenta

Como usuario, quiero eliminar mi cuenta y todos mis datos (derecho de supresión).

- «Eliminar mi cuenta» en el perfil, con `ConfirmDialog`: «¿Eliminar tu cuenta? Se borrarán tus escaneos, fotos, favoritos y conversaciones. No se puede deshacer.»
- `DELETE /api/v1/me` (`requireAuth`): borra las imágenes de `scan-images` del usuario y después el usuario de Auth. La cascada borra `profiles`, `scans`, `scan_ideas`, `favorites` y `chat_messages`; `ai_usage` queda con `user_id` null (anonimizado).
- Si borrar las imágenes falla, la cuenta no se elimina y se muestra un error para reintentar. No quedan fotos de una cuenta borrada.
- Al terminar: cierra la sesión, limpia los stores en memoria y vuelve a la portada con el aviso «Cuenta eliminada».
- Pruebas: aislamiento (solo se borra la propia cuenta), orden imágenes → Auth, fallo de Storage sin borrado parcial, y que la política de privacidad (HU-21) describe este proceso.

## RNF — Requerimientos no funcionales

| Código | Requisito                    | Meta                                                                                                                   |
| ------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| RNF-01 | Rendimiento de clasificación | p95 ≤ 8 s de foto a resultado en 4G                                                                                    |
| RNF-02 | Peso de la imagen enviada    | ≤ 300 KB tras compresión                                                                                               |
| RNF-03 | Lighthouse e instalabilidad  | Lighthouse ≥ 90 en Performance y Accesibilidad; instalable según Chrome DevTools > Application > Manifest, sin errores |
| RNF-04 | Seguridad                    | API key solo en el servidor; HTTPS; RLS en todas las tablas                                                            |
| RNF-05 | Límites de uso               | 10 escaneos/min por IP y 60/día por usuario (configurable)                                                             |
| RNF-06 | Privacidad                   | Imágenes de usuarios autenticados en bucket privado; opción de borrado                                                 |
| RNF-07 | Disponibilidad               | Degradación controlada si DeepSeek falla (error tipificado, sin caída)                                                 |
| RNF-08 | Accesibilidad                | Contraste AA, objetivos táctiles ≥ 48 px, textos en español                                                            |
| RNF-09 | Observabilidad               | Logs estructurados con `requestId`, latencia y tokens por llamada                                                      |
