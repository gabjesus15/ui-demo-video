#!/usr/bin/env node
/**
 * Motor de grabación de videos demo verticales (reel 9:16) de una app web real.
 *
 *   node record-demo.cjs <escenario.cjs> <carpeta-salida> [master|web] [--fps=60] [--size=720] [--safe=instagram] [--bitrate=…]
 *
 *   master → 1080×1920, 30 fps, ~6 Mbps (redes sociales)
 *   web    → 720×1280, 30 fps, ~1.4 Mbps (landing). Mejor: sacar la web de la master con downscale.cjs.
 *
 * Se ejecuta desde la raíz del proyecto que tenga `playwright` instalado (se resuelve desde el cwd).
 * Necesita Microsoft Edge o Google Chrome instalados (Chromium de Playwright no trae H.264).
 *
 * El escenario (ver example-scenario.cjs) define: URLs, marca, textos, reglas de red
 * (qué respuestas se falsifican y qué se deja pasar), un ensayo sin grabar y el guion.
 *
 * Seguridad: por defecto se CORTA toda petición que no sea GET/HEAD/OPTIONS. Solo pasan las
 * escrituras que el escenario declare como lectura segura, y las que declare como `fakes` se
 * responden aquí mismo sin llegar al servidor. Revisa el log al final: ahí sale todo lo bloqueado.
 */
const fs = require('fs');
const path = require('path');
// Playwright del proyecto actual o, si no hay, el instalado junto a la skill (npm install en su carpeta).
const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(), path.join(__dirname, '..')] }));

const argv = process.argv.slice(2);
const flags = Object.fromEntries(argv.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const [scenarioPath, OUT, modeArg] = argv.filter((a) => !a.startsWith('--'));
if (!scenarioPath || !OUT) {
	console.error('Uso: node record-demo.cjs <escenario.cjs> <carpeta-salida> [master|web] [--fps=60] [--size=720] [--safe=instagram] [--bitrate=12000000]');
	process.exit(1);
}
const S = require(path.resolve(scenarioPath));
const MODE = modeArg === 'web' ? 'web' : 'master';

// Escena en CSS px; la resolución real sale del device scale factor.
const W = 540;
const H = 960;
// Ancho final: 1080 (master) o 720 (web); --size=720 fuerza el ancho (p. ej. 720 a 60 fps, que el codificador sostiene mejor).
const DSF = flags.size ? Number(flags.size) / W : MODE === 'web' ? 4 / 3 : 2;
// 30 por defecto: a 1080p, 60 fps puede saturar el codificador y botar cuadros (mide con qa-tools gaps).
// Se cambia con --fps=60 o `video.fps` en el escenario; el bitrate sube en proporción.
const FPS = Number(flags.fps || S.video?.fps || 30);
// Zonas seguras de redes: Instagram tapa arriba (~12 %, «Reels» y cámara), abajo (~20 %, nombre,
// descripción, música) y el costado derecho (botones). Se bajan los títulos y la escena se achica y sube.
const SAFE = flags.safe || S.video?.safe || null;
// La escena (teléfono) se achica y sube un poco para quedar fuera de las franjas que tapa Instagram.
const PERSP_SAFE = SAFE === 'instagram' ? ';transform:translate(-14px,-34px) scale(.84);transform-origin:50% 42%' : '';
const BITRATE = Number(flags.bitrate || S.video?.bitrate || 6_000_000 * (DSF / 2) ** 2 * (FPS / 30));

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
	...(S.brand || {}),
};
const copy = { intro: ['¿Y cómo', 'funciona?'], celebrate: '¡Y listo!', celebrateSub: '', outro: '', outroKey: [], ...(S.copy || {}) };

const esc = (v) => JSON.stringify(v);

