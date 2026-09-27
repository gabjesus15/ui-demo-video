# ui-demo-video

**Videos demo verticales de tu app web real, grabados con código.** Un teléfono en escena con tu app funcionando dentro, un dedo que viaja y presiona cada botón, acercamientos de cámara, títulos animados palabra por palabra, una celebración con confeti al confirmar y un cierre con tu marca. Sale en MP4 H.264 listo para Instagram, TikTok, WhatsApp y tu landing.

Es una **skill para Claude Code**, pero la guía ([`SKILL.md`](SKILL.md)) está escrita para que cualquier IA o persona pueda seguirla.

> 🇬🇧 **English summary** — A Claude Code skill (and a plain-Markdown guide for any AI) to record vertical 9:16 demo videos of a real web app: phone mockup, animated finger taps, camera zooms, word-by-word captions, confetti on success and a branded outro. Real UI, fake data: every write is blocked or answered with a fake response so no real orders, payments or messages are created. No ffmpeg needed — it uses Edge/Chrome tab capture + `MediaRecorder` (H.264). Includes QA tools (frame-gap measurement, frame grids), a lightweight web version and SEO guidance (`VideoObject`). Docs are in Spanish.

---

## Qué la hace distinta

- **Es tu app real, no una maqueta.** El video muestra tus pantallas de verdad dentro de un iframe.
- **Datos falsos, nunca reales.** Todo lo que no sea lectura se **bloquea por defecto**. El envío final (pedido, pago, registro) se responde en falso desde el grabador, así tu app muestra su confirmación real sin tocar la base de datos. WhatsApp, correos y pasarelas quedan cortados.
- **Fluido de verdad.** Resuelve los tirones típicos de grabar una app en desarrollo: la app corre en otro proceso, hay un ensayo previo sin grabar y las pantallas se precargan. La guía explica cada causa y su solución.
- **Toques precisos.** El dedo sigue al botón en cada cuadro aunque la cámara o un panel se muevan.
- **Sin ffmpeg ni editores.** Solo Node, Playwright y Edge o Chrome.

## Requisitos

