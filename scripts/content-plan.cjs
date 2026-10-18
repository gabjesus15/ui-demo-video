#!/usr/bin/env node
/**
 * Plan de contenido semanal como infografía (PNG por página + un PDF con todas), con la marca
 * de la app. El contenido vive en un archivo .cjs que exporta `{ brand, plan }`; mira
 * `templates/plan-contenido.cjs` (campos comentados) y `examples/godcode/semana-1.cjs` (uno real).
 *
 *   node scripts/content-plan.cjs <plan.cjs> <carpeta-salida> [--name=plan] [--width=1600]
 *        [--scale=2] [--channel=msedge|chrome] [--no-pdf] [--only=1|2]
 *
 * Sale:  <carpeta-salida>/<name>-1.png, <name>-2.png (si hay página 2) y <name>.pdf
 *
 * Se corre desde una carpeta con `playwright` instalado (p. ej. la raíz de tu proyecto) o desde
 * esta skill. Necesita Microsoft Edge o Google Chrome e internet para las fuentes de Google.
 * Las rutas de imágenes del plan son relativas al archivo del plan y se incrustan en base64.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(), path.join(__dirname, '..')] }));

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith('--'));
const args = Object.fromEntries(argv.filter((a) => a.startsWith('--')).map((a) => { const i = a.indexOf('='); return i < 0 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)]; }));
if (positional.length < 2) {
	console.error('Uso: node scripts/content-plan.cjs <plan.cjs> <carpeta-salida> [--name=plan] [--width=1600] [--scale=2] [--channel=msedge] [--no-pdf] [--only=1|2]');
	process.exit(1);
}
const planFile = path.resolve(positional[0]);
const outDir = path.resolve(positional[1]);
const baseDir = path.dirname(planFile);
const { brand, plan } = require(planFile);
const NAME = args.name || plan.file || 'plan';
const W = Number(args.width) || 1600;
const SCALE = Number(args.scale) || 2;

// ── Utilidades ────────────────────────────────────────────────────────────────────────────────

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
/** `**negrita**` → <b> (palabra en el color de la marca); `` `código` `` → <code>. */
const rich = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' };
const imgCache = new Map();
function img(src) {
	if (!src) return '';
	if (/^(data:|https?:)/.test(src)) return src;
	const file = path.resolve(baseDir, src);
	if (!imgCache.has(file)) {
		if (!fs.existsSync(file)) { console.warn(`  (imagen no encontrada: ${src})`); imgCache.set(file, ''); }
		else imgCache.set(file, `data:${MIME[path.extname(file).toLowerCase()] || 'image/png'};base64,${fs.readFileSync(file).toString('base64')}`);
	}
	return imgCache.get(file);
}
const pic = (src, cls = '') => { const s = img(src); return s ? `<img class="${cls}" src="${s}">` : `<div class="${cls} ph"></div>`; };

