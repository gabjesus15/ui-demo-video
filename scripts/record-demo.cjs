#!/usr/bin/env node
/**
 * Motor de grabación de videos demo verticales (reel 9:16) de una app web real.
 *
 *   node record-demo.cjs <escenario.cjs> <carpeta-salida> [master|web] [--fps=60] [--size=720]
 *                        [--safe=instagram] [--tempo=0.9] [--bitrate=…] [--live]
 *
 *   master → 1080×1920 · web → 720×1280 (mejor: sacar la web de la master con qa-tools web)
 *
 * Dos motores:
 *   render (por defecto) → cuadro por cuadro con reloj virtual: el tiempo de la escena y de la app solo
 *       avanza cuando el motor lo dice; cada cuadro se fotografía y se codifica con WebCodecs.
 *       60 fps exactos, sin cuadros perdidos aunque la PC esté ocupada. Tarda más que el video (≈4–6×).
 *   --live → captura de pestaña en tiempo real con MediaRecorder (el motor original). Más rápido de
 *       obtener, pero a 60 fps bota cuadros (~48 reales) y depende de la carga de la PC.
 *
 * Se ejecuta desde la raíz del proyecto que tenga `playwright` instalado (se resuelve desde el cwd).
 * Necesita Microsoft Edge o Google Chrome instalados (Chromium de Playwright no trae H.264).
 *
 * Seguridad: por defecto se CORTA toda petición que no sea GET/HEAD/OPTIONS. Solo pasan las
 * escrituras que el escenario declare como lectura segura, y las que declare como `fakes` se
 * responden aquí mismo sin llegar al servidor. Revisa el log al final: ahí sale todo lo bloqueado.
 */
const fs = require('fs');
const path = require('path');
// Playwright del proyecto actual o, si no hay, el instalado junto a la skill (npm install en su carpeta).
const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(), path.join(__dirname, '..')] }));
const { virtualTime } = require('./virtual-time.cjs');

