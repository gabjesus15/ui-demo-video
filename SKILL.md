---
name: ui-demo-video
description: Graba videos demo verticales (reel 9:16, MP4 H.264) de una app web REAL, con un teléfono en escena, dedo que toca, acercamientos, títulos animados, celebración con confeti y cierre de marca. Úsala cuando pidan "un video de cómo funciona", "demo en video", "grabar el flujo del cliente/panel", "reel del producto" o un video para la landing o redes. Incluye cómo no crear datos reales (pedidos, pagos, mensajes), cómo evitar tirones y clics desviados, control de calidad, versión web liviana e integración en la página con SEO (VideoObject).
---

# Videos demo de una app web real

Guía autocontenida: sirve para Claude Code y para cualquier otra IA o persona. Los scripts están en
`scripts/` junto a este archivo. Se escribió grabando el flujo de pedido de un menú digital real:
cada problema de esta guía pasó de verdad y cada solución está probada.

## Qué se obtiene

- **Formato:** vertical 9:16. Maestra de 1080×1920 a **60 fps exactos** (motor render) y versión web de 720×1280 (~7–8 MB por 40 s).
- **Estructura** (35–45 s):
  1. Intro de marca: fondo de color, títulos palabra por palabra.
  2. El teléfono entra con la app **real** dentro.
  3. Pasos con acercamientos, un título por paso y un «dedo» que viaja y presiona cada botón. Los campos se escriben letra por letra.
  4. Confirmación **real** de la app, con datos falsos.
  5. Celebración: el fondo se vuelve verde, confeti y «¡Y listo!».
  6. Cierre de marca: logo y sitio web.

## Antes de empezar (obligatorio)

1. **Pregunta si es buen momento.** Grabar, ensayar y medir es pesado (Edge sin interfaz, servidor de desarrollo, codificación de video). Si la persona usa la misma PC para otra cosa (jugar, llamadas), avisa antes y agrupa las corridas.
2. **¿La app escribe en una base real?** Casi siempre sí, incluso en local. Identifica **cada** escritura del recorrido antes de grabar (ver «Seguridad»). Si hay dudas, no grabes el paso final.
3. **Requisitos:** Node, `playwright` en el proyecto y **Microsoft Edge o Google Chrome** instalados. El Chromium de Playwright no trae H.264; usa `browserChannel: 'chrome'` en el escenario si no hay Edge. No se necesita ffmpeg.
4. **App corriendo** (p. ej. `http://localhost:3000`). Mejor con build de producción, porque el modo desarrollo compila al vuelo y congela; si no, el ensayo lo compensa.

## Cómo se usa

`<skill>` es la carpeta de esta skill (p. ej. `~/.claude/skills/ui-demo-video`).

1. Copia `scripts/example-scenario.cjs` a tu proyecto (p. ej. `scripts/video/mi-demo.cjs`) y adapta:
   - URLs, marca y textos.
   - **Reglas de red:** `fakes` (respuestas inventadas), `allowWrites` (POST que solo leen) y `block`.
   - `warmUp`: el mismo flujo, rápido y sin grabar.
   - `run`: el guion con la API `tap`, `typeInto`, `cam`, `caption`, `smoothScroll`, `swapToAlt`, etc.
2. Explora primero los selectores con capturas sueltas a 390×844, móvil y táctil: qué abre cada botón, qué diálogos aparecen, qué pide cada formulario.
3. Graba la maestra:
   ```bash
   node <skill>/scripts/record-demo.cjs scripts/video/mi-demo.cjs out master
   ```
4. Lee el bloque «--- red ---» del log: tiene que decir que los envíos fueron **FALSOS** y no mostrar escrituras inesperadas.
5. Control de calidad (ver abajo), luego la versión web y la portada con `qa-tools.cjs`.

Opciones: `--fps=30|60`, `--safe=instagram`, `--tempo=0.9` (todo un 10 % más rápido), `--size=720`, `--bitrate=…` y `--live`.

## Los dos motores