/** Íconos (trazos de lucide.dev, MIT). Se usan por nombre en el plan; uno desconocido sale como punto. */
const ICONS = {
	target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
	heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
	eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
	message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
	cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
	camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
	video: '<path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/>',
	clapper: '<path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/><path d="m6.2 5.3 3.1 3.9"/><path d="m12.4 3.4 3.1 3.9"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
	star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
	calendar: '<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>',
	bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
	check: '<polyline points="20 6 9 17 4 12"/>',
	shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
	phone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
	users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
	megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
	smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>',
	image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
	store: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/>',
	book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
	sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
	type: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/>',
	palette: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
	zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
	trend: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 18"/><polyline points="16 7 22 7 22 13"/>',
	monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
	coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
	percent: '<line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
	qr: '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>',
	dot: '<circle cx="12" cy="12" r="4"/>',
};
const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.dot}</svg>`;

// ── Marca → CSS ───────────────────────────────────────────────────────────────────────────────

const C = Object.assign({
	bg: '#0d0d0d', bg2: '#101430', card: '#141418', card2: '#1b1b21', border: '#2e2e32',
	text: '#f4f4f5', muted: '#a1a1aa', accent: '#4f5bff', accent2: '#8b93ff', onAccent: '#ffffff', warm: '#ffb86b',
}, brand.colors || {});
const F = Object.assign({
	url: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Geist:wght@400;500;600;700&family=Caveat:wght@600&display=block',
	display: "'Bebas Neue', Impact, sans-serif", text: 'Geist, system-ui, sans-serif', hand: 'Caveat, cursive',
}, brand.fonts || {});
const LEGEND = plan.legend || {};
const typeColor = (t) => (LEGEND[t] && LEGEND[t].color) || C.accent;
const typeLabel = (t) => (LEGEND[t] && LEGEND[t].label) || t;

const CSS = `
*{margin:0;box-sizing:border-box}
html,body{width:${W}px;background:${C.bg}}
body{font-family:${F.text};color:${C.text};-webkit-font-smoothing:antialiased}
.page{position:relative;width:${W}px;padding:56px 60px 48px;background:radial-gradient(1200px 700px at 85% -10%,${C.bg2} 0%,${C.bg} 60%)}
.page.light{background:${C.bg}}
h1,h2,h3,.disp{font-family:${F.display};font-weight:400;letter-spacing:.01em;text-transform:uppercase}
b{color:${C.accent2};font-weight:700}
code{font-family:ui-monospace,Consolas,monospace;font-size:.92em;background:${C.card2};border:1px solid ${C.border};border-radius:6px;padding:1px 6px;color:${C.text}}
.hand{font-family:${F.hand};color:${C.warm};font-size:40px;line-height:1;transform:rotate(-6deg);display:inline-block}
.ic{width:1em;height:1em;flex:none}
.ph{background:${C.card2}}
img{display:block}

/* cabecera */
.head{display:grid;grid-template-columns:auto 1fr auto;gap:44px;align-items:center;margin-bottom:34px}
.brand{display:flex;align-items:center;gap:22px}
.brand img{height:96px;width:auto}
.brand .t h1{font-size:92px;line-height:.9}
.brand .t h1 span{color:${C.accent2}}
.brand .t p{color:${C.muted};font-size:20px;margin-top:8px;max-width:420px}
.obj{display:flex;flex-direction:column;gap:18px;border-left:2px solid ${C.border};padding-left:40px}
.obj .lab{display:inline-flex;align-items:center;gap:10px;background:${C.accent};color:${C.onAccent};font-weight:700;font-size:16px;letter-spacing:.14em;padding:8px 16px;border-radius:999px;width:max-content}
.obj p{font-size:20px;color:${C.text};max-width:560px;line-height:1.35}
.metrics{display:flex;gap:0}
.metrics div{display:flex;flex-direction:column;align-items:center;gap:8px;padding:0 26px;border-left:1px solid ${C.border};font-size:15px;color:${C.muted};text-align:center;line-height:1.2}
.metrics div:first-child{border-left:0;padding-left:0}
.metrics .ic{font-size:30px;color:${C.accent2}}
.hero{position:relative;width:300px;min-height:200px;display:flex;flex-direction:column;align-items:center;gap:12px}
.hero img{width:300px;height:200px;object-fit:cover;border-radius:24px}