const argv = process.argv.slice(2);
const flags = Object.fromEntries(argv.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const [scenarioPath, OUT, modeArg] = argv.filter((a) => !a.startsWith('--'));
if (!scenarioPath || !OUT) {
	console.error('Uso: node record-demo.cjs <escenario.cjs> <carpeta-salida> [master|web] [--fps=60] [--size=720] [--safe=instagram] [--tempo=0.9] [--bitrate=12000000] [--live]');
	process.exit(1);
}
const S = require(path.resolve(scenarioPath));
const MODE = modeArg === 'web' ? 'web' : 'master';
const ENGINE = flags.live || S.video?.engine === 'live' ? 'live' : 'render';

// Escena en CSS px; la resolución real sale del device scale factor.
const W = 540;
const H = 960;
// Ancho final: 1080 (master) o 720 (web); --size=720 fuerza el ancho.
const DSF = flags.size ? Number(flags.size) / W : MODE === 'web' ? 4 / 3 : 2;
// render: 60 exactos por defecto. live: 30 (a 60 el codificador en vivo bota cuadros).
const FPS = Number(flags.fps || S.video?.fps || (ENGINE === 'render' ? 60 : 30));
// Ritmo global: 0.9 = todo un 10 % más rápido (esperas del guion y transiciones de la escena).
const TEMPO = Number(flags.tempo || S.video?.tempo || 1);
// Zonas seguras de redes: Instagram tapa arriba (~12 %, «Reels» y cámara), abajo (~20 %, nombre,
// descripción, música) y el costado derecho (botones). Se bajan los títulos y la escena se achica y sube.
const SAFE = flags.safe || S.video?.safe || null;
// Franja de títulos (video.band): el título vive arriba y la cámara nunca mete el teléfono debajo de él.
const BAND = !!(flags.band || S.video?.band);
const PERSP_SAFE = SAFE === 'instagram' && !BAND ? ';transform:translate(-14px,-34px) scale(.84);transform-origin:50% 42%' : '';
const CAP_TOP = SAFE === 'instagram' ? 118 : 34;
// Borde inferior de la franja (título de ~66 px + aire) y borde inferior seguro (Instagram tapa ~22 % abajo).
const BAND_BOTTOM = CAP_TOP + 80;
const SAFE_BOTTOM = SAFE === 'instagram' ? Math.round(H * 0.78) : H - 40;
// Efectos de sonido: por defecto solo si hay voz en off (un video mudo de landing no los necesita).
const SFX = S.video?.sfx ?? !!S.voice;
// Sin apuro de tiempo real, render puede darse más calidad.
const BITRATE = Number(flags.bitrate || S.video?.bitrate || (ENGINE === 'render' ? 8e6 : 6e6) * (DSF / 2) ** 2 * (FPS / 30));

// Cuánto esperar a que aparezca un elemento. Con render la espera no se ve en el video, así que puede ser
// larga (una base de datos lenta tardó 36 s en responder en plena toma).
const WAIT_MS = Number(flags.wait || S.video?.waitMs || (ENGINE === 'render' ? 60000 : 15000));
const APP = S.appOrigin; // p. ej. http://localhost:3000
const STAGE_ORIGIN = S.stageOrigin; // p. ej. http://127.0.0.1:3000 → otro "sitio" = otro proceso
const brand = {
	accent: '#4f5bff',
	sceneBg: 'radial-gradient(120% 80% at 50% 0%,#ffffff 0%,#eef0ff 55%,#dfe3ff 100%)',
	celebrateBg: 'radial-gradient(120% 90% at 50% 30%,#4ade80 0%,#16a34a 70%,#15803d 100%)',
	fontsHref: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Geist:wght@500;600&display=block',
	displayFont: "'Bebas Neue'",
	uiFont: 'Geist',
	logo: null,
	logoToWhite: true,
	site: '',
	confetti: ['#ffffff', '#4f5bff', '#facc15', '#f472b6', '#a5b4fc'],
	hookBg: 'radial-gradient(120% 80% at 50% 0%,#1e2233 0%,#0b0c10 70%)',
	hookKey: '#facc15', // palabra resaltada del gancho (sobre fondo oscuro)
	...(S.brand || {}),
};
const copy = { intro: ['¿Y cómo', 'funciona?'], celebrate: '¡Y listo!', celebrateSub: '', outro: '', outroKey: [], cta: '', hook: null, ...(S.copy || {}) };
const escHtml = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const esc = (v) => JSON.stringify(v);
// Duración con el ritmo global aplicado.
const d = (s) => `${(s * TEMPO).toFixed(3)}s`;
// Curvas: ataque rápido y frenado largo (se siente ágil y suave a la vez).
const EASE_CAM = 'cubic-bezier(.33,0,.12,1)';
const EASE_OUT = 'cubic-bezier(.16,1,.3,1)';
const EASE_WIPE = 'cubic-bezier(.7,0,.2,1)';

const STAGE = `<!doctype html><html><head><meta charset="utf-8">
<link href="${brand.fontsHref}" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js"></script>
<style>
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:${brand.accent}}
#stage{position:relative;width:${W}px;height:${H}px;overflow:hidden;font-family:${brand.uiFont},system-ui,sans-serif}
#scene{position:absolute;inset:0;background:${brand.sceneBg}}
/* Círculo chico que se agranda: una capa de 2400 px tardaba en dibujarse y el barrido arrancaba tarde. */
#celebrate-bg{position:absolute;left:50%;top:55%;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;background:${brand.celebrateBg};will-change:transform;transform:scale(0);transition:transform ${d(0.9)} ${EASE_WIPE}}
#celebrate-bg.on{transform:scale(26)}
#persp{position:absolute;inset:0;perspective:1600px${PERSP_SAFE}}
#cam{position:absolute;left:50%;top:50%;width:0;height:0;transform-style:preserve-3d;transition:transform ${d(1)} ${EASE_CAM}}
#phone{position:absolute;left:-205px;top:-432px;width:410px;height:864px;border-radius:58px;background:#0c0c0e;padding:10px;
  box-shadow:0 2px 0 1px #2a2a2e inset,0 50px 90px -30px rgba(40,45,120,.55),0 18px 40px -20px rgba(0,0,0,.45);transition:transform ${d(0.16)} ${EASE_OUT}}
#phone.press{transform:scale(.99)}
#screen{position:relative;width:390px;height:844px;border-radius:48px;overflow:hidden;background:#fff}
/* Cambio de pantalla tipo «push»: la nueva entra desde la derecha, la anterior se corre y se apaga. */
#screen iframe{position:absolute;inset:0;width:390px;height:844px;border:0;display:block;transition:opacity ${d(0.34)} cubic-bezier(.4,0,.2,1),transform ${d(0.48)} ${EASE_OUT}}
#alt{opacity:0;transform:translateX(34px);pointer-events:none}
#alt.here{opacity:1;transform:none;pointer-events:auto}
#main.gone{opacity:0;transform:translateX(-34px);pointer-events:none}
#finger{position:absolute;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;z-index:8;pointer-events:none;will-change:transform;
  background:rgba(255,255,255,.55);border:2.5px solid #fff;box-shadow:0 0 0 6px color-mix(in srgb,${brand.accent} 28%,transparent),0 10px 24px rgba(20,24,90,.35);transition:opacity ${d(0.3)};opacity:0}
#finger.on{opacity:1}
.ripple{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:2px solid rgba(255,255,255,.95);z-index:7;pointer-events:none;animation:rip ${d(0.55)} ${EASE_OUT} forwards}
@keyframes rip{from{opacity:.9;transform:scale(.7)}to{opacity:0;transform:scale(2.3)}}
/* Título: la píldora cambia de ancho con transición y las palabras suben desde una máscara (overflow). */
#cap{position:absolute;left:50%;top:${CAP_TOP}px;z-index:9;white-space:nowrap;overflow:hidden;padding:12px 26px 8px;border-radius:22px;background:#fff;
  box-shadow:0 18px 40px -18px rgba(30,35,120,.55);font-family:${brand.displayFont};font-size:46px;line-height:1;color:#101014;
  opacity:0;transform:translateX(-50%) translateY(-10px) scale(.94);transition:opacity ${d(0.22)},transform ${d(0.42)} ${EASE_OUT},width ${d(0.36)} ${EASE_CAM}}
#cap.on{opacity:1;transform:translateX(-50%)}
/* Sin filter:blur animado: es de lo más caro de pintar. Subida + fundido se ve casi igual. */
#cap .w{display:inline-block;margin-right:.22em;opacity:0;transform:translateY(75%);animation:win ${d(0.42)} ${EASE_OUT} forwards}
#cap .w.out{animation:wout ${d(0.15)} cubic-bezier(.5,0,1,1) forwards}
#cap .w:last-child,.big .w:last-child{margin-right:0}
#cap .k,.big .k{color:${brand.accent}}
@keyframes win{to{opacity:1;transform:none}}
@keyframes wout{from{opacity:1;transform:none}to{opacity:0;transform:translateY(-60%)}}
.card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:10}
.big{font-family:${brand.displayFont};font-weight:400;font-size:108px;line-height:.9;text-align:center}
.big .w{display:inline-block;margin-right:.2em;opacity:0;transform:translateY(45%) scale(.82);will-change:transform,opacity;animation:pop ${d(0.6)} ${EASE_OUT} forwards}
@keyframes pop{to{opacity:1;transform:none}}
/* Barridos con transform (capa ya dibujada) y no con clip-path, que se repinta en cada cuadro y da tirones. */
#intro{background:${brand.accent};will-change:transform;transition:transform ${d(0.85)} ${EASE_WIPE}}
#intro.out{transform:translate3d(0,-101%,0)}
#intro .l1{color:#fff}
#intro .l2{margin-top:10px;display:inline-block;background:#fff;color:${brand.accent};padding:6px 18px 0;border-radius:18px;clip-path:inset(0 100% 0 0);transition:clip-path ${d(0.6)} ${EASE_WIPE}}
#intro .l2 .k,#intro .l2 .w{color:${brand.accent}}
#intro .l2.on{clip-path:inset(0 0 0 0)}
#celebrate{z-index:9;pointer-events:none;justify-content:flex-start;padding-top:${SAFE === 'instagram' ? 130 : 70}px}
#celebrate .big{color:#fff;font-size:150px;text-shadow:0 12px 40px rgba(0,60,20,.35)}
#celebrate p{margin-top:10px;font-weight:600;font-size:22px;color:rgba(255,255,255,.92);opacity:0;transform:translateY(8px);transition:opacity ${d(0.5)} ${d(0.4)},transform ${d(0.6)} ${EASE_OUT} ${d(0.4)}}
#celebrate.on p{opacity:1;transform:none}
#outro{background:transparent;overflow:hidden}
#outro::before{content:'';position:absolute;left:50%;top:50%;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;background:${brand.accent};will-change:transform;transform:scale(0);transition:transform ${d(0.9)} ${EASE_WIPE};z-index:-1}
#outro.in::before{transform:scale(26)}
#outro{z-index:10;isolation:isolate;pointer-events:none}
#outro .big{color:#fff;font-size:70px;line-height:.95;padding:0 40px}
/* Color (no opacity): una opacity fija pisaba la opacidad 0 de la animación y la palabra se veía antes de tiempo. */
#outro .big .k{color:rgba(255,255,255,.72)}
#outro img{width:190px;margin-top:56px;${brand.logoToWhite ? 'filter:brightness(0) invert(1);' : ''}opacity:0;transform:scale(.85);transition:opacity ${d(0.7)} ${d(copy.cta ? 1.3 : 1)},transform ${d(0.9)} ${EASE_OUT} ${d(copy.cta ? 1.3 : 1)}}
#outro p.u{margin-top:26px;color:rgba(255,255,255,.85);font-size:20px;letter-spacing:.08em;opacity:0;transition:opacity ${d(0.7)} ${d(copy.cta ? 1.6 : 1.3)}}
#outro.in img,#outro.in p.u{opacity:1;transform:none}
/* Gancho: un chat que se llena de mensajes (genérico, sin marcas de terceros) y un título encima. */
#hook{z-index:11;background:${brand.hookBg};will-change:transform;transition:transform ${d(0.8)} ${EASE_WIPE};display:block}
#hook.out{transform:translate3d(0,-101%,0)}
#hook .head{position:absolute;left:34px;right:34px;top:${SAFE === 'instagram' ? 150 : 90}px;display:flex;align-items:center;gap:14px;color:#fff;font-weight:600;font-size:21px}
#hook .av{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#3b4257,#232838);display:grid;place-items:center;font-size:20px}
#hook .head small{display:block;font-weight:500;font-size:15px;color:#9ca3af}
#hook .badge{margin-left:auto;min-width:46px;text-align:center;background:#ef4444;color:#fff;border-radius:999px;padding:5px 12px;font-weight:700;font-size:19px}
#hook .badge.bump{animation:bump ${d(0.28)} ${EASE_OUT}}
@keyframes bump{40%{transform:scale(1.28)}}
#hook .chat{position:absolute;left:30px;right:30px;top:${SAFE === 'instagram' ? 222 : 160}px;bottom:${SAFE === 'instagram' ? 250 : 120}px;overflow:hidden;-webkit-mask-image:linear-gradient(transparent 0,#000 26%);mask-image:linear-gradient(transparent 0,#000 26%)}
#hook .col{position:absolute;left:0;right:0;top:0;display:flex;flex-direction:column;gap:12px;transition:transform ${d(0.34)} ${EASE_OUT}}
#hook .bub{align-self:flex-start;max-width:82%;background:#fff;color:#111827;font-size:25px;line-height:1.22;font-weight:500;padding:13px 18px 14px;border-radius:22px 22px 22px 6px;box-shadow:0 12px 30px -14px rgba(0,0,0,.7);transform-origin:0 100%;animation:bub ${d(0.36)} cubic-bezier(.2,1.35,.3,1) both}
#hook .bub small{display:block;font-size:14px;font-weight:600;color:#6b7280;margin-bottom:3px}
@keyframes bub{from{opacity:0;transform:translateY(16px) scale(.7)}to{opacity:1;transform:none}}
#hook .scrim{position:absolute;inset:0;background:rgba(8,9,13,.62);opacity:0;transition:opacity ${d(0.3)}}
#hook.titled .scrim{opacity:1}
#hook .ht{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);padding:0 34px;color:#fff;font-size:92px;line-height:.92;text-shadow:0 10px 40px rgba(0,0,0,.5)}
#hook .ht .k{color:${brand.hookKey}}
/* Gancho estilo pantalla bloqueada: la hora y las notificaciones que no paran. */
#hook .clock{position:absolute;left:0;right:0;top:${SAFE === 'instagram' ? 128 : 70}px;text-align:center;color:#fff}
#hook .clock b{display:block;font-weight:500;font-size:88px;letter-spacing:-.02em;line-height:1}
#hook .clock span{font-size:21px;color:rgba(255,255,255,.75)}
#hook.lock .head{display:none}
#hook.lock .chat{top:${SAFE === 'instagram' ? 300 : 230}px}
#hook.lock .bub{align-self:stretch;max-width:none;display:grid;grid-template-columns:42px 1fr;gap:0 12px;align-items:center;background:rgba(255,255,255,.16);color:#fff;border-radius:22px;padding:12px 16px;font-size:22px;box-shadow:none}
#hook.lock .bub i{width:42px;height:42px;border-radius:11px;background:${brand.hookIcon || 'linear-gradient(135deg,#6366f1,#4338ca)'};display:grid;place-items:center;font-style:normal;font-size:22px}
#hook.lock .bub small{color:rgba(255,255,255,.7);font-size:15px;margin:0}
#hook .counter{position:absolute;right:30px;top:${SAFE === 'instagram' ? 250 : 190}px;background:#ef4444;color:#fff;font-weight:700;font-size:20px;border-radius:999px;padding:5px 14px;display:none}
#hook.lock .counter{display:block}
#hook .counter.bump{animation:bump ${d(0.28)} ${EASE_OUT}}
/* Globo de dato (p. ej. un monto convertido): grande, sobre la app, para que se lea en el celular. */
#chip{position:absolute;left:50%;top:58%;z-index:12;white-space:nowrap;background:#111827;color:#fff;font-family:${brand.displayFont};font-size:52px;line-height:1;padding:16px 28px 10px;border-radius:24px;
  box-shadow:0 24px 50px -18px rgba(0,0,0,.55);opacity:0;transform:translateX(-50%) translateY(24px) scale(.85);transition:opacity ${d(0.25)},transform ${d(0.5)} cubic-bezier(.2,1.3,.3,1);pointer-events:none}
#chip.on{opacity:1;transform:translateX(-50%)}
#chip .k{color:${brand.hookKey}}
/* Destello de corte: tapa el salto cuando se saltan pasos. */
#flash{position:absolute;inset:0;z-index:30;pointer-events:none;background:#fff;opacity:0}
#flash.go{animation:flash ${d(0.26)} ease-out}
@keyframes flash{25%{opacity:.6}100%{opacity:0}}
/* Tarjeta de pedido recibido (recompensa del final). */
#ticket{position:absolute;left:50%;top:44%;width:400px;margin-left:-200px;z-index:12;background:#fff;border-radius:26px;padding:22px 24px;box-shadow:0 30px 70px -24px rgba(0,40,15,.55);
  font-size:19px;color:#111827;opacity:0;transform:translateY(40px) scale(.9);transition:opacity ${d(0.3)},transform ${d(0.55)} cubic-bezier(.2,1.3,.3,1);pointer-events:none}
#ticket.on{opacity:1;transform:none}
#ticket small{display:block;font-weight:700;font-size:14px;letter-spacing:.08em;color:${brand.accent}}
#ticket h4{font-size:28px;margin:4px 0 12px}
#ticket ul{list-style:none;padding:0;margin:0 0 12px;border-top:1px solid #e5e7eb}
#ticket li{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #f1f5f9}
#ticket .tot{display:flex;justify-content:space-between;font-weight:700;font-size:24px}
#outro .cta{margin-top:34px;background:#fff;color:${brand.accent};font-weight:600;font-size:24px;padding:14px 28px;border-radius:999px;box-shadow:0 18px 40px -16px rgba(0,0,0,.45);opacity:0;transform:translateY(14px) scale(.92);transition:opacity ${d(0.45)} ${d(1)},transform ${d(0.6)} cubic-bezier(.2,1.3,.3,1) ${d(1)}}
#outro.in .cta{opacity:1;transform:none}
/* Solo motor live: un píxel que cambia en cada cuadro, porque la captura solo emite fotogramas si algo cambia. */
#tick{position:absolute;right:0;bottom:0;width:2px;height:2px;z-index:20;pointer-events:none;background:#000;opacity:.02;animation:tick .1s steps(2) infinite}
@keyframes tick{50%{opacity:.03}}
canvas#fx{position:absolute;inset:0;width:100%;height:100%;z-index:9;pointer-events:none}
</style></head><body><div id="stage">
<div id="scene"></div><div id="celebrate-bg"></div>
<div id="persp"><div id="cam" style="transform:translate3d(0,1150px,0) scale(.9)"><div id="phone"><div id="screen">
<iframe id="main" src="about:blank" allow="geolocation"></iframe><iframe id="alt" src="about:blank" allow="geolocation"></iframe></div></div></div></div>
<div id="cap"></div><div id="finger"></div>${ENGINE === 'live' ? '<div id="tick"></div>' : ''}
<div id="celebrate" class="card"><div class="big" id="celebrateText"></div><p>${copy.celebrateSub}</p></div>
<canvas id="fx"></canvas><div id="ticket"></div><div id="chip"></div><div id="flash"></div>
<div id="intro" class="card"><div class="big l1" id="i1"></div><div class="big l2" id="i2"></div></div>
${copy.hook ? `<div id="hook" class="card${copy.hook.style === 'lock' ? ' lock' : ''}"><div class="head"><div class="av">${escHtml(copy.hook.avatar || '💬')}</div><div>${escHtml(copy.hook.chatName || 'Clientes')}<small>${escHtml(copy.hook.status || 'escribiendo…')}</small></div><div class="badge" id="hkBadge">${copy.hook.unread ?? 3}</div></div><div class="clock"><b>${escHtml(copy.hook.time || '20:47')}</b><span>${escHtml(copy.hook.date || 'viernes')}</span></div><div class="counter" id="hkCounter">${copy.hook.unread ?? 3}</div><div class="chat"><div class="col" id="hkCol"></div></div><div class="scrim"></div><div class="big ht" id="hkTitle"></div></div>` : ''}
<div id="outro" class="card"><div class="big" id="o1"></div>${copy.cta ? `<div class="cta">${escHtml(copy.cta)}</div>` : ''}${brand.logo ? `<img src="${brand.logo}" alt="">` : ''}<p class="u">${brand.site}</p></div>
</div>
<script>
const T=${TEMPO};
const $=id=>document.getElementById(id);
const words=(el,text,{key=[],delay=0,step=90}={})=>{el.innerHTML='';text.split(' ').forEach((w,i)=>{const s=document.createElement('span');s.className='w'+(key.includes(i)?' k':'');s.textContent=w;s.style.animationDelay=((delay+i*step)*T)+'ms';el.appendChild(s);});};
const INTRO=${esc(copy.intro)};
window.intro=()=>{words($('i1'),INTRO[0]||'',{step:90});if(INTRO[1])setTimeout(()=>{$('i2').classList.add('on');words($('i2'),INTRO[1],{delay:90,step:90});},520*T);else $('i2').remove();};
window.introOut=()=>$('intro').classList.add('out');
const HOOK=${esc(copy.hook)};
/* Mensajes cada step ms (con un poco de variación, como un chat real); el contador sube con cada uno. */
window.hook=(step=320)=>{if(!HOOK)return;/* Con gancho no hay intro de marca: su tarjeta taparía la escena. */const it=$('intro');if(it&&!it.classList.contains('out'))it.style.display='none';const col=$('hkCol'),chat=col.parentElement,lock=HOOK.style==='lock',badge=lock?$('hkCounter'):$('hkBadge');let n=Number(badge.textContent)||0;
  (HOOK.messages||[]).forEach((m,i)=>setTimeout(()=>{const b=document.createElement('div');b.className='bub';const o=typeof m==='string'?{text:m}:m;
    if(lock){b.innerHTML='<i></i><div><small></small><span></span></div>';b.querySelector('i').textContent=HOOK.icon||'💬';b.querySelector('small').textContent=(o.from||'')+' · ahora';}
    else b.innerHTML=(o.from?'<small></small>':'')+'<span></span>';if(o.from&&!lock)b.querySelector('small').textContent=o.from;b.querySelector('span').textContent=o.text;col.appendChild(b);
    col.style.transform='translateY('+(chat.clientHeight-col.offsetHeight)+'px)';badge.textContent=(lock?'+':'')+String(n+=lock?(2+(i%4)):(1+(i%3===2?1:0)));badge.classList.remove('bump');void badge.offsetWidth;badge.classList.add('bump');
  },(i*step+(i%2?40:0))*T));};
window.hookTitle=(text,key=[])=>{$('hook').classList.add('titled');words($('hkTitle'),text,{key,step:80});};
window.hookOut=()=>$('hook').classList.add('out');
window.chip=(t,key=[])=>{const c=$('chip');if(!t){c.classList.remove('on');return;}c.innerHTML='';t.split(' ').forEach((w,i)=>{const s=document.createElement('span');if(key.includes(i))s.className='k';s.textContent=(i?' ':'')+w;c.appendChild(s);});void c.offsetWidth;c.classList.add('on');};
window.flash=()=>{const f=$('flash');f.classList.remove('go');void f.offsetWidth;f.classList.add('go');};
window.ticket=(t)=>{const el=$('ticket');if(!t){el.classList.remove('on');return;}el.innerHTML='';
  const sm=document.createElement('small');sm.textContent=t.label||'NUEVO PEDIDO';const h=document.createElement('h4');h.textContent=t.title||'';const ul=document.createElement('ul');
  (t.rows||[]).forEach(([k,v])=>{const li=document.createElement('li');const a=document.createElement('span');a.textContent=k;const b=document.createElement('b');b.textContent=v;li.append(a,b);ul.appendChild(li);});
  const tot=document.createElement('div');tot.className='tot';const x=document.createElement('span');x.textContent='Total';const y=document.createElement('b');y.textContent=t.total||'';tot.append(x,y);
  el.append(sm,h,ul,tot);void el.offsetWidth;el.classList.add('on');};
/* cam(x, y, escala, { ms, ry, rx }) — ms cambia la duración solo de este movimiento. */
window.cam=(x,y,s,o={})=>{const c=$('cam');c.style.transitionDuration=((o.ms||1000)*T)+'ms';c.style.transform='translate3d('+x+'px,'+y+'px,0) scale('+s+') rotateY('+(o.ry||0)+'deg) rotateX('+(o.rx||0)+'deg)';};
/* Sin transición (para dejar el teléfono dibujado antes de grabar). */
window.camInstant=(t)=>{const c=$('cam');c.style.transition='none';c.style.transform=t;void c.offsetWidth;requestAnimationFrame(()=>requestAnimationFrame(()=>{c.style.transition='';}));};
/* Cambio de título: las palabras viejas salen hacia arriba, la píldora se ajusta al ancho nuevo y las nuevas suben. */
window.caption=(text,key=[])=>{const c=$('cap');
  if(!text){c.classList.remove('on');return;}
  const fill=()=>{const was=c.classList.contains('on');const w0=c.offsetWidth;c.style.width='';words(c,text,{key,step:55});const w1=c.offsetWidth;
    if(was){c.style.width=w0+'px';void c.offsetWidth;c.style.width=w1+'px';}else{c.style.width=w1+'px';c.classList.add('on');}};
  const old=[...c.querySelectorAll('.w')];
  if(c.classList.contains('on')&&old.length){old.forEach((w,i)=>{w.classList.add('out');w.style.animationDelay=(i*14*T)+'ms';});setTimeout(fill,(150+old.length*14)*T);}else fill();};
let active='main';
/* Tras el cambio, el iframe de atrás se vacía: seguía vivo gastando pintado y CPU de su proceso. */
window.swapToAlt=(unload)=>{$('alt').classList.add('here');$('main').classList.add('gone');active='alt';if(unload)setTimeout(()=>{$('main').src='about:blank';},700*T);};
const frameXY=(x,y)=>{const r=$(active).getBoundingClientRect();const k=r.width/390;return [r.left+x*k,r.top+y*k];};
/* El dedo persigue su objetivo cuadro a cuadro: si la cámara o un panel se mueven, sigue encima del botón.
   El seguimiento depende del tiempo transcurrido, no de los cuadros: igual de ágil a 30 o a 60 fps. */
let fx=270,fy=1150,target=null,down=false,shown=false,last='',lastT=0;
(function loop(now){now=now||performance.now();const dt=Math.min(64,lastT?now-lastT:16.7);lastT=now;
  if(shown&&target){const [tx,ty]=frameXY(target[0],target[1]);const k=1-Math.pow(1-0.2,dt/16.67);fx+=(tx-fx)*k;fy+=(ty-fy)*k;
    const t='translate3d('+fx.toFixed(2)+'px,'+fy.toFixed(2)+'px,0) scale('+(down?0.78:1)+')';if(t!==last){$('finger').style.transform=t;last=t;}}
  requestAnimationFrame(loop);})();
window.fingerTo=(x,y)=>{target=[x,y];shown=true;$('finger').classList.add('on');};
window.fingerHide=()=>{shown=false;$('finger').classList.remove('on');};
window.press=()=>{down=true;$('phone').classList.add('press');const r=document.createElement('div');r.className='ripple';r.style.left=fx+'px';r.style.top=fy+'px';$('stage').appendChild(r);
  setTimeout(()=>{down=false;$('phone').classList.remove('press');},150*T);setTimeout(()=>r.remove(),650*T);};
window.celebrate=()=>{$('celebrate-bg').classList.add('on');
  setTimeout(()=>{$('celebrate').classList.add('on');words($('celebrateText'),${esc(copy.celebrate)},{step:120});
    const shoot=confetti.create($('fx'),{resize:true});const colors=${esc(brand.confetti)};
    shoot({particleCount:120,spread:75,startVelocity:55,origin:{x:.1,y:.9},angle:60,colors,scalar:1.1});
    shoot({particleCount:120,spread:75,startVelocity:55,origin:{x:.9,y:.9},angle:120,colors,scalar:1.1});
    setTimeout(()=>shoot({particleCount:160,spread:110,startVelocity:38,origin:{x:.5,y:.35},colors,scalar:.95}),400*T);},420*T);};
/* El texto entra cuando el círculo ya cubrió la pantalla (~0,6 s); si no, aparece sobre la escena anterior. */
window.outro=()=>{$('outro').classList.add('in');words($('o1'),${esc(copy.outro)},{delay:620,step:70,key:${esc(copy.outroKey)}});};
${ENGINE === 'live' ? `window.__chunks=[];
window.startRec=async()=>{const s=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:${FPS},width:${Math.round(W * DSF)},height:${Math.round(H * DSF)}},preferCurrentTab:true,audio:false});
  const rec=new MediaRecorder(s,{mimeType:'video/mp4;codecs=avc1.640028',videoBitsPerSecond:${BITRATE}});
  /* Durante la toma NO se toca el video: convertirlo a base64 cada segundo frenaba la escena (tirones). */
  rec.ondataavailable=e=>{if(e.data.size)window.__chunks.push(e.data);};
  window.__rec=rec;window.__stream=s;rec.start(1000);return s.getVideoTracks()[0].getSettings();};