- Node 18+
- [Playwright](https://playwright.dev) en tu proyecto (`npm i -D playwright`) o dentro de la carpeta de la skill.
- **Microsoft Edge** o **Google Chrome** instalados. El Chromium que trae Playwright no incluye H.264.
- Tu app corriendo en local (p. ej. `http://localhost:3000`).

## Instalación

### Como skill de Claude Code

Para todos tus proyectos:

```bash
git clone https://github.com/gabjesus15/ui-demo-video ~/.claude/skills/ui-demo-video
```

O solo para un proyecto:

```bash
git clone https://github.com/gabjesus15/ui-demo-video .claude/skills/ui-demo-video
```

Claude la usa sola cuando pides algo como *«hazme un video de cómo funciona el pedido»*. También puedes pedirla por nombre: *«usa la skill ui-demo-video»*.

### Con otra IA o a mano

Clona el repo donde quieras y dale a la IA el archivo [`SKILL.md`](SKILL.md) como instrucciones. Al final de ese archivo hay un texto listo para pegar en un chat nuevo.

## Uso rápido

1. **Copia el escenario de ejemplo** a tu proyecto y adáptalo: URLs, textos, marca, reglas de red y guion.
   ```bash
   cp ~/.claude/skills/ui-demo-video/scripts/example-scenario.cjs scripts/video/mi-demo.cjs
   ```
2. **Graba la versión maestra** (1080×1920, 30 fps) desde la raíz de tu proyecto:
   ```bash
   node ~/.claude/skills/ui-demo-video/scripts/record-demo.cjs scripts/video/mi-demo.cjs out master
   ```
   Al final revisa el bloque `--- red ---`: tiene que decir que el envío fue **FALSO** y no mostrar escrituras inesperadas.
3. **Revisa la calidad:**
   ```bash
   node ~/.claude/skills/ui-demo-video/scripts/qa-tools.cjs gaps out/mi-demo.mp4          # tirones
   node ~/.claude/skills/ui-demo-video/scripts/qa-tools.cjs frames out/mi-demo.mp4 out/f 48  # fotogramas
   ```
4. **Saca la versión web y la portada:**
   ```bash
   node ~/.claude/skills/ui-demo-video/scripts/qa-tools.cjs web out/mi-demo.mp4 public/videos/demo.mp4 720 1600000
   node ~/.claude/skills/ui-demo-video/scripts/qa-tools.cjs poster public/videos/demo.mp4 public/videos/demo.jpg 4.2
   ```

## Cómo se escribe un escenario

Un escenario es un módulo de Node con esta forma. El ejemplo completo y comentado está en [`scripts/example-scenario.cjs`](scripts/example-scenario.cjs).

```js
module.exports = {
  name: 'como-pide-tu-cliente',
  appOrigin: 'http://localhost:3000',   // tu app
  stageOrigin: 'http://127.0.0.1:3000', // la escena: otro "sitio" → otro proceso → sin tirones
  urls: { main: '/tienda', alt: '/tienda/menu' }, // alt se precarga para pasar con un fundido
  brand: { accent: '#4f5bff', logo: '/logo-white.png', site: 'www.tu-sitio.com' },
  copy: { intro: ['¿Y cómo pide', 'tu cliente?'], celebrate: '¡Y listo!', outro: 'Y el pedido llega a tu caja' },
  network: {
    fakes: [{ match: /\/api\/orders$/, method: 'POST', body: { id: 9001, number: 214 } }], // nunca llega al servidor
    allowWrites: [/\/api\/cart\/quote$/], // POST que SOLO leen (verificado en el código)
    block: [/wa\.me/],
  },
  async warmUp({ page, app, sleep }) { /* el mismo flujo, rápido y sin grabar */ },
  async run({ tap, typeInto, cam, caption, smoothScroll, swapToAlt, frame, celebrate, outro, sleep }) {
    /* el guion de la toma */
  },
};
```

API del guion:

| Función | Qué hace |
|---|---|
| `cam(x, y, escala, rotY?, rotX?)` | Mueve la cámara con una curva suave. Con `y > 0` baja el teléfono; con escala 1,1 a 1,2 se acerca |
| `caption(texto, [índices])` | Muestra un título grande con palabras resaltadas; `caption('')` lo oculta |
| `tap(locator, { travel, hold, click })` | El dedo viaja, se vuelve a medir, presiona y hace clic |
| `typeInto(locator, texto)` | Toca el campo y escribe letra por letra (también en campos con máscara) |
| `smoothScroll(dy, ms)` | Scroll con aceleración y frenado, cuadro a cuadro |
| `swapToAlt()` | Fundido a la pantalla precargada, sin navegar |
| `intro()` / `introOut()` / `celebrate()` / `outro()` | Escenas de marca |
| `frame()`, `frames.main`, `frames.alt`, `sleep(ms)` | Acceso a los iframes de la app |

## Seguridad

La regla de oro: **si tu app escribe en una base real, ninguna escritura del recorrido puede llegar al servidor.**

- **Todo POST, PUT, PATCH o DELETE se corta por defecto.** Las acciones de servidor de Next.js (cabecera `next-action`) nunca pasan.
- **`fakes` responde la escritura en el grabador** con un JSON inventado. Revisa también las llamadas que la app hace *después* de crear el recurso.
- **Solo pon en `allowWrites` rutas que verificaste en el código** que solo leen.
- **Usa datos inventados** (nombres, teléfonos) y ten cuidado con las cuentas reales.
- **Las cabeceras que protegen tu app contra incrustaciones (`X-Frame-Options` / `frame-ancestors`) solo se quitan dentro del navegador de grabación.** Tu app no cambia.

## Preguntas frecuentes

**¿Funciona con cualquier framework?** Sí. Graba cualquier app web que corra en el navegador. Los detalles de Next.js (acciones de servidor, indicador de desarrollo) son opcionales.

**¿Por qué 30 fps y no 60?** A 1080p, 60 fps satura el codificador del navegador y se pierden cuadros; se ve más fluido a 30.

**El video tiene tirones.** Mide con `qa-tools.cjs gaps`. Si aparecen en plena acción, revisa que tengas `warmUp`, que la navegación sea con `swapToAlt` y que la escena y la app estén en orígenes distintos. La tabla de causas está en `SKILL.md`.

**La app se ve dentro del teléfono pero no responde.** El documento se sirve desde el grabador y la página no hidrata. La solución está en la sección «Incrustar la app en otro origen» de `SKILL.md`: quitar cabeceras de compresión y desactivar *Local Network Access*.

**¿Puedo cambiar la tipografía y los colores?** Sí, con `brand` en el escenario: `accent`, `sceneBg`, `celebrateBg`, `fontsHref`, `displayFont`, `uiFont`, `logo` y `confetti`.

## Estructura

```
ui-demo-video/
├── SKILL.md                    guía completa (la lee Claude u otra IA)
├── README.md
└── scripts/
    ├── record-demo.cjs         motor de grabación
    ├── example-scenario.cjs    escenario de ejemplo comentado
    └── qa-tools.cjs            tirones, fotogramas, versión web y portada
```

## Licencia

[MIT](LICENSE)