/* columnas */
.cols{display:grid;grid-template-columns:1fr 1fr 1.08fr;gap:26px;align-items:stretch}
.card{background:${C.card};border:1px solid ${C.border};border-radius:26px;padding:28px}
.card.acc{border-color:${C.accent}66}
.ch{display:flex;align-items:center;gap:16px;margin-bottom:18px}
.ch .ico{width:58px;height:58px;border-radius:50%;background:${C.accent};color:${C.onAccent};display:flex;align-items:center;justify-content:center;font-size:30px;flex:none}
.ch h2{font-size:34px;line-height:.95}
.ch small{display:block;font-family:${F.text};text-transform:none;letter-spacing:0;color:${C.muted};font-size:16px;margin-top:4px}
.lab2{display:inline-block;background:${C.accent}22;color:${C.accent2};border:1px solid ${C.accent}55;font-weight:600;font-size:15px;padding:6px 14px;border-radius:999px;margin:14px 0 10px}
.lab2.warm{background:${C.warm}22;color:${C.warm};border-color:${C.warm}66}
ul{list-style:none}
li{display:flex;gap:10px;align-items:flex-start;font-size:16.5px;line-height:1.3;color:${C.text};padding:5px 0}
li .ic{font-size:18px;color:${C.accent2};margin-top:2px}
li.tip .ic{color:${C.warm}}
.strip{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:18px}
.strip figure img,.strip figure .ph{width:100%;height:150px;object-fit:cover;border-radius:16px}
.strip figcaption{font-size:13px;color:${C.muted};margin-top:8px;line-height:1.25}
.strip.tall figure img,.strip.tall figure .ph{height:220px}
.note{margin-top:18px;display:flex;gap:12px;align-items:flex-start;background:${C.accent};color:${C.onAccent};border-radius:18px;padding:14px 18px;font-size:15px;line-height:1.3}
.note .ic{font-size:22px;margin-top:1px}
.remember{margin-top:18px;background:${C.text};color:${C.bg};border-radius:18px;padding:18px 20px}
.remember h3{font-size:24px;margin-bottom:6px;display:flex;align-items:center;gap:10px}
.remember p{font-size:15px;line-height:1.35}
.handnote{display:flex;justify-content:flex-end;margin-top:14px}
.handnote .hand{font-size:30px;transform:rotate(-4deg)}
.ex{margin-top:16px}
.ex .lab2{margin-top:0}
.ex .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.ex figure img,.ex figure .ph{width:100%;height:120px;object-fit:cover;object-position:center top;border-radius:14px}
.ex figcaption{font-size:12.5px;color:${C.muted};margin-top:6px;line-height:1.25}
.ex figure b{display:block;color:${C.text};font-weight:600;font-size:13px}

/* calendario */
.cal{display:grid;grid-template-columns:300px 1fr;gap:26px;margin-top:26px}
.cal .ch h2{font-size:30px}
.legend{margin-top:12px;display:flex;flex-direction:column;gap:10px}
.legend span{display:flex;align-items:center;gap:12px;font-size:15.5px;color:${C.muted}}
.legend i{width:18px;height:18px;border-radius:50%;flex:none}
.cal p.d{color:${C.muted};font-size:15px;line-height:1.35;margin-top:4px}
.week{display:grid;grid-template-columns:repeat(7,1fr);gap:12px}
.day{background:${C.card};border:1px solid ${C.border};border-radius:20px;padding:14px 14px 14px;display:flex;flex-direction:column;gap:8px;border-top:4px solid var(--tc)}
.day .dn{font-weight:700;font-size:15px;color:${C.text};display:flex;align-items:center;gap:8px}
.day .dn i{width:10px;height:10px;border-radius:50%;background:var(--tc)}
.day .ty{font-size:12.5px;font-weight:600;color:var(--tc);letter-spacing:.06em;text-transform:uppercase}
.day .tt{font-size:15px;font-weight:600;line-height:1.25}
.day .ds{font-size:13px;color:${C.muted};line-height:1.3}
.day img,.day .ph{width:100%;height:96px;object-fit:cover;object-position:center top;border-radius:12px;margin-top:auto}
.wk{margin-bottom:12px}
.wk h3{font-size:26px;color:${C.accent2};margin-bottom:10px}

/* pie */
.foot{display:flex;justify-content:space-between;align-items:center;margin-top:34px;padding-top:22px;border-top:1px solid ${C.border};color:${C.muted};font-size:16px}
.foot .hand{font-size:34px;line-height:.95;max-width:520px;transform:rotate(-3deg);color:${C.warm}}
.foot .tags{display:flex;gap:18px;flex-wrap:wrap}
.foot .tags span{color:${C.accent2};font-weight:600}