| | **render** (por defecto) | **live** (`--live`) |
|---|---|---|
| Cómo graba | Congela el reloj de la escena y de la app, avanza de a 1/60 s, fotografía cada cuadro y lo codifica con WebCodecs (H.264 + mp4-muxer) | Captura la pestaña en tiempo real con `MediaRecorder` |
| Fluidez | 60 fps exactos, cero cuadros perdidos | ~29 reales a 30 fps y ~48 a 60 fps; depende de la carga de la PC |
| Esperas de la app (red, compilación) | No se ven: el tiempo del video no corre mientras la app espera | Se ven como microcortes |
| Tiempo de grabación | ~3× lo que dura el video (37 s de video en 2 min) | Lo que dura el video |
| Si la PC está ocupada (juegos, llamadas) | Tarda más, pero el video sale igual | El video sale con tirones |

**Cómo funciona render** (`scripts/virtual-time.cjs`): se inyecta en cada documento, antes que sus scripts, un reloj virtual.
`requestAnimationFrame`, `setTimeout`/`setInterval` (desde 5 ms), `performance.now` y `Date.now` pasan a ser virtuales.
Las animaciones CSS y Web Animations se pausan y se posicionan en cada cuadro con `getAnimations()`; al llegar al final
se cierran con `finish()` para que disparen `transitionend`/`finish` (sin eso, los paneles que esperan su animación no se cierran).
Mientras el motor fotografía, el guion corre en paralelo: `sleep(ms)` espera tiempo **del video**, no tiempo real.

**Qué no controla el reloj virtual:** videos y GIF dentro de la app, `scroll-behavior: smooth` nativo (el motor lo desactiva)
y animaciones ligadas al scroll (`animation-timeline`), que igual se ven bien porque dependen del scroll y no del tiempo.
Si algo de la app se ve acelerado, usa `--live` para esa toma.

## Seguridad: nunca crear datos reales

El grabador bloquea por defecto **toda** petición que no sea GET, HEAD u OPTIONS. Desde el escenario solo se puede:

- **`fakes`:** responder aquí mismo la escritura que crea el recurso, con un JSON inventado que tenga la forma que espera la app. Así la app muestra su confirmación real y no se escribe nada. Si el host es otro (Supabase, una API externa), usa `cors: true`: sin las cabeceras CORS el navegador descarta la respuesta falsa.
- **`allowWrites`:** POST que **solo leen**, como calcular precios o validar el catálogo. **Revisa el código de la ruta** (que no tenga insert, update, upsert, delete ni rpc de escritura) antes de agregarla. Nunca pongas aquí la ruta que crea el pedido.
- **`block`:** salidas a terceros: WhatsApp (`wa.me`), correo, pasarelas de pago. Las ventanas emergentes se cierran solas.
- **Acciones de servidor (Next.js):** van por POST a la propia página con la cabecera `next-action`. El grabador nunca las deja pasar aunque coincidan con `allowWrites`.
- **Rutas de seguimiento:** revisa también las rutas que la app llama **después** de crear el recurso, como completar datos de entrega o subir un comprobante. También van en `fakes`.
- **El ensayo usa el mismo blindaje.** El pedido falso del ensayo tampoco llega al servidor.
- **Datos de ejemplo:** usa nombres, cédulas y teléfonos inventados, y respeta el formato del país.

## Por qué el video sale fluido (y qué lo rompía)