const STAGE = `<!doctype html><html><head><meta charset="utf-8">
<link href="${brand.fontsHref}" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js"></script>
<style>
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:${brand.accent}}
#stage{position:relative;width:${W}px;height:${H}px;overflow:hidden;font-family:${brand.uiFont},system-ui,sans-serif}
#scene{position:absolute;inset:0;background:${brand.sceneBg}}
/* Círculo chico que se agranda: una capa de 2400 px tardaba en dibujarse y el barrido arrancaba tarde. */
#celebrate-bg{position:absolute;left:50%;top:55%;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;background:${brand.celebrateBg};will-change:transform;transform:scale(0);transition:transform 1.1s cubic-bezier(.77,0,.18,1)}
#celebrate-bg.on{transform:scale(26)}
#persp{position:absolute;inset:0;perspective:1600px${PERSP_SAFE}}
#cam{position:absolute;left:50%;top:50%;width:0;height:0;transform-style:preserve-3d;transition:transform 1.35s cubic-bezier(.65,0,.35,1)}
#phone{position:absolute;left:-205px;top:-432px;width:410px;height:864px;border-radius:58px;background:#0c0c0e;padding:10px;
  box-shadow:0 2px 0 1px #2a2a2e inset,0 50px 90px -30px rgba(40,45,120,.55),0 18px 40px -20px rgba(0,0,0,.45);transition:transform .18s cubic-bezier(.16,1,.3,1)}
#phone.press{transform:scale(.992)}
#screen{position:relative;width:390px;height:844px;border-radius:48px;overflow:hidden;background:#fff}
#screen iframe{position:absolute;inset:0;width:390px;height:844px;border:0;display:block;transition:opacity .45s cubic-bezier(.4,0,.2,1)}
#alt{opacity:0;pointer-events:none}
#finger{position:absolute;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;z-index:8;pointer-events:none;will-change:transform;
  background:rgba(255,255,255,.55);border:2.5px solid #fff;box-shadow:0 0 0 6px color-mix(in srgb,${brand.accent} 28%,transparent),0 10px 24px rgba(20,24,90,.35);transition:opacity .4s;opacity:0}
#finger.on{opacity:1}
.ripple{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:2px solid rgba(255,255,255,.95);z-index:7;pointer-events:none;animation:rip .6s cubic-bezier(.16,1,.3,1) forwards}
@keyframes rip{from{opacity:.9;transform:scale(.7)}to{opacity:0;transform:scale(2.3)}}
#cap{position:absolute;left:50%;top:${SAFE === 'instagram' ? 118 : 34}px;transform:translateX(-50%);z-index:9;white-space:nowrap;padding:12px 26px 8px;border-radius:22px;background:#fff;
  box-shadow:0 18px 40px -18px rgba(30,35,120,.55);font-family:${brand.displayFont};font-size:46px;line-height:1;color:#101014;transition:opacity .35s;opacity:0}
#cap.on{opacity:1}
/* Sin filter:blur animado: es de lo más caro de pintar y bota cuadros. Subida + fundido se ve casi igual. */
#cap .w{display:inline-block;margin-right:.22em;opacity:0;transform:translateY(60%);animation:win .55s cubic-bezier(.16,1,.3,1) forwards}
#cap .w:last-child,.big .w:last-child{margin-right:0}
#cap .k,.big .k{color:${brand.accent}}
@keyframes win{to{opacity:1;transform:none}}
.card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:10}
.big{font-family:${brand.displayFont};font-weight:400;font-size:108px;line-height:.9;text-align:center}
.big .w{display:inline-block;margin-right:.2em;opacity:0;transform:translateY(45%) scale(.82);will-change:transform,opacity;animation:pop .7s cubic-bezier(.16,1,.3,1) forwards}
@keyframes pop{to{opacity:1;transform:none}}
/* Barridos con transform (capa ya dibujada) y no con clip-path, que se repinta en cada cuadro y da tirones. */
#intro{background:${brand.accent};will-change:transform;transition:transform 1s cubic-bezier(.77,0,.18,1)}
#intro.out{transform:translate3d(0,-101%,0)}
#intro .l1{color:#fff}
#intro .l2{margin-top:10px;display:inline-block;background:#fff;color:${brand.accent};padding:6px 18px 0;border-radius:18px;clip-path:inset(0 100% 0 0);transition:clip-path .7s cubic-bezier(.77,0,.18,1)}
#intro .l2 .k,#intro .l2 .w{color:${brand.accent}}
#intro .l2.on{clip-path:inset(0 0 0 0)}
#celebrate{z-index:9;pointer-events:none;justify-content:flex-start;padding-top:${SAFE === 'instagram' ? 130 : 70}px}
#celebrate .big{color:#fff;font-size:150px;text-shadow:0 12px 40px rgba(0,60,20,.35)}
#celebrate p{margin-top:10px;font-weight:600;font-size:22px;color:rgba(255,255,255,.92);opacity:0;transition:opacity .6s .5s}
#celebrate.on p{opacity:1}
#outro{background:transparent;overflow:hidden}
#outro::before{content:'';position:absolute;left:50%;top:50%;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;background:${brand.accent};will-change:transform;transform:scale(0);transition:transform 1.1s cubic-bezier(.77,0,.18,1);z-index:-1}
#outro.in::before{transform:scale(26)}
#outro{z-index:10;isolation:isolate;pointer-events:none}
#outro .big{color:#fff;font-size:70px;line-height:.95;padding:0 40px}
/* Color (no opacity): una opacity fija pisaba la opacidad 0 de la animación y la palabra se veía antes de tiempo. */
#outro .big .k{color:rgba(255,255,255,.72)}
#outro img{width:190px;margin-top:56px;${brand.logoToWhite ? 'filter:brightness(0) invert(1);' : ''}opacity:0;transform:scale(.85);transition:all 1s cubic-bezier(.16,1,.3,1) 1.25s}
#outro p.u{margin-top:26px;color:rgba(255,255,255,.85);font-size:20px;letter-spacing:.08em;opacity:0;transition:opacity .8s 1.6s}
#outro.in img,#outro.in p.u{opacity:1;transform:none}
/* Píxel que cambia en cada cuadro: la captura solo emite fotogramas si algo cambia; así el ritmo es constante. */
#tick{position:absolute;right:0;bottom:0;width:2px;height:2px;z-index:20;pointer-events:none;background:#000;opacity:.02;animation:tick .1s steps(2) infinite}
@keyframes tick{50%{opacity:.03}}
canvas#fx{position:absolute;inset:0;width:100%;height:100%;z-index:9;pointer-events:none}
</style></head><body><div id="stage">
<div id="scene"></div><div id="celebrate-bg"></div>
<div id="persp"><div id="cam" style="transform:translate3d(0,1150px,0) scale(.9)"><div id="phone"><div id="screen">
<iframe id="main" src="about:blank"></iframe><iframe id="alt" src="about:blank"></iframe></div></div></div></div>
<div id="cap"></div><div id="finger"></div><div id="tick"></div>
<div id="celebrate" class="card"><div class="big" id="celebrateText"></div><p>${copy.celebrateSub}</p></div>
<canvas id="fx"></canvas>
<div id="intro" class="card"><div class="big l1" id="i1"></div><div class="big l2" id="i2"></div></div>
<div id="outro" class="card"><div class="big" id="o1"></div>${brand.logo ? `<img src="${brand.logo}" alt="">` : ''}<p class="u">${brand.site}</p></div>
</div>
<script>
const $=id=>document.getElementById(id);
const words=(el,text,{key=[],delay=0,step=90}={})=>{el.innerHTML='';text.split(' ').forEach((w,i)=>{const s=document.createElement('span');s.className='w'+(key.includes(i)?' k':'');s.textContent=w;s.style.animationDelay=(delay+i*step)+'ms';el.appendChild(s);});};
const INTRO=${esc(copy.intro)};
window.intro=()=>{words($('i1'),INTRO[0]||'',{step:120});if(INTRO[1])setTimeout(()=>{$('i2').classList.add('on');words($('i2'),INTRO[1],{delay:120,step:120});},700);else $('i2').remove();};
window.introOut=()=>$('intro').classList.add('out');
window.cam=(x,y,s,ry=0,rx=0)=>{$('cam').style.transform='translate3d('+x+'px,'+y+'px,0) scale('+s+') rotateY('+ry+'deg) rotateX('+rx+'deg)';};
/* Sin transición (para dejar el teléfono dibujado antes de grabar). */
window.camInstant=(t)=>{const c=$('cam');c.style.transition='none';c.style.transform=t;void c.offsetWidth;requestAnimationFrame(()=>requestAnimationFrame(()=>{c.style.transition='';}));};
window.caption=(text,key)=>{const c=$('cap');c.classList.remove('on');setTimeout(()=>{if(!text)return;words(c,text,{key,step:70});c.classList.add('on');},text?280:0);};
let active='main';
/* Tras el fundido, el iframe de atrás se vacía: seguía vivo gastando pintado y CPU de su proceso. */
window.swapToAlt=(unload)=>{$('alt').style.opacity='1';$('alt').style.pointerEvents='auto';$('main').style.opacity='0';$('main').style.pointerEvents='none';active='alt';if(unload)setTimeout(()=>{$('main').src='about:blank';},700);};
const frameXY=(x,y)=>{const r=$(active).getBoundingClientRect();const k=r.width/390;return [r.left+x*k,r.top+y*k];};
/* El dedo persigue su objetivo cuadro a cuadro: si la cámara o un panel se mueven, sigue encima del botón. */
/* Solo se mide y se escribe mientras el dedo está visible y algo cambió (antes: en cada cuadro, siempre). */
let fx=270,fy=1150,target=null,down=false,shown=false,last='';
(function loop(){if(shown&&target){const [tx,ty]=frameXY(target[0],target[1]);fx+=(tx-fx)*0.14;fy+=(ty-fy)*0.14;
  const t='translate3d('+fx.toFixed(2)+'px,'+fy.toFixed(2)+'px,0) scale('+(down?0.78:1)+')';if(t!==last){$('finger').style.transform=t;last=t;}}
  requestAnimationFrame(loop);})();
window.fingerTo=(x,y)=>{target=[x,y];shown=true;$('finger').classList.add('on');};
window.fingerHide=()=>{shown=false;$('finger').classList.remove('on');};
window.press=()=>{down=true;$('phone').classList.add('press');const r=document.createElement('div');r.className='ripple';r.style.left=fx+'px';r.style.top=fy+'px';$('stage').appendChild(r);
  setTimeout(()=>{down=false;$('phone').classList.remove('press');},170);setTimeout(()=>r.remove(),700);};
window.celebrate=()=>{$('celebrate-bg').classList.add('on');
  setTimeout(()=>{$('celebrate').classList.add('on');words($('celebrateText'),${esc(copy.celebrate)},{step:140});
    const shoot=confetti.create($('fx'),{resize:true});const colors=${esc(brand.confetti)};
    shoot({particleCount:120,spread:75,startVelocity:55,origin:{x:.1,y:.9},angle:60,colors,scalar:1.1});
    shoot({particleCount:120,spread:75,startVelocity:55,origin:{x:.9,y:.9},angle:120,colors,scalar:1.1});
    setTimeout(()=>shoot({particleCount:160,spread:110,startVelocity:38,origin:{x:.5,y:.35},colors,scalar:.95}),450);},650);};
/* El texto entra cuando el círculo azul ya cubrió la pantalla (~0,85 s), si no aparece sobre la escena anterior. */
window.outro=()=>{$('outro').classList.add('in');words($('o1'),${esc(copy.outro)},{delay:850,step:80,key:${esc(copy.outroKey)}});};
window.__chunks=[];
window.startRec=async()=>{const s=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:${FPS},width:${Math.round(W * DSF)},height:${Math.round(H * DSF)}},preferCurrentTab:true,audio:false});
  const rec=new MediaRecorder(s,{mimeType:'video/mp4;codecs=avc1.640028',videoBitsPerSecond:${BITRATE}});
  /* Durante la toma NO se toca el video: convertirlo a base64 cada segundo frenaba la escena (tirones). */
  rec.ondataavailable=e=>{if(e.data.size)window.__chunks.push(e.data);};
  window.__rec=rec;window.__stream=s;rec.start(1000);return s.getVideoTracks()[0].getSettings();};
window.stopRec=()=>new Promise(r=>{window.__rec.onstop=()=>{window.__stream.getTracks().forEach(t=>t.stop());window.__blob=new Blob(window.__chunks,{type:'video/mp4'});r(window.__blob.size)};window.__rec.stop();});
window.readSlice=(i)=>new Promise(r=>{const size=4*1024*1024;const part=window.__blob.slice(i*size,(i+1)*size);if(!part.size)return r(null);const fr=new FileReader();fr.onload=()=>r(String(fr.result).split(',')[1]);fr.readAsDataURL(part);});
</script></body></html>`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
		if (req.resourceType() === 'document' && method === 'GET' && url.startsWith(APP + (S.embedPathPrefix || '/'))) {
			const resp = await route.fetch();
			const headers = { ...resp.headers() };
			for (const h of ['x-frame-options', 'content-encoding', 'content-length', 'transfer-encoding']) delete headers[h];
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
		const warmCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
		await warmCtx.route('**/*', guard);
		closePopups(warmCtx);
		const warm = await warmCtx.newPage();
		global.__page = warm;
		await S.warmUp({ page: warm, app: APP, sleep });
		await warmCtx.close();
		console.log('ensayo listo');
	}

	// 2) Escena de grabación
	const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF });
	await context.route('**/*', guard);
	closePopups(context);
	const page = await context.newPage();
	global.__page = page;
	// Origen distinto al de la app (127.0.0.1 vs localhost): el iframe va en otro proceso y sus
	// tirones no congelan la cámara ni el dedo. También es contexto seguro para getDisplayMedia.
	await page.goto(`${STAGE_ORIGIN}${S.stageBlankPath || '/robots.txt'}`);
	await page.setContent(STAGE, { waitUntil: 'networkidle' });
	await page.evaluate(() => document.fonts.ready);

	const urls = S.urls || {};
	await page.evaluate(([m, a]) => { document.getElementById('main').src = m; if (a) document.getElementById('alt').src = a; }, [APP + urls.main, urls.alt ? APP + urls.alt : null]);
	const findFrame = async (id) => {
		for (let i = 0; i < 200; i++) {
			const handle = await page.$(`#${id}`);
			const f = handle && (await handle.contentFrame());
			if (f && f.url() !== 'about:blank') return f;
			await sleep(100);
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
	await sleep(1200);
	await page.evaluate(() => window.camInstant('translate3d(0px,1150px,0) scale(.9)'));
	await sleep(1500);

	let frame = frames.main;

	const api = {
		page,
		frames,
		sleep,
		log: (m) => console.log(m),
		frame: () => frame,
		useFrame: (f) => { frame = f; },
		cam: (x, y, s, ry = 0, rx = 0) => page.evaluate(([a, b, c, d, e]) => window.cam(a, b, c, d, e), [x, y, s, ry, rx]),
		caption: (text, key = []) => page.evaluate(([t, k]) => window.caption(t, k), [text, key]),
		intro: () => page.evaluate(() => window.intro()),
		introOut: () => page.evaluate(() => window.introOut()),
		celebrate: () => page.evaluate(() => window.celebrate()),
		outro: () => page.evaluate(() => window.outro()),
		fingerHide: () => page.evaluate(() => window.fingerHide()),
		/** Fundido al iframe precargado (en vez de navegar: una navegación congela ~1 s). */
		// { unload: false } si el guion vuelve a usar frames.main después del fundido.
		swapToAlt: async ({ unload = true } = {}) => { await page.evaluate((u) => window.swapToAlt(u), unload); frame = frames.alt; },
	};

	/** Scroll con aceleración y frenado suaves, cuadro a cuadro (no uses behavior:'smooth'). */
	api.smoothScroll = (dy, ms = 1400) => frame.evaluate(({ dy, ms }) => new Promise((res) => {
		const start = window.scrollY; const t0 = performance.now();
		const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
		const step = (now) => { const k = Math.min(1, (now - t0) / ms); window.scrollTo(0, start + dy * ease(k)); k < 1 ? requestAnimationFrame(step) : res(); };
		requestAnimationFrame(step);
	}), { dy, ms });

	const resolve = (target) => (typeof target === 'string' ? frame.locator(target).first() : target);

	/** Centro del elemento; si no está a la vista, scroll suave (salvo que esté en algo fijo: diálogo, barra). */
	api.centerOf = async (target) => {
		const el = resolve(target);
		let box = await el.evaluate((n) => {
			const r = n.getBoundingClientRect();
			let fixed = false;
			for (let a = n; a && a !== document.body; a = a.parentElement) {
				const pos = getComputedStyle(a).position;
				if (pos === 'fixed' || pos === 'sticky' || a.getAttribute('role') === 'dialog') { fixed = true; break; }
			}
			return { x: r.left + r.width / 2, y: r.top + r.height / 2, fixed };
		});
		if (!box.fixed && (box.y < 140 || box.y > 740)) {
			await api.smoothScroll(box.y - 430, 1100);
			box = await el.evaluate((n) => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
		}
		return box;
	};

	/** El dedo viaja al objetivo, se vuelve a medir (pudo moverse), presiona y recién ahí hace clic. */
	api.tap = async (target, { travel = 720, hold = 160, click = true } = {}) => {
		const el = resolve(target);
		await el.waitFor({ state: 'visible', timeout: 15000 });
		const { x, y } = await api.centerOf(el);
		await page.evaluate(([a, b]) => window.fingerTo(a, b), [x, y]);
		await sleep(travel);
		const again = await el.evaluate((n) => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
		await page.evaluate(([a, b]) => window.fingerTo(a, b), [again.x, again.y]);
		await sleep(180);
		await page.evaluate(() => window.press());
		await sleep(hold);
		// click() del DOM: no depende de la geometría con transforms de la escena.
		if (click) await el.evaluate((n) => n.click());
	};

	/** Toca el campo y "escribe": rellena prefijos crecientes (los campos con máscara no se desordenan). */
	api.typeInto = async (target, text, { delay = 38 } = {}) => {
		const el = resolve(target);
		await api.tap(el, { travel: 620 });
		for (let i = 1; i <= text.length; i++) {
			await el.fill(text.slice(0, i));
			await sleep(text[i - 1] === ' ' ? delay / 2 : delay);
		}
		await sleep(250);
	};

	const settings = await page.evaluate(() => window.startRec());
	console.log('captura', JSON.stringify({ w: settings.width, h: settings.height, fps: settings.frameRate }));

	// Colchón: el arranque y el cierre del grabador dejan un primer/último cuadro largo; así cae en fondo quieto.
	await sleep(300);
	await S.run(api);
	await sleep(400);

	await page.evaluate(() => window.stopRec());
	const chunks = [];
	for (let i = 0; ; i++) {
		const b64 = await page.evaluate((n) => window.readSlice(n), i);
		if (!b64) break;
		chunks.push(Buffer.from(b64, 'base64'));
	}
	const name = `${S.name || 'demo'}${MODE === 'web' ? '-web' : ''}.mp4`;
	const file = path.join(OUT, name);
	fs.writeFileSync(file, Buffer.concat(chunks));
	console.log('--- red ---');
	console.log(log.length ? log.join('\n') : '(nada bloqueado ni falsificado)');
	console.log('guardado', file, (fs.statSync(file).size / 1e6).toFixed(1) + ' MB');
	await browser.close();
})().catch(async (e) => {
	console.error(e);
	try { await global.__page?.screenshot({ path: path.join(OUT, 'fallo.png') }); console.error('captura del fallo: fallo.png'); } catch {}
	process.exit(1);
});