/* página 2 */
.p2head{display:grid;grid-template-columns:1.1fr 1fr;gap:26px;margin-bottom:26px}
.bcard{background:${C.card};border:1px solid ${C.border};border-radius:26px;padding:34px;display:flex;flex-direction:column;gap:18px}
.bcard .brand img{height:84px}
.bcard h1{font-size:84px;line-height:.9}
.bcard h1 span{color:${C.accent2}}
.bcard p.tag{color:${C.muted};font-size:19px;max-width:520px}
.sec h2{font-size:34px;margin-bottom:14px;display:flex;align-items:center;gap:12px}
.sec h2 .ic{color:${C.accent2};font-size:30px}
.pal{display:flex;gap:16px;flex-wrap:wrap}
.pal div{display:flex;flex-direction:column;align-items:center;gap:8px;font-size:13px;color:${C.muted};text-align:center;width:104px}
.pal i{width:84px;height:84px;border-radius:50%;border:3px solid ${C.border}}
.pal b{display:block;color:${C.text};font-weight:600;font-size:14px}
.typo{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px}
.typo div{background:${C.card2};border-radius:18px;padding:16px 18px}
.typo .big{font-size:44px;line-height:1}
.typo .lbl{color:${C.muted};font-size:13.5px;margin-top:8px}
.elems{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
.elems span{background:${C.card2};border:1px solid ${C.border};border-radius:999px;padding:7px 14px;font-size:14px;color:${C.muted}}
.pillars{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.pill{background:${C.card};border:1px solid ${C.border};border-radius:22px;padding:22px 18px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px}
.pill .ico{width:64px;height:64px;border-radius:50%;background:${C.accent};color:${C.onAccent};display:flex;align-items:center;justify-content:center;font-size:32px}
.pill h3{font-size:24px;line-height:.95}
.pill p{font-size:14px;color:${C.muted};line-height:1.3}
.reels{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.reel{display:flex;flex-direction:column;gap:10px}
.reel .fr{position:relative;border-radius:22px;overflow:hidden;background:${C.card2};aspect-ratio:9/16}
.reel .fr img{width:100%;height:100%;object-fit:cover;object-position:center top}
.reel .fr::before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.72) 0%,rgba(0,0,0,.25) 34%,rgba(0,0,0,0) 55%,rgba(0,0,0,.35) 100%);z-index:1}
.reel .fr .ov,.reel .fr .du{z-index:2}
.reel .fr .ov{position:absolute;left:14px;right:14px;top:16px;font-family:${F.display};font-size:36px;line-height:.95;color:#fff;text-shadow:0 3px 14px rgba(0,0,0,.6);text-transform:uppercase}
.reel .fr .du{position:absolute;left:14px;bottom:14px;background:rgba(0,0,0,.65);color:#fff;font-size:13px;font-weight:600;padding:6px 10px;border-radius:999px;display:flex;align-items:center;gap:6px}
.reel p{font-size:14px;color:${C.muted};line-height:1.3}
.reel p b{display:block;color:${C.text};font-weight:600;font-size:15px;margin-bottom:3px}
.days2{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.d2{background:${C.card};border:1px solid ${C.border};border-radius:22px;overflow:hidden;display:flex;flex-direction:column;border-top:4px solid var(--tc)}
.d2 .hd{padding:14px 16px 0;display:flex;justify-content:space-between;align-items:baseline}
.d2 .hd b{color:${C.text};font-size:15px;font-weight:700}
.d2 .hd span{color:var(--tc);font-size:12.5px;font-weight:600;text-transform:uppercase;letter-spacing:.06em}
.d2 img,.d2 .ph{width:100%;height:150px;object-fit:cover;object-position:center top;margin-top:12px}
.d2 .bd{padding:14px 16px 16px;display:flex;flex-direction:column;gap:8px}
.d2 .tt{font-size:16px;font-weight:600;line-height:1.25}
.d2 .ds{font-size:13.5px;color:${C.muted};line-height:1.3}
.d2 .tp{font-size:13px;color:${C.warm};line-height:1.3;display:flex;gap:6px;align-items:flex-start}
.d2 .tp .ic{font-size:15px;margin-top:2px}
.tips{display:grid;grid-template-columns:340px 1fr;gap:20px;background:${C.card};border:1px solid ${C.border};border-radius:26px;padding:24px;margin-top:26px;align-items:center}
.tips ul li{font-size:15px}
.tips .row{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
.tips .row img,.tips .row .ph{width:100%;height:150px;object-fit:cover;object-position:center top;border-radius:16px}
.tips .row .hand{font-size:34px;align-self:center;justify-self:center}
.sec+.sec{margin-top:26px}
`;

// ── Página 1 ──────────────────────────────────────────────────────────────────────────────────

function metricsHtml(ms = []) {
	return `<div class="metrics">${ms.map((m) => `<div>${icon(m.icon || 'trend')}<span>${esc(m.label)}</span></div>`).join('')}</div>`;
}
function blocksHtml(blocks = []) {
	return blocks.map((b) => {
		const cls = b.style === 'tip' ? 'tip' : '';
		return `${b.label ? `<div class="lab2 ${b.style === 'tip' ? 'warm' : ''}">${esc(b.label)}</div>` : ''}<ul>${(b.items || []).map((it) => `<li class="${cls}">${icon(b.style === 'tip' ? 'bulb' : 'check')}<span>${rich(it)}</span></li>`).join('')}</ul>`;
	}).join('');
}
function stripHtml(images = [], tall = false) {
	if (!images.length) return '';
	return `<div class="strip ${tall ? 'tall' : ''}">${images.map((f) => `<figure>${pic(f.src)}<figcaption>${rich(f.caption)}</figcaption></figure>`).join('')}</div>`;
}
function columnHtml(col) {
	return `<section class="card">
<div class="ch"><div class="ico">${icon(col.icon || 'star')}</div><h2>${esc(col.title)}${col.subtitle ? `<small>${esc(col.subtitle)}</small>` : ''}</h2></div>
${blocksHtml(col.blocks)}
${stripHtml(col.images, col.tallImages)}
${col.note ? `<div class="note">${icon('phone')}<span>${rich(col.note)}</span></div>` : ''}
${col.hand ? `<div class="handnote"><span class="hand">${esc(col.hand)}</span></div>` : ''}
</section>`;
}
function decideHtml(d) {
	if (!d) return '';
	return `<section class="card acc">
<div class="ch"><div class="ico">${icon(d.icon || 'star')}</div><h2>${esc(d.title)}${d.subtitle ? `<small>${esc(d.subtitle)}</small>` : ''}</h2></div>
${d.intro ? `<p style="color:${C.muted};font-size:15.5px;line-height:1.35;margin-bottom:6px">${rich(d.intro)}</p>` : ''}
${blocksHtml(d.blocks)}
${d.examples && d.examples.length ? `<div class="ex"><div class="lab2">${esc(d.examplesLabel || 'Ejemplos')}</div><div class="grid">${d.examples.map((e) => `<figure>${pic(e.src)}<figcaption><b>${esc(e.title)}</b>${esc(e.caption || '')}</figcaption></figure>`).join('')}</div></div>` : ''}
${d.remember ? `<div class="remember"><h3>${icon('shield')}${esc(d.remember.title || 'Recuerda')}</h3><p>${rich(d.remember.text)}</p></div>` : ''}
${d.hand ? `<div class="handnote"><span class="hand">${esc(d.hand)}</span></div>` : ''}
</section>`;
}
function weekHtml(weeks) {
	return weeks.map((wk) => `<div class="wk">${wk.title ? `<h3 class="disp">${esc(wk.title)}</h3>` : ''}<div class="week">${wk.days.map((d) => `<div class="day" style="--tc:${typeColor(d.type)}">
<div class="dn"><i></i>${esc(d.day)}</div><div class="ty">${esc(typeLabel(d.type))}</div><div class="tt">${rich(d.title)}</div>${d.desc ? `<div class="ds">${rich(d.desc)}</div>` : ''}${pic(d.image)}</div>`).join('')}</div></div>`).join('');
}
function footHtml() {
	const h = brand.handles || {};
	const parts = [h.web, h.instagram, h.whatsapp, h.linkedin].filter(Boolean).map(esc).join(' · ');
	return `<footer class="foot"><span class="hand">${esc(plan.footHand || brand.slogan || '')}</span><span>${parts}</span><span class="tags">${(plan.hashtags || brand.hashtags || []).map((t) => `<span>${esc(t)}</span>`).join('')}</span></footer>`;
}
function page1() {
	const p = plan.page1 || plan;
	const weeks = Array.isArray(p.weeks) ? p.weeks : [{ title: p.weekTitle, days: p.week || [] }];
	return `<div class="page" id="p1">
<header class="head">
<div class="brand">${pic(brand.logo)}<div class="t"><h1>${rich(p.title || 'Plan de **Contenido**')}</h1><p>${esc(brand.tagline || '')}</p></div></div>
<div class="obj"><span class="lab">${icon('target')}${esc(p.objectiveLabel || 'OBJETIVO')}</span><p>${rich(p.objective || '')}</p>${metricsHtml(p.metrics)}</div>
<div class="hero">${p.hand ? `<span class="hand">${esc(p.hand)}</span>` : ''}${p.heroImage ? pic(p.heroImage) : ''}</div>
</header>
<div class="cols">${(p.columns || []).map(columnHtml).join('')}${decideHtml(p.decide)}</div>
<section class="cal">
<div class="card"><div class="ch"><div class="ico">${icon('calendar')}</div><h2>${esc(p.calendarTitle || 'Calendario de contenido')}${p.calendarSubtitle ? `<small>${esc(p.calendarSubtitle)}</small>` : ''}</h2></div>
<p class="d">${rich(p.calendarText || '')}</p>
<div class="legend">${Object.entries(LEGEND).map(([k, v]) => `<span><i style="background:${v.color}"></i>${esc(v.label || k)}</span>`).join('')}</div></div>
<div>${weekHtml(weeks)}</div>
</section>
${footHtml()}
</div>`;
}

// ── Página 2 ──────────────────────────────────────────────────────────────────────────────────

function page2() {
	const p = plan.page2;
	if (!p) return '';
	const pal = p.palette || [];
	const ty = p.typography || {};
	const days = p.days || (plan.page1 || plan).week || [];
	return `<div class="page" id="p2">
<div class="p2head">
<div class="bcard"><div class="brand">${pic(brand.logo)}</div><h1>${rich(p.headline || brand.name)}</h1><p class="tag">${esc(p.tagline || brand.tagline || '')}</p>
${pal.length ? `<div class="sec"><h2>${icon('palette')}${esc(p.paletteTitle || 'Línea gráfica')}</h2>${p.paletteText ? `<p style="color:${C.muted};font-size:15.5px;line-height:1.35;margin-bottom:14px">${rich(p.paletteText)}</p>` : ''}<div class="pal">${pal.map((c) => `<div><i style="background:${c.hex}"></i><b>${esc(c.name)}</b>${esc(c.hex)}<br>${esc(c.role || '')}</div>`).join('')}</div>
<div class="typo"><div><div class="big" style="font-family:${F.display}">Aa ${esc(ty.display || '')}</div><div class="lbl">${esc(ty.displayRole || 'Títulos y destacados')}</div></div><div><div class="big" style="font-family:${F.text};font-weight:600;font-size:36px">Aa ${esc(ty.text || '')}</div><div class="lbl">${esc(ty.textRole || 'Textos y descripciones')}</div></div></div>
${p.elements && p.elements.length ? `<div class="elems">${p.elements.map((e) => `<span>${esc(e)}</span>`).join('')}</div>` : ''}</div>` : ''}
</div>
<div>
${p.pillars && p.pillars.length ? `<div class="sec"><h2>${icon('sparkles')}${esc(p.pillarsTitle || 'Pilares de contenido')}</h2><div class="pillars">${p.pillars.map((x) => `<div class="pill"><div class="ico">${icon(x.icon || 'star')}</div><h3>${esc(x.title)}</h3><p>${rich(x.text)}</p></div>`).join('')}</div></div>` : ''}
${p.reels && p.reels.length ? `<div class="sec"><h2>${icon('clapper')}${esc(p.reelsTitle || 'Ejemplos de Reels / Historias')}</h2><div class="reels">${p.reels.map((r) => `<div class="reel"><div class="fr">${pic(r.image)}<div class="ov">${esc(r.overlay || '')}</div>${r.duration ? `<div class="du">${icon('video')}${esc(r.duration)}</div>` : ''}</div><p><b>${esc(r.title)}</b>${rich(r.text)}</p></div>`).join('')}</div></div>` : ''}
</div>
</div>
<div class="sec"><h2>${icon('calendar')}${esc(p.daysTitle || 'Plan detallado, día a día')}</h2>
<div class="days2">${days.map((d, i) => `<div class="d2" style="--tc:${typeColor(d.type)}"><div class="hd"><b>${esc(d.long || `Día ${i + 1} · ${d.day}`)}</b><span>${esc(typeLabel(d.type))}</span></div>${pic(d.image)}<div class="bd"><div class="tt">${rich(d.title)}</div>${d.desc ? `<div class="ds">${rich(d.desc)}</div>` : ''}${d.tip ? `<div class="tp">${icon('bulb')}<span>${rich(d.tip)}</span></div>` : ''}</div></div>`).join('')}</div></div>
${p.tips ? `<div class="tips"><div><div class="ch"><div class="ico">${icon('camera')}</div><h2 style="font-size:28px">${esc(p.tips.title || 'Sugerencias de captura')}</h2></div><ul>${(p.tips.items || []).map((t) => `<li class="tip">${icon('bulb')}<span>${rich(t)}</span></li>`).join('')}</ul></div><div class="row">${(p.tips.images || []).map((s) => pic(s)).join('')}${p.tips.hand ? `<span class="hand">${esc(p.tips.hand)}</span>` : ''}</div></div>` : ''}
${footHtml()}
</div>`;
}

// ── Render ────────────────────────────────────────────────────────────────────────────────────

const doc = (body, extra = '') => `<!doctype html><html lang="es"><head><meta charset="utf-8"><link href="${F.url}" rel="stylesheet"><style>${CSS}${extra}</style></head><body>${body}</body></html>`;

(async () => {
	fs.mkdirSync(outDir, { recursive: true });
	const pages = [['1', page1()], ['2', page2()]].filter(([n, html]) => html && (!args.only || String(args.only) === n));
	const browser = await chromium.launch({ channel: args.channel || 'msedge', headless: true });
	const page = await browser.newPage({ viewport: { width: W, height: 1000 }, deviceScaleFactor: SCALE });
	const heights = [];
	for (const [n, html] of pages) {
		await page.setContent(doc(html), { waitUntil: 'networkidle' });
		await page.evaluate(() => document.fonts.ready);
		await page.waitForTimeout(400);
		const h = await page.evaluate(() => document.body.scrollHeight);
		heights.push(h);
		const file = path.join(outDir, `${NAME}-${n}.png`);
		await page.screenshot({ path: file, fullPage: true });
		console.log(`${file}  (${W}×${h} @${SCALE}x)`);
	}
	if (!args['no-pdf'] && pages.length) {
		// Un PDF con todas las páginas: cada una ocupa una hoja del alto de la más alta (lo que sobra queda del color del fondo).
		const H = Math.max(...heights);
		const body = pages.map(([, html]) => html).join('');
		await page.setContent(doc(body, `@page{size:${W}px ${H}px;margin:0}.page{min-height:${H}px;page-break-after:always;break-after:page}.page:last-child{page-break-after:auto;break-after:auto}`), { waitUntil: 'networkidle' });
		await page.evaluate(() => document.fonts.ready);
		await page.waitForTimeout(400);
		const file = path.join(outDir, `${NAME}.pdf`);
		await page.pdf({ path: file, width: `${W}px`, height: `${H}px`, printBackground: true, preferCSSPageSize: true });
		console.log(`${file}  (${pages.length} página${pages.length > 1 ? 's' : ''})`);
	}
	await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