| Síntoma | Causa real | Solución (ya en `record-demo.cjs`) |
|---|---|---|
| Tirones cada ~1 s | Convertir los trozos del video a base64 **durante** la toma bloquea el hilo de la escena | Los trozos se guardan como `Blob` y se transfieren al terminar |
| Congelamiento al tocar o abrir pantallas | La app y la escena comparten proceso y el trabajo de la app frena la cámara | Escena en `127.0.0.1` y app en `localhost`: sitios distintos, así que la app va en un iframe de otro proceso |
| ~1 s congelado al navegar | La navegación recarga, compila e hidrata | La segunda pantalla queda **precargada** en otro iframe (`urls.alt`) y se pasa con un fundido (`swapToAlt`) |
| Congelamientos la primera vez | Código e imágenes aún sin compilar ni descargar | `warmUp`: se recorre el flujo entero sin grabar y se pre-scrollea cada iframe |
| Cuadros perdidos | (live) 60 fps a 1080p satura el codificador en vivo (daba ~41 fps reales) | Motor render (60 exactos) o, en live, 30 fps |
| Ritmo irregular en algunos reproductores | La captura solo emite cuadros cuando algo cambia | Un píxel casi invisible cambia en cada cuadro (`#tick`) |
| Scroll a saltos | `behavior: 'smooth'` depende del navegador | `smoothScroll`: rAF con curva de aceleración y frenado |
| Tirón al aparecer el teléfono | Primera vez que se dibuja la app dentro de la escena | El motor lo deja dibujado antes de grabar (posición final, tapado por la intro) |
| «Brinco» en la entrada | Entrar girado en 3D y luego enderezarse son dos movimientos | Entrada en un solo movimiento: `cam(0, 60, 0.84)` |
| Tirón al terminar un barrido | `clip-path` se repinta en cada cuadro sobre toda la pantalla | Barridos con `transform` (deslizar, o un círculo chico que escala ×26) |
| Barrido que arranca tarde | Una capa gigante (2400 px ×2) tarda en dibujarse | Círculo de 120 px escalado, nunca capas enormes |
| Texto que aparece antes de tiempo | Un `opacity` fijo pisa la opacidad 0 inicial de la animación | Resaltar con `color` semitransparente, no con `opacity` |
| Cuadros perdidos al entrar los títulos | `filter: blur()` animado es de lo más caro de pintar | Títulos con subida y fundido, sin desenfoque |
| Trabajo de más durante toda la toma | El iframe de inicio sigue vivo detrás tras el fundido, y el dedo se medía en cada cuadro aunque estuviera oculto | `swapToAlt` vacía el iframe de atrás; el dedo solo se calcula cuando se ve y se mueve |
| Primer o último cuadro largo | El arranque y el cierre del grabador | Colchón de 0,3–0,4 s al inicio y al final, sobre fondo quieto |
| (render) Cada cuadro tardaba 2 s | Chrome frena `requestAnimationFrame` en iframes de otro origen sin interacción, y el motor esperaba que pintaran | Solo la escena espera su pintado; al pintar, compone lo último que entregaron los iframes |
| (render) Microcortes de la app | Red, compilación o un paso pesado de la app | No existen: el tiempo del video no avanza mientras la app trabaja |

**Incrustar la app en otro origen exige tres cosas.** Si falta alguna, la app se ve pero no reacciona:
1. Quitar `X-Frame-Options` y `frame-ancestors`, solo en este navegador de grabación.
2. Quitar además `content-encoding`, `content-length` y `transfer-encoding`: el cuerpo llega descomprimido.
3. Lanzar el navegador con `--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessChecks,BlockInsecurePrivateNetworkRequests`. Si no, el documento servido desde el grabador cuenta como «externo» y se le bloquea el acceso a `localhost`: no carga su JS y la página no hidrata.

## Cuadros por segundo y redes sociales

- **Motor render: 60 fps por defecto, exactos.** Medido: 2238 cuadros en 37,3 s, sin huecos, en 2 minutos (13 ms de reloj + 38 ms de foto por cuadro).
- **Instagram, TikTok y WhatsApp** aceptan 60 y suelen recomprimir a 30 al publicar; bajar de 60 a 30 es limpio (un cuadro sí, uno no). Si prefieres controlar tú la versión de 30, usa `--fps=30`.
- **`--safe=instagram`:** baja los títulos y achica y sube el teléfono, para que la interfaz de Reels no los tape. Instagram tapa arriba (~12 %), abajo (~20 %: nombre, descripción, música) y el costado derecho (botones).
- **Motor live (`--live`):** a 30 fps salen ~29 reales; a 60, ~48, porque el techo lo pone el codificador en vivo (medido en una PC con RTX 3070).
- **`VT_PROFILE=1`** muestra cuánto tarda cada paso por cuadro (reloj, foto, codificación, cada iframe).

```bash
node <skill>/scripts/record-demo.cjs escenario.cjs out master                    # 1080×1920 a 60 fps exactos
node <skill>/scripts/record-demo.cjs escenario.cjs out master --safe=instagram   # Reels / TikTok
node <skill>/scripts/record-demo.cjs escenario.cjs out master --live --fps=30    # motor en vivo
```

## Anuncios: voz en off, gancho y llamado a la acción

Para publicidad (Reels, TikTok) el video necesita tres cosas más, y el motor las trae:

- **Gancho en los primeros 3 s** (`copy.hook`): un chat genérico que se llena de mensajes (sin logos ni interfaz de
  terceros) con un título grande encima. En el guion: `api.hook(ms)` arranca los mensajes, `api.hookTitle(texto, [clave])`
  cambia el título y `api.hookOut()` lo barre hacia arriba. Con gancho no se usa la intro de marca.
- **Voz en off** (`voice` en el escenario + `scripts/voiceover.cjs`): ElevenLabs genera una pista por frase (con caché, no
  gasta dos veces) y `api.say(id)` la pone a sonar en ese instante del video; `api.voiceDuration(id)` ayuda a acompasar.
  El motor la mezcla en estéreo a 48 kHz, la comprime suave y la codifica en AAC dentro del MP4 (solo motor render).
  - **Plan gratuito de ElevenLabs:** no permite uso comercial ni voces de la biblioteca por API. Para probar, usa
    `--voice=<voz incluida>`; para el anuncio final hace falta un plan pago.
  - Busca una voz parecida a otra grabación con `POST /v1/similar-voices` (subes el audio o el video).
  - **Acento:** una voz en inglés hablando español suele sonar a España. Con el plan gratuito, el modelo v3 acepta
    etiquetas que no se leen: `--model=eleven_v3 --stability=0.5 --prefix='[Venezuelan Spanish accent] [warm, casual, conversational]'` (o `voice.prefix`
    en el escenario). Verifica con `speech-to-text` que la etiqueta no se haya leído en voz alta.
  - Algunas voces de la biblioteca exigen un plan mayor que Starter (p. ej. Creator): el error lo dice
    (`free_users_not_allowed`).
- **Llamado a la acción** (`copy.cta`): una píldora bajo el texto del cierre, antes del logo.
- **Ubicación simulada** (`geolocation: { latitude, longitude, accuracy }`): para flujos con delivery. Tres trampas resueltas:
  la simulación de Playwright no llega a iframes de otro origen (se responde desde la página), el permiso depende del
  sitio de la escena y una cabecera `Permissions-Policy: geolocation=(self)` en la escena lo bloquea (se quita solo aquí).
- **Servicios externos lentos** (geocodificación, una base lenta): con render la espera no se ve, así que el motor espera
  hasta 60 s (`--wait=`). Si un servicio es inestable, responde esa **lectura** con `fakes` usando su respuesta real.

- **Saltar pasos** (`api.cut(fn)` / `api.offCamera(fn)`): lo que pasa dentro de `fn` corre fuera de cámara (el tiempo
  del video no avanza, pero la app sí termina sus animaciones) y se vuelve con un destello y un barrido. Úsalo para el
  carrito, formularios o pasos repetidos: en un anuncio, cada paso que no aporta es gente que se va.
- **Franja de títulos** (`video: { band: true }`): el título vive arriba y la cámara nunca sube el teléfono debajo de él.
  `focus()` ubica el elemento en la ventana libre (entre la franja y el borde seguro de Instagram); si el botón está muy
  abajo, el teléfono baja en vez de achicarse, y nunca pasa de `minScale` (0,66) para que se lea.
- **Efectos de sonido sintetizados** (`video: { sfx: true }`, activos si hay voz): notificación en cada mensaje del gancho,
  toque en cada `tap`, barrido en cortes y cambios de escena, éxito en `celebrate()` y campanita en `ticket()`. También
  `api.sfx('pop'|'tap'|'whoosh'|'success'|'ding')`. Se generan con Web Audio: sin archivos ni licencias.
- **Voz continua**: `api.waitVoice(ms)` espera a que termine la frase anterior; encadena `say()` → acciones → `waitVoice()`
  para que no queden silencios. Las acciones de cada frase tienen que caber en ella (si no, córtalas con `cut`).
- **Gancho «pantalla bloqueada»** (`copy.hook.style: 'lock'`, con `time`, `date`, `icon`): la hora y notificaciones que no
  paran, con un contador que se dispara. Se entiende al instante: «este es mi teléfono a la hora de la cena».