window.stopRec=()=>new Promise(r=>{window.__rec.onstop=()=>{window.__stream.getTracks().forEach(t=>t.stop());window.__blob=new Blob(window.__chunks,{type:'video/mp4'});r(window.__blob.size)};window.__rec.stop();});` : ''}
window.readSlice=(i)=>new Promise(r=>{const size=4*1024*1024;const part=window.__blob.slice(i*size,(i+1)*size);if(!part.size)return r(null);const fr=new FileReader();fr.onload=()=>r(String(fr.result).split(',')[1]);fr.readAsDataURL(part);});
</script></body></html>`;

// Página aparte que recibe cada foto y la codifica a H.264 (WebCodecs) dentro de un MP4 (mp4-muxer).
const ENCODER = `<!doctype html><html><head><meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.1/build/mp4-muxer.min.js"></script></head><body><script>
let enc,muxer,n=0,fps=60,err=null,queue=Promise.resolve();
window.encInit=async({w,h,rate,bitrate,audio})=>{fps=rate;
  // Nivel H.264 suficiente para 1080×1920 a 60 fps (4.2 o más); se prueba de mayor a menor.
  const codecs=['avc1.640033','avc1.64002a','avc1.640028','avc1.4d0033','avc1.42e033'];let config=null;
  for(const codec of codecs){const c={codec,width:w,height:h,bitrate,framerate:rate,avc:{format:'avc'},latencyMode:'quality'};
    const s=await VideoEncoder.isConfigSupported(c).catch(()=>null);if(s&&s.supported){config=c;break;}}
  if(!config)throw new Error('Este navegador no codifica H.264 con WebCodecs');
  muxer=new Mp4Muxer.Muxer({target:new Mp4Muxer.ArrayBufferTarget(),video:{codec:'avc',width:w,height:h,frameRate:rate},...(audio?{audio:{codec:'aac',numberOfChannels:2,sampleRate:48000}}:{}),fastStart:'in-memory'});
  enc=new VideoEncoder({output:(chunk,meta)=>muxer.addVideoChunk(chunk,meta),error:(e)=>{err=String(e);}});
  enc.configure(config);return config.codec;};
const add=async(b64)=>{const blob=await (await fetch('data:image/jpeg;base64,'+b64)).blob();const bmp=await createImageBitmap(blob);
  const f=new VideoFrame(bmp,{timestamp:Math.round(n*1e6/fps),duration:Math.round(1e6/fps)});
  enc.encode(f,{keyFrame:n%(fps*2)===0});f.close();bmp.close();n++;
  while(enc.encodeQueueSize>8)await new Promise(r=>setTimeout(r,4));};
window.encFrame=(b64)=>{if(err)throw new Error(err);queue=queue.then(()=>add(b64));return queue;};
/* Voz en off: cada frase se ubica en su instante del video, se mezcla en estéreo a 48 kHz y se codifica en AAC. */
window.encAudio=async({clips,total,gain})=>{const SR=48000;const ctx=new OfflineAudioContext(2,Math.ceil(total*SR),SR);const master=ctx.createGain();master.gain.value=gain;
  const comp=ctx.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=3;comp.attack.value=.004;comp.release.value=.2;master.connect(comp).connect(ctx.destination);
  const noise=ctx.createBuffer(1,SR,SR);{const d=noise.getChannelData(0);let x=12345;for(let i=0;i<SR;i++){x=(x*1103515245+12345)&0x7fffffff;d[i]=x/0x3fffffff-1;}}
  const env=(g,t,a,peak,dec)=>{g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(.0008,t+a+dec);};
  const tone=(t,f,type,peak,dec,dst)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=f;env(g,t,.005,peak,dec);o.connect(g).connect(dst);o.start(t);o.stop(t+dec+.05);};
  const burst=(t,len,dst,{type='highpass',f=1500,f2=null,q=.7,peak=.5,a=.003}={})=>{const src=ctx.createBufferSource();src.buffer=noise;const bq=ctx.createBiquadFilter();bq.type=type;bq.frequency.setValueAtTime(f,t);if(f2)bq.frequency.exponentialRampToValueAtTime(f2,t+len);bq.Q.value=q;
    const g=ctx.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+(a||len*.45));g.gain.exponentialRampToValueAtTime(.0008,t+len);src.connect(bq).connect(g).connect(dst);src.start(t,Math.random()*.5,len+.05);};
  /* Efectos sintetizados (sin archivos ni licencias): notificación, toque, barrido, éxito, campanita. */
  const SYN={pop:(t,d)=>{tone(t,1175,'sine',.42,.13,d);tone(t+.075,1760,'sine',.36,.2,d);},
    tap:(t,d)=>burst(t,.035,d,{f:1800,peak:.35}),
    whoosh:(t,d)=>burst(t,.42,d,{type:'bandpass',f:350,f2:2600,q:1.1,peak:.38,a:.2}),
    success:(t,d)=>[523.25,659.25,783.99,1046.5].forEach((f,i)=>tone(t+i*.085,f,'triangle',.32,.55,d)),
    ding:(t,d)=>{tone(t,1318.5,'sine',.36,1.1,d);tone(t,2637,'sine',.1,.6,d);}};
  const sfxBus=ctx.createGain();sfxBus.gain.value=.8;sfxBus.connect(comp);
  for(const c of clips){if(c.synth){const g=ctx.createGain();g.gain.value=c.volume??1;g.connect(sfxBus);(SYN[c.synth]||SYN.pop)(c.at,g);continue;}
    const buf=await ctx.decodeAudioData(Uint8Array.from(atob(c.b64),ch=>ch.charCodeAt(0)).buffer);const src=ctx.createBufferSource();src.buffer=buf;
    const g=ctx.createGain();g.gain.value=c.volume??1;src.connect(g).connect(master);src.start(c.at);}
  const out=await ctx.startRendering();let aerr=null;
  const aenc=new AudioEncoder({output:(chunk,meta)=>muxer.addAudioChunk(chunk,meta),error:(e)=>{aerr=String(e);}});
  aenc.configure({codec:'mp4a.40.2',sampleRate:SR,numberOfChannels:2,bitrate:160000});
  const L=out.getChannelData(0),R=out.getChannelData(1),N=1024*8;
  for(let i=0;i<out.length;i+=N){const n=Math.min(N,out.length-i);const data=new Float32Array(n*2);data.set(L.subarray(i,i+n),0);data.set(R.subarray(i,i+n),n);
    const ad=new AudioData({format:'f32-planar',sampleRate:SR,numberOfFrames:n,numberOfChannels:2,timestamp:Math.round(i*1e6/SR),data});aenc.encode(ad);ad.close();}
  await aenc.flush();if(aerr)throw new Error(aerr);return out.length/SR;};
window.encEnd=async()=>{await queue;await enc.flush();if(err)throw new Error(err);muxer.finalize();window.__blob=new Blob([muxer.target.buffer],{type:'video/mp4'});return {size:window.__blob.size,frames:n};};
window.readSlice=(i)=>new Promise(r=>{const size=4*1024*1024;const part=window.__blob.slice(i*size,(i+1)*size);if(!part.size)return r(null);const fr=new FileReader();fr.onload=()=>r(String(fr.result).split(',')[1]);fr.readAsDataURL(part);});
</script></body></html>`;

