---
name: ui-demo-video
description: Graba videos demo verticales (reel 9:16, MP4 H.264) de una app web REAL, con un teléfono en escena, dedo que toca, acercamientos, títulos animados, celebración con confeti y cierre de marca. Úsala cuando pidan "un video de cómo funciona", "demo en video", "grabar el flujo del cliente/panel", "reel del producto" o un video para la landing o redes. Incluye cómo no crear datos reales (pedidos, pagos, mensajes), cómo evitar tirones y clics desviados, control de calidad, versión web liviana e integración en la página con SEO (VideoObject).
---

# Videos demo de una app web real

Guía autocontenida: sirve para Claude Code y para cualquier otra IA o persona. Los scripts están en
`scripts/` junto a este archivo. Se escribió grabando el flujo de pedido de un menú digital real:
cada problema de esta guía pasó de verdad y cada solución está probada.

## Qué se obtiene

- **Formato:** vertical 9:16. Maestra de 1080×1920 a 30 fps para redes y versión web de 720×1280 (~7–8 MB por 45 s).
- **Estructura** (35–50 s):
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
| Cuadros perdidos | 60 fps a 1080p satura el codificador (daba ~41 fps reales) | 30 fps |
| Ritmo irregular en algunos reproductores | La captura solo emite cuadros cuando algo cambia | Un píxel casi invisible cambia en cada cuadro (`#tick`) |
| Scroll a saltos | `behavior: 'smooth'` depende del navegador | `smoothScroll`: rAF con curva de aceleración y frenado |

**Incrustar la app en otro origen exige tres cosas.** Si falta alguna, la app se ve pero no reacciona:
1. Quitar `X-Frame-Options` y `frame-ancestors`, solo en este navegador de grabación.
2. Quitar además `content-encoding`, `content-length` y `transfer-encoding`: el cuerpo llega descomprimido.
3. Lanzar el navegador con `--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessChecks,BlockInsecurePrivateNetworkRequests`. Si no, el documento servido desde el grabador cuenta como «externo» y se le bloquea el acceso a `localhost`: no carga su JS y la página no hidrata.

## Por qué el dedo toca donde debe

- La posición se calcula en coordenadas del iframe y se convierte a la escena **en cada cuadro**, con `getBoundingClientRect` del iframe, que ya incluye la cámara. Si la cámara o un panel se mueven, el dedo sigue encima.
- `tap` mide, viaja, **vuelve a medir** (el panel pudo terminar de subir), presiona y recién ahí hace `element.click()` del DOM, que no depende de la geometría con transforms.
- Elementos en algo fijo (diálogos, barra inferior): nunca se scrollea para alcanzarlos.
- **Hidratación:** un clic antes de que la página hidrate hace una navegación completa en vez de abrir el panel. Espera, o reintenta hasta que aparezca lo esperado sin volver a tocar mientras anima.
- **Campos con máscara** (teléfono con prefijo): `typeInto` rellena prefijos crecientes con `fill`. Tecla por tecla, la máscara desordena los dígitos.

## Dirección de arte (lo que hizo que se viera bien)

- **Títulos grandes**, en Bebas Neue o la tipografía de display de la marca, que entran palabra por palabra (subir, desenfoque a nítido). Una palabra clave va en el color de la marca, dentro de una píldora blanca para que se lea sobre cualquier pantalla.
- **Cámara:** `cam(x, y, escala)` con curva `cubic-bezier(.65,0,.35,1)` y 1,35 s. Acercamientos de 1,1 a 1,2 para leer; teléfono completo (0,97) cuando importa ver todo (el carrito con el total).
- **Ritmo:** 40–50 s en total, 0,5–0,9 s entre acciones y un respiro después de cada cambio de pantalla. Dedo: 0,6–0,7 s de viaje.
- **Final emocional:** el fondo verde se abre en círculo desde el teléfono, confeti desde las dos esquinas y el centro, y «¡Y listo!» enorme arriba con el teléfono más abajo para que no se tapen.
- **Honestidad:** todo lo que se ve es la app real; los datos son inventados. No agregues pantallas que la app no tiene.

## Control de calidad (una sola ronda, agrupada)

```bash
node <skill>/scripts/qa-tools.cjs gaps out/mi-demo.mp4
node <skill>/scripts/qa-tools.cjs frames out/mi-demo.mp4 out/frames 48
```
- **`gaps`:** lista los huecos entre fotogramas mayores a 100 ms. En plena acción deberían quedar pocos y menores a 0,25 s; en la intro y el cierre (pantallas quietas) no importan. Mira también `fpsReal`, que debería ser ~28.
- **`frames`:** revisa en una grilla que el dedo caiga sobre cada botón, que los títulos no tapen lo importante y que ninguna pantalla aparezca a medio cargar.
- Los tiempos de cada paso salen de los nombres de esos fotogramas (`f12-19.3s.jpg`). Sirven para capítulos en la web.

## Versión web y portada

```bash
node <skill>/scripts/qa-tools.cjs web out/mi-demo.mp4 public/videos/menu-digital-pedido-online.mp4 720 1600000
node <skill>/scripts/qa-tools.cjs poster public/videos/menu-digital-pedido-online.mp4 public/videos/menu-digital-pedido-online.jpg 4.2
```
- La web se saca **de la maestra** en lugar de regrabar, porque cada toma es distinta y así se conserva la más limpia.
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