- **Cámara tranquila** (lo que salió de revisar zooms «raros»): un encuadre por pantalla, no uno por elemento. Enfocar
  cada botón seguido hace que la cámara vaya y vuelva (acercar → alejar → acercar en un segundo) y que se aleje justo al
  elegir algo que está abajo. Revisa la secuencia con `CAM_LOG=1`: imprime cada movimiento con su segundo, posición,
  escala y duración; si dos movimientos quedan a menos de ~1 s o la escala sube y baja, sobra uno.
- **Dato en grande** (`api.chip('$14.00 = Bs. 12.010,43', [2, 3])`, `chip(null)` lo oculta): un globo sobre la app para
  números que en el celular no se leerían (una conversión, un total). Lee el dato de la propia app, no lo inventes.
- **Nunca quieto** (`api.voiceLeft()`): si la frase dura más que la acción, un `focus()` lento con `ms: api.voiceLeft()`
  llena el tiempo con un acercamiento. Apúntalo a algo de la mitad superior de la pantalla: abajo, la franja de títulos
  no deja acercarse y el movimiento no se nota. Oculta el dedo (`fingerHide`) mientras tanto.
- **Recompensa** (`api.ticket({ label, title, rows, total })`): una tarjeta de «nuevo pedido» con los datos del pedido
  falso de la toma. Cierra el círculo del gancho: de 100 mensajes a un pedido completo.

**Guion que conecta** (lo que se aplicó): nombrar al público y su dolor cotidiano en el primer segundo («Así suena tu
teléfono a la hora de la cena…», con el sonido de las notificaciones), humor que lo haga sentirse identificado, mostrar la solución real funcionando
y cerrar con una frase que vuelva al gancho («Deja el chat para los amigos»). El texto en pantalla debe contar la historia
sin sonido: la mayoría mira en silencio.

## Por qué el dedo toca donde debe

- La posición se calcula en coordenadas del iframe y se convierte a la escena **en cada cuadro**, con `getBoundingClientRect` del iframe, que ya incluye la cámara. Si la cámara o un panel se mueven, el dedo sigue encima.
- Tras `swapToAlt()` el iframe principal se vacía para no gastar recursos. Si el guion lo vuelve a usar, llama a `swapToAlt({ unload: false })`.
- **El toque siempre a la vista:** antes de viajar, `tap` calcula dónde quedará el botón con la cámara actual (aunque siga
  moviéndose). Si queda fuera de cuadro, bajo la franja de títulos o bajo la interfaz de Instagram, reencuadra suave y
  recién ahí toca. Sin esto, un acercamiento lento dejaba el botón de abajo fuera y el dedo y su sonido ocurrían donde
  no se veía. Con `CAM_LOG=1` se ve cada reencuadre («tap fuera de cuadro… se reencuadra»).
- Los efectos de sonido no suenan fuera de cámara (`offCamera`/`cut`): solo se oye lo que se ve.
- `tap` mide, viaja, **vuelve a medir** (el panel pudo terminar de subir), presiona y recién ahí hace `element.click()` del DOM, que no depende de la geometría con transforms.
- Elementos en algo fijo (diálogos, barra inferior): nunca se scrollea para alcanzarlos.
- **Hidratación:** un clic antes de que la página hidrate hace una navegación completa en vez de abrir el panel. Espera, o reintenta hasta que aparezca lo esperado sin volver a tocar mientras anima.
- **Campos con máscara** (teléfono con prefijo): `typeInto` rellena prefijos crecientes con `fill`. Tecla por tecla, la máscara desordena los dígitos.

## Dirección de arte (lo que hizo que se viera bien)

- **Títulos grandes**, en Bebas Neue o la tipografía de display de la marca, que entran palabra por palabra (suben y aparecen; sin desenfoque animado, que bota cuadros). Una palabra clave va en el color de la marca, dentro de una píldora blanca para que se lea sobre cualquier pantalla.
- **Cámara:** `cam(x, y, escala, { ms })` con curva `cubic-bezier(.33,0,.12,1)` (arranca rápido y frena largo) y 1 s; con `{ ms }` cambias un movimiento puntual. `focus(elemento, { scale, at })` calcula el encuadre solo. Evita los giros 3D (`rotY`/`rotX`) que después se enderezan: se ven como un brinco. Acercamientos de 1,1 a 1,2 para leer; teléfono completo (0,97) cuando importa ver todo (el carrito con el total).
- **Ritmo:** 35–40 s en total, 0,3–0,65 s entre acciones y un respiro después de cada cambio de pantalla. Dedo: ~0,5 s de viaje. `--tempo=0.9` acelera todo sin tocar el guion.
- **Transiciones:** al cambiar el título, las palabras viejas salen hacia arriba, la píldora se ajusta al ancho nuevo y las nuevas suben desde una máscara. El paso a la pantalla precargada es un «push» (entra desde la derecha), no un fundido.
- **Final emocional:** el fondo verde se abre en círculo desde el teléfono, confeti desde las dos esquinas y el centro, y «¡Y listo!» enorme arriba con el teléfono más abajo para que no se tapen.
- **Honestidad:** todo lo que se ve es la app real; los datos son inventados. No agregues pantallas que la app no tiene.