const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readBlob = async (pg) => {
	const chunks = [];
	for (let i = 0; ; i++) {
		const b64 = await pg.evaluate((n) => window.readSlice(n), i);
		if (!b64) break;
		chunks.push(Buffer.from(b64, 'base64'));
	}
	return Buffer.concat(chunks);
};

(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const browser = await chromium.launch({
		channel: S.browserChannel || 'msedge',
		headless: true,
		args: [
			'--auto-accept-this-tab-capture',
			'--autoplay-policy=no-user-gesture-required',
			`--force-device-scale-factor=${DSF}`,
			// El documento de la app se entrega desde aquí (sin frame-ancestors) y el navegador lo trataría
			// como externo, bloqueando su acceso a localhost. Solo en este navegador de grabación.
			'--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessChecks,BlockInsecurePrivateNetworkRequests',
		],
	});

	const log = [];
	const net = { fakes: [], allowWrites: [], block: [], quiet: [/google|doubleclick|googletagmanager/], ...(S.network || {}) };

	const guard = async (route) => {
		const req = route.request();
		const url = req.url();
		const method = req.method();

		// La app suele prohibir que la incrusten desde otro origen (X-Frame-Options / frame-ancestors).
		// Se quitan esas cabeceras solo aquí. content-encoding/length/transfer-encoding también: el cuerpo
		// llega descomprimido y con ellas el documento queda incoherente (la página no hidrata).
		// Permissions-Policy también se quita (en la app y en la página base de la escena): con geolocation=(self)
		// en la escena, el navegador no deja que el iframe de otro origen pida la ubicación («Permiso denegado»).
		const isStageDoc = url.startsWith(STAGE_ORIGIN + (S.stageBlankPath || '/robots.txt'));
		if (req.resourceType() === 'document' && method === 'GET' && (isStageDoc || url.startsWith(APP + (S.embedPathPrefix || '/')))) {
			const resp = await route.fetch();
			const headers = { ...resp.headers() };
			for (const h of ['x-frame-options', 'permissions-policy', 'content-encoding', 'content-length', 'transfer-encoding']) delete headers[h];
			if (headers['content-security-policy']) headers['content-security-policy'] = headers['content-security-policy'].replace(/frame-ancestors[^;]*;?/, '');
			return route.fulfill({ response: resp, headers });
		}

		if (net.block.some((re) => re.test(url))) {
			log.push(`bloqueado ${method} ${url.slice(0, 100)}`);
			return route.abort();
		}

		for (const fake of net.fakes) {
			if (!fake.match.test(url)) continue;
			if (fake.method && method !== fake.method && method !== 'OPTIONS') continue;
			const cors = fake.cors
				? { 'access-control-allow-origin': req.headers()['origin'] || '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS', 'access-control-allow-credentials': 'true' }
				: {};
			if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
			log.push(`FALSO ${fake.label || url.slice(0, 80)} (no llegó al servidor)`);
			return route.fulfill({ status: fake.status || 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(typeof fake.body === 'function' ? fake.body(req) : fake.body ?? {}) });
		}

		if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return route.continue();
		// Escrituras declaradas como lectura segura (p. ej. cálculo de precios). Nunca acciones de servidor.
		if (net.allowWrites.some((re) => re.test(url)) && !req.headers()['next-action']) return route.continue();
		if (!net.quiet.some((re) => re.test(url))) log.push(`BLOQUEADO ${method} ${url.slice(0, 120)}`);
		return route.abort();
	};

	// Ventanas emergentes (WhatsApp, pasarelas) se cierran; las páginas propias no (no tienen opener).
	const closePopups = (ctx) => ctx.on('page', async (p) => { if (await p.opener()) p.close().catch(() => {}); });

	// 1) Ensayo sin grabar en un contexto móvil: compila/descarga código e imágenes del recorrido.
	if (S.warmUp) {
		const warmCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, ...(S.geolocation ? { geolocation: S.geolocation, permissions: ['geolocation'] } : {}) });
		await warmCtx.route('**/*', guard);
		closePopups(warmCtx);
		const warm = await warmCtx.newPage();
		global.__page = warm;
		await S.warmUp({ page: warm, app: APP, sleep: realSleep });
		await warmCtx.close();
		console.log('ensayo listo');
	}

	// 2) Escena de grabación
	// Ubicación simulada (p. ej. para que la app calcule un envío): la app la pide dentro de su iframe.
	const geo = S.geolocation ? { geolocation: S.geolocation } : {};
	const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF, ...geo });
	// Chrome decide el permiso según el sitio de la página principal (la escena), no el del iframe: se dan los dos.
	if (S.geolocation) for (const origin of [APP, STAGE_ORIGIN]) await context.grantPermissions(['geolocation'], { origin });
	// La ubicación simulada de Playwright no llega a los iframes de otro origen (la pedían y se agotaba el tiempo):
	// se responde desde la propia página con las coordenadas del escenario, solo en este navegador.
	if (S.geolocation) await context.addInitScript((g) => {
		if (!navigator.geolocation) return;
		const pos = () => ({ coords: { latitude: g.latitude, longitude: g.longitude, accuracy: g.accuracy ?? 20, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() });
		navigator.geolocation.getCurrentPosition = (ok) => { setTimeout(() => ok(pos()), 350); };
		navigator.geolocation.watchPosition = (ok) => { setTimeout(() => ok(pos()), 350); return 1; };
		navigator.geolocation.clearWatch = () => {};
	}, S.geolocation);
	await context.route('**/*', guard);
	closePopups(context);
	// Reloj virtual en cada documento (escena e iframes), antes que sus propios scripts. Inactivo hasta el primer tick.
	if (ENGINE === 'render') await context.addInitScript(virtualTime);
	const page = await context.newPage();
	global.__page = page;
	// Origen distinto al de la app (127.0.0.1 vs localhost): el iframe va en otro proceso y sus
	// tirones no congelan la cámara ni el dedo. También es contexto seguro para getDisplayMedia.
	await page.goto(`${STAGE_ORIGIN}${S.stageBlankPath || '/robots.txt'}`);
	await page.setContent(STAGE, { waitUntil: 'networkidle' });
	if (ENGINE === 'render') await page.evaluate(virtualTime); // por si setContent reemplazó la ventana
	await page.evaluate(() => document.fonts.ready);

	const urls = S.urls || {};
	await page.evaluate(([m, a]) => { document.getElementById('main').src = m; if (a) document.getElementById('alt').src = a; }, [APP + urls.main, urls.alt ? APP + urls.alt : null]);
	const findFrame = async (id) => {
		for (let i = 0; i < 200; i++) {
			const handle = await page.$(`#${id}`);
			const f = handle && (await handle.contentFrame());
			if (f && f.url() !== 'about:blank') return f;
			await realSleep(100);
		}
		throw new Error(`el iframe #${id} no cargó`);
	};
	const frames = { main: await findFrame('main'), alt: urls.alt ? await findFrame('alt') : null };
	for (const f of Object.values(frames)) {
		if (!f) continue;
		await f.waitForLoadState('networkidle');
		await f.addStyleTag({ content: `*{scrollbar-width:none} ::-webkit-scrollbar{display:none} html{scroll-behavior:auto!important} ${S.frameCss || ''}` });
		// Imágenes ya decodificadas antes de grabar.
		await f.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 150)); } window.scrollTo(0, 0); });
	}
	// Precalentar la primera aparición del teléfono: se ubica un momento en su posición habitual (tapado
	// por la intro) para que el navegador ya lo tenga dibujado. Sin esto, la entrada da un tirón (~0,25 s).
	await page.evaluate(() => window.camInstant('translate3d(0px,60px,0) scale(.84)'));
	await realSleep(1200);
	await page.evaluate(() => window.camInstant('translate3d(0px,1150px,0) scale(.9)'));
	await realSleep(1500);

	// ---- Reloj y captura ----
	// live: el tiempo es el real. render: el tiempo lo lleva `clock` y avanza de a un tick (1/60 s).
	// skipped: tiempo que corrió fuera de cámara (offCamera). El video (y la voz) usan vt - skipped.
	const clock = { vt: 0, stop: false, waiters: [], capture: true, skipped: 0 };
	const nowVideo = () => (clock.vt - clock.skipped) / 1000;
	const sleep = ENGINE === 'render'
		? (ms) => new Promise((r) => { clock.waiters.push({ at: clock.vt + ms * TEMPO, r }); })
		: (ms) => realSleep(ms * TEMPO);

	// Voz en off (voiceover.cjs la genera antes). Cada api.say(id) la ubica en el instante actual del video.
	const voiceDir = S.voice ? path.resolve(S.voice.dir || path.join(OUT, 'voz')) : null;
	const voice = voiceDir && fs.existsSync(path.join(voiceDir, 'voz.json')) ? JSON.parse(fs.readFileSync(path.join(voiceDir, 'voz.json'), 'utf8')) : null;
	if (S.voice && !voice) { console.error(`Falta la voz: corre primero  node ${path.join(__dirname, 'voiceover.cjs')} ${scenarioPath} ${OUT}`); process.exit(1); }
	if (voice) for (const id of Object.keys(S.voice.lines)) if (voice[id]?.text !== S.voice.lines[id]) { console.error(`La frase «${id}» cambió: vuelve a correr voiceover.cjs`); process.exit(1); }
	const clips = [];
	let voiceEnd = 0; // segundo del video en que termina la última frase
	let captionOn = false;
	let camState = { x: 0, y: 1150, s: 0.9 };

	let encPage = null;
	let pump = null;
	const startRender = async () => {
		const encCtx = await browser.newContext();
		encPage = await encCtx.newPage();
		await encPage.goto(`${STAGE_ORIGIN}${S.stageBlankPath || '/robots.txt'}`); // origen seguro (WebCodecs lo exige)
		await encPage.setContent(ENCODER, { waitUntil: 'networkidle' });
		const codec = await encPage.evaluate((o) => window.encInit(o), { w: Math.round(W * DSF), h: Math.round(H * DSF), rate: FPS, bitrate: BITRATE, audio: !!voice || SFX });
		const cdp = await context.newCDPSession(page);
		console.log('render', JSON.stringify({ w: Math.round(W * DSF), h: Math.round(H * DSF), fps: FPS, codec, mbps: +(BITRATE / 1e6).toFixed(1) }));

		const TICK = 1000 / Math.max(60, FPS);
		const PROF = process.env.VT_PROFILE ? { tick: 0, shot: 0, enc: 0, n: 0, frame: {} } : null;
		const t0 = Date.now();
		pump = (async () => {
			let captured = 0, pending = null;
			for (let i = 0; !clock.stop; i++) {
				const to = i * TICK;
				if (!clock.capture && i > 0) clock.skipped += TICK;
				const paint = clock.capture && to - clock.skipped + 1e-6 >= (captured * 1000) / FPS;
				// Todos los documentos avanzan al mismo instante (los que no tienen reloj devuelven al tiro).
				const a0 = Date.now();
				await Promise.all(page.frames().map((f) => { const s0 = Date.now(); return Promise.race([
					f.evaluate(([t, p]) => (window.__vtTick ? window.__vtTick(t, p) : 0), [to, paint]).catch(() => {}),
					realSleep(2000),
				]).then(() => { if (PROF) PROF.frame[f.url().slice(0, 60)] = (PROF.frame[f.url().slice(0, 60)] || 0) + Date.now() - s0; }); }));
				if (PROF) PROF.tick += Date.now() - a0;
				clock.vt = to;
				if (paint) {
					const b0 = Date.now();
					// A veces el navegador no entrega la foto (p. ej. mientras compone un cambio grande): se reintenta.
					let data = null;
					for (let k = 0; !data; k++) {
						try { ({ data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, optimizeForSpeed: true })); }
						catch (e) { if (k >= 5) throw e; await realSleep(120 * (k + 1)); }
					}
					const c0 = Date.now();
					if (pending) await pending;
					if (PROF) { PROF.shot += c0 - b0; PROF.enc += Date.now() - c0; PROF.n++; if (PROF.n % 60 === 0) { console.log('perfil/cuadro ms', JSON.stringify({ tick: PROF.tick / PROF.n | 0, shot: PROF.shot / PROF.n | 0, enc: PROF.enc / PROF.n | 0, frames: Object.fromEntries(Object.entries(PROF.frame).map(([k, v]) => [k, v / PROF.n | 0])) })); } }
					pending = encPage.evaluate((b) => window.encFrame(b), data);
					captured++;
					if (captured % (FPS * 5) === 0) console.log(`  ${(captured / FPS).toFixed(0)} s de video (${((Date.now() - t0) / 1000).toFixed(0)} s reales)`);
				}
				const due = clock.waiters.filter((w) => w.at <= clock.vt);
				clock.waiters = clock.waiters.filter((w) => w.at > clock.vt);
				due.forEach((w) => w.r());
			}
			if (pending) await pending;
		})();
		// Un error en la captura debe cortar la toma, no dejar el guion esperando para siempre.
		pump.catch((e) => { console.error(e); process.exit(1); });
	};

	let frame = frames.main;

	const api = {
		page,
		frames,
		sleep,
		engine: ENGINE,
		waitMs: WAIT_MS,
		log: (m) => console.log(m),
		frame: () => frame,
		useFrame: (f) => { frame = f; },
		/** cam(x, y, escala, { ms, ry, rx }). Compatibilidad: cam(x, y, escala, rotY, rotX). */
		/** cam(x, y, escala, { ms, ry, rx, free }). Con franja de títulos, el borde superior del teléfono no sube de ella (free: sin límite). */
		cam: (x, y, s, o = {}, rx = 0) => {
			const opts = typeof o === 'number' ? { ry: o, rx } : o;
			if (BAND && captionOn && !opts.free) y = Math.max(y, BAND_BOTTOM - H / 2 + 432 * s);
			camState = { x, y, s };
			if (process.env.CAM_LOG) console.log(`cam ${nowVideo().toFixed(2)}s x=${x} y=${Math.round(y)} s=${s} ms=${opts.ms ?? 1000}${captionOn ? ' [título]' : ''}`);
			return page.evaluate(([a, b, c, op]) => window.cam(a, b, c, op), [x, y, s, opts]);
		},
		caption: async (text, key = []) => {
			captionOn = !!text;
			await page.evaluate(([t, k]) => window.caption(t, k), [text, key]);
			// Si el teléfono estaba metido en la franja, baja a su lugar.
			if (BAND && captionOn && camState.y < BAND_BOTTOM - H / 2 + 432 * camState.s) await api.cam(camState.x, camState.y, camState.s, { ms: 600 });
		},
		intro: () => page.evaluate(() => window.intro()),
		introOut: () => page.evaluate(() => window.introOut()),
		celebrate: () => { api.sfx('success', { at: 0.42 * TEMPO }); return page.evaluate(() => window.celebrate()); },
		outro: () => { api.sfx('whoosh', { volume: 0.8 }); return page.evaluate(() => window.outro()); },
		fingerHide: () => page.evaluate(() => window.fingerHide()),
		hook: async (step = 320) => {
			await page.evaluate((st) => window.hook(st), step);
			(copy.hook?.messages || []).forEach((_, i) => api.sfx('pop', { at: ((i * step + (i % 2 ? 40 : 0)) * TEMPO) / 1000, volume: 0.55 + (i % 3) * 0.1 }));
		},
		hookTitle: (text, key = []) => page.evaluate(([t, k]) => window.hookTitle(t, k), [text, key]),
		hookOut: () => { api.sfx('whoosh'); return page.evaluate(() => window.hookOut()); },
		/** Duración (s) de una frase de la voz en off. */
		voiceDuration: (id) => voice?.[id]?.duration ?? 0,
		/** Pone a sonar la frase `id` en este instante del video (no espera). `wait: true` espera a que termine. */
		say: async (id, { wait = false, volume = 1, tail = 0 } = {}) => {
			if (!voice?.[id]) throw new Error(`No hay voz para «${id}»`);
			if (ENGINE !== 'render') { console.warn('say(): la voz solo se mezcla con el motor render'); }
			clips.push({ id, at: nowVideo(), volume });
			voiceEnd = nowVideo() + voice[id].duration;
			if (wait) await sleep(voice[id].duration * 1000 / TEMPO + tail);
		},
		/** ms que faltan para que termine la última frase (0 si ya terminó). Útil para que un movimiento dure lo que la voz. */
		voiceLeft: () => Math.max(0, voiceEnd * 1000 - nowVideo() * 1000),
		/** Globo grande con un dato (índices de palabras resaltadas); chip(null) lo oculta. */
		chip: (text, key = []) => { if (text) api.sfx('pop', { volume: 0.6 }); return page.evaluate(([t, k]) => window.chip(t, k), [text || null, key]); },
		/** Espera a que termine la última frase (+ gap ms): la voz corre continua, sin silencios largos. */
		waitVoice: async (gap = 120) => { const left = voiceEnd * 1000 + gap - nowVideo() * 1000; if (left > 0) await sleep(left / TEMPO); },
		/** Efecto de sonido sintetizado: pop, tap, whoosh, success, ding. `at` en segundos desde ahora. */
		sfx: (name, { volume = 1, at = 0 } = {}) => { if (SFX) clips.push({ synth: name, at: nowVideo() + at, volume }); },
		/** Saltar pasos: lo que pasa en fn corre fuera de cámara (el tiempo del video no avanza) y se entra con un destello. */
		offCamera: async (fn, { settle = 350 } = {}) => {
			if (ENGINE !== 'render') return fn();
			clock.capture = false;
			try { await fn(); await sleep(settle); } finally { clock.capture = true; }
		},
		cut: async (fn, opts) => { await api.offCamera(fn, opts); await page.evaluate(() => window.flash()); api.sfx('whoosh', { volume: 0.7 }); },
		ticket: (t) => { if (t) api.sfx('ding'); return page.evaluate((x) => window.ticket(x), t || null); },
		/** Cambio a la pantalla precargada con un «push» (en vez de navegar: una navegación congela ~1 s). */
		// { unload: false } si el guion vuelve a usar frames.main después del cambio.
		swapToAlt: async ({ unload = true } = {}) => { await page.evaluate((u) => window.swapToAlt(u), unload); frame = frames.alt; },
	};

	/** Scroll con aceleración y frenado suaves, cuadro a cuadro (no uses behavior:'smooth'). */
	api.smoothScroll = async (dy, ms = 1100) => {
		const f = frame;
		await f.evaluate(({ dy, ms }) => {
			const start = window.scrollY; const t0 = performance.now();
			const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
			const step = (now) => { const k = Math.min(1, (now - t0) / ms); window.scrollTo(0, start + dy * ease(k)); if (k < 1) requestAnimationFrame(step); };
			requestAnimationFrame(step);
		}, { dy, ms: ms * TEMPO });
		await sleep(ms + 40);
	};

	const resolve = (target) => (typeof target === 'string' ? frame.locator(target).first() : target);
	const centerIn = (el) => el.evaluate((n) => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });

	/** Centro del elemento; si no está a la vista, scroll suave (salvo que esté en algo fijo: diálogo, barra). */
	api.centerOf = async (target) => {
		const el = resolve(target);
		const box = await el.evaluate((n) => {
			const r = n.getBoundingClientRect();
			let fixed = false;
			for (let a = n; a && a !== document.body; a = a.parentElement) {
				const pos = getComputedStyle(a).position;
				if (pos === 'fixed' || pos === 'sticky' || a.getAttribute('role') === 'dialog') { fixed = true; break; }
			}
			return { x: r.left + r.width / 2, y: r.top + r.height / 2, fixed };
		});
		if (!box.fixed && (box.y < 140 || box.y > 740)) {
			await api.smoothScroll(box.y - 430, 850);
			return centerIn(el);
		}
		return box;
	};

	/**
	 * Encuadra un elemento: calcula la cámara para que quede a la altura `at` (0 arriba, 1 abajo)
	 * con el acercamiento `scale`. Evita adivinar valores de `y` a mano.
	 */
	api.focus = async (target, { scale = 1.12, at = null, x = 0, ms, minScale = 0.66 } = {}) => {
		const el = resolve(target);
		await el.waitFor({ state: 'visible', timeout: WAIT_MS });
		const { y } = await centerIn(el);
		if (BAND) {
			// Centro de la ventana libre (entre la franja y el borde seguro de abajo); si el elemento está muy abajo
			// en la pantalla de la app, el teléfono se achica lo necesario para que no suba a la franja.
			const top = captionOn ? BAND_BOTTOM : SAFE === 'instagram' ? 118 : 30;
			let want = at != null ? at * H : (top + SAFE_BOTTOM) / 2;
			// Si con esa escala el teléfono se metería en la franja, se apoya justo bajo ella (el elemento baja).
			// Solo si así se saldría de la zona segura de abajo se achica, y nunca por debajo de minScale (legible).
			if (want - scale * (y + 10) < top) {
				const lowest = SAFE === 'instagram' ? H * 0.84 : H - 30;
				if (top + scale * (y + 10) > lowest) scale = Math.max(minScale, (lowest - top) / (y + 10));
				want = top + scale * (y + 10);
			}
			const ty = Math.round(want - H / 2 - scale * (y - 422));
			return api.cam(x, ty, +scale.toFixed(3), { ms });
		}
		at = at ?? 0.55;
		// En la cámara: pantalla del teléfono arriba a la izquierda en (-195, -422) respecto del centro de la escena.
		const ty = Math.round(at * H - H / 2 - scale * (y - 422));
		const lim = 432 * scale; // nunca más allá del borde del teléfono
		return api.cam(x, Math.max(-lim, Math.min(lim, ty)), scale, { ms });
	};

	/** El dedo viaja al objetivo, se vuelve a medir (pudo moverse), presiona y recién ahí hace clic. */
	api.tap = async (target, { travel = 560, hold = 130, click = true } = {}) => {
		const el = resolve(target);
		await el.waitFor({ state: 'visible', timeout: WAIT_MS });
		const { x, y } = await api.centerOf(el);
		await page.evaluate(([a, b]) => window.fingerTo(a, b), [x, y]);
		await sleep(travel);
		const again = await centerIn(el);
		await page.evaluate(([a, b]) => window.fingerTo(a, b), [again.x, again.y]);
		await sleep(140);
		await page.evaluate(() => window.press());
		api.sfx('tap', { volume: 0.5 });
		await sleep(hold);
		// click() del DOM: no depende de la geometría con transforms de la escena.
		if (click) await el.evaluate((n) => n.click());
	};

	/** Toca el campo y "escribe": rellena prefijos crecientes (los campos con máscara no se desordenan). */
	api.typeInto = async (target, text, { delay = 34 } = {}) => {
		const el = resolve(target);
		await api.tap(el, { travel: 480 });
		for (let i = 1; i <= text.length; i++) {
			await el.fill(text.slice(0, i));
			await sleep(text[i - 1] === ' ' ? delay / 2 : delay);
		}
		await sleep(200);
	};

	const name = `${S.name || 'demo'}${MODE === 'web' ? '-web' : ''}.mp4`;
	const file = path.join(OUT, name);
	const tStart = Date.now();

	if (ENGINE === 'render') {
		await startRender();
		await sleep(250);
		await S.run(api);
		await sleep(300);
		clock.stop = true;
		await pump;
		if (clips.length || voice || SFX) {
			// Sin clips igual se escribe una pista (silencio): el MP4 se declaró con audio al empezar.
			const payload = clips.map((c) => (c.synth ? c : { b64: fs.readFileSync(path.join(voiceDir, voice[c.id].file)).toString('base64'), at: c.at, volume: c.volume }));
			const secs = await encPage.evaluate((o) => window.encAudio(o), { clips: payload, total: nowVideo(), gain: S.voice?.gain ?? 1 });
			console.log(`audio: ${clips.filter((c) => !c.synth).length} frases y ${clips.filter((c) => c.synth).length} efectos (${secs.toFixed(1)} s)`);
		}
		const { frames: n } = await encPage.evaluate(() => window.encEnd());
		fs.writeFileSync(file, await readBlob(encPage));
		console.log(`${n} cuadros · ${(n / FPS).toFixed(1)} s de video en ${((Date.now() - tStart) / 1000).toFixed(0)} s`);
	} else {
		const settings = await page.evaluate(() => window.startRec());
		console.log('captura', JSON.stringify({ w: settings.width, h: settings.height, fps: settings.frameRate }));
		// Colchón: el arranque y el cierre del grabador dejan un primer/último cuadro largo; así cae en fondo quieto.
		await sleep(300);
		await S.run(api);
		await sleep(400);
		await page.evaluate(() => window.stopRec());
		fs.writeFileSync(file, await readBlob(page));
	}

	console.log('--- red ---');
	console.log(log.length ? log.join('\n') : '(nada bloqueado ni falsificado)');
	console.log('guardado', file, (fs.statSync(file).size / 1e6).toFixed(1) + ' MB');
	await browser.close();
})().catch(async (e) => {
	console.error(e);
	try { await global.__page?.screenshot({ path: path.join(OUT, 'fallo.png') }); console.error('captura del fallo: fallo.png'); } catch {}
	process.exit(1);
});