## Control de calidad (una sola ronda, agrupada)

```bash
node <skill>/scripts/qa-tools.cjs gaps out/mi-demo.mp4
node <skill>/scripts/qa-tools.cjs frames out/mi-demo.mp4 out/frames 48
```
- **`gaps`:** lista los huecos entre fotogramas mayores a 100 ms. En plena acción deberían quedar pocos y menores a 0,25 s; en la intro y el cierre (pantallas quietas) no importan. Mira también `fpsReal`: ~59 con render a 60 fps, ~28 con live a 30. Un hueco en el segundo 0,1 es el arranque del reproductor, no del archivo.
- **`frames`:** revisa en una grilla que el dedo caiga sobre cada botón, que los títulos no tapen lo importante y que ninguna pantalla aparezca a medio cargar.
- Los tiempos de cada paso salen de los nombres de esos fotogramas (`f12-19.3s.jpg`). Sirven para capítulos en la web.

## Versión web y portada

```bash
node <skill>/scripts/qa-tools.cjs web out/mi-demo.mp4 public/videos/menu-digital-pedido-online.mp4 720 1800000
node <skill>/scripts/qa-tools.cjs poster public/videos/menu-digital-pedido-online.mp4 public/videos/menu-digital-pedido-online.jpg 4.2
```
- La web se saca **de la maestra** en lugar de regrabar, porque así se conserva la toma aprobada. Se re-codifica cuadro por cuadro con WebCodecs y mantiene los 60 fps (medido: 2237 de 2238 cuadros, 37 s en 8,7 MB a 1,8 Mbps).
- Nombres de archivo descriptivos con palabras de búsqueda reales (`menu-digital-pedido-online-restaurante-marca.mp4`), no `demo1.mp4`.
- La portada tiene que contar algo, como el primer paso o el resultado, no una pantalla vacía.

## Integración en la página (lo que funcionó)

- `<video muted playsInline preload="metadata" poster=…>`. Se reproduce solo cuando está **a la vista** (IntersectionObserver) y se pausa fuera de pantalla. El segundo video va con `preload="none"`.
- **Botón de pausa visible:** es obligatorio para contenido que se mueve más de 5 s (WCAG 2.2.2). Con `prefers-reduced-motion`, el video no arranca solo.
- **Capítulos sincronizados** (opcional, muy efectivo): una lista de pasos que se ilumina según `currentTime`, leído con rAF mientras se reproduce. Al tocar un paso, el video salta a ese segundo. Si se regraba el video, hay que volver a medir los tiempos.
- **SEO:** un nodo `VideoObject` por video en el JSON-LD de la página, con `name`, `description`, `thumbnailUrl` y `contentUrl` absolutos, `uploadDate` con zona horaria y `duration` en formato `PT48S`. No declares `Clip`/`hasPart` si la página no permite abrir el video en un segundo concreto.

## Iniciar un chat dedicado a esto

Pega esto en un chat nuevo (Claude Code u otra IA con acceso al proyecto):

> Usa la skill `ui-demo-video` (o lee su `SKILL.md` y sus `scripts/`). Quiero un video demo vertical de [flujo] en [URL local]. La app escribe en una base real: identifica cada escritura del recorrido y falsifícala o bloquéala antes de grabar. Explora selectores con capturas sueltas, arma el escenario a partir de `example-scenario.cjs`, avísame antes de cada corrida pesada, graba la maestra, mide los tirones, revisa los toques en fotogramas y entrega también la versión web con su portada.
