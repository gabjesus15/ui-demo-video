/**
 * Reloj virtual para el motor «render» (cuadro por cuadro). Se inyecta en TODOS los documentos
 * (escena e iframes de la app) con context.addInitScript, antes que cualquier script de la página.
 *
 * Hasta el primer __vtTick todo corre en tiempo real (carga, hidratación, pre-scroll). Desde ahí,
 * el tiempo solo avanza cuando el motor llama __vtTick(ms):
 *   - requestAnimationFrame, setTimeout/setInterval (≥ 5 ms), performance.now y Date.now son virtuales;
 *   - las animaciones y transiciones CSS / Web Animations se pausan y se posicionan en cada tick
 *     (getAnimations), y al llegar al final se terminan con finish() para que disparen sus eventos.
 * Así el video sale a 60 fps exactos aunque capturar cada cuadro tarde mucho más que 16 ms.
 *
 * Los temporizadores de menos de 5 ms (setTimeout 0, cadenas de trabajo) siguen en tiempo real:
 * son planificación, no animación, y virtualizarlos solo agregaría cuadros de espera.
 */
function virtualTime() {
	if (window.__vtTick) return;
	const R = {
		raf: window.requestAnimationFrame.bind(window),
		caf: window.cancelAnimationFrame.bind(window),
		st: window.setTimeout.bind(window),
		ct: window.clearTimeout.bind(window),
		si: window.setInterval.bind(window),
		pnow: performance.now.bind(performance),
		dnow: Date.now.bind(Date),
	};
	let on = false, first = false, vt = 0, vt0 = 0, pBase = 0, dBase = 0, ids = 1e9, seq = 0;
	const rafs = new Map();
	const timers = new Map();
	const anims = new Map();
	const report = (e) => (typeof reportError === 'function' ? reportError(e) : console.error(e));
	const vnow = () => pBase + vt - vt0;

	window.requestAnimationFrame = (cb) => { if (!on) return R.raf(cb); rafs.set(++ids, cb); return ids; };
	window.cancelAnimationFrame = (id) => { if (!rafs.delete(id)) R.caf(id); };
	const later = (every) => (fn, ms, ...args) => {
		ms = Math.max(0, Number(ms) || 0);
		if (!on || ms < 5 || typeof fn !== 'function') return (every ? R.si : R.st)(fn, ms, ...args);
		timers.set(++ids, { due: vt + ms, every: every ? ms : 0, fn, args, seq: ++seq });
		return ids;
	};
	window.setTimeout = later(false);
	window.setInterval = later(true);
	window.clearTimeout = window.clearInterval = (id) => { if (!timers.delete(id)) R.ct(id); };
	performance.now = () => (on ? vnow() : R.pnow());
	Date.now = () => (on ? dBase + vt - vt0 : R.dnow());

	const syncAnims = () => {
		const seen = new Set();
		for (const a of document.getAnimations()) {
			// Las animaciones ligadas al scroll (view()/scroll()) no dependen del tiempo.
			if (a.timeline !== document.timeline) continue;
			seen.add(a);
			let s = anims.get(a);
			if (!s) {
				// Pausadas o terminadas por la propia app: no se tocan.
				if (a.playState === 'paused' || a.playState === 'finished') { anims.set(a, { skip: true }); continue; }
				const rate = a.playbackRate || 1;
				// Las que ya corrían al activar el reloj siguen donde iban; las nuevas empiezan en 0.
				s = { born: first ? vt - (a.currentTime || 0) / rate : vt, set: null };
				anims.set(a, s);
			}
			if (s.skip) continue;
			const rate = a.playbackRate || 1;
			// Si la app la movió (seek, reverse), se respeta su posición.
			if (s.set !== null && a.currentTime !== null && Math.abs(a.currentTime - s.set) > 1) s.born = vt - a.currentTime / rate;
			if (a.playState !== 'paused') a.pause();
			const t = (vt - s.born) * rate;
			const end = a.effect ? a.effect.getComputedTiming().endTime : Infinity;
			if ((rate > 0 && t >= end) || (rate < 0 && t <= 0)) {
				anims.delete(a);
				try { a.finish(); } catch {}
				continue;
			}
			a.currentTime = t;
			s.set = t;
		}
		for (const a of anims.keys()) if (!seen.has(a)) anims.delete(a);
	};

	const step = (to) => {
		if (!on) { on = true; first = true; vt = vt0 = to; pBase = R.pnow(); dBase = R.dnow(); }
		vt = to;
		for (let n = 0; n < 5000; n++) {
			let best = null, bid = 0;
			for (const [id, t] of timers) if (t.due <= vt && (!best || t.due < best.due || (t.due === best.due && t.seq < best.seq))) { best = t; bid = id; }
			if (!best) break;
			if (best.every) { best.due += best.every; best.seq = ++seq; } else timers.delete(bid);
			try { best.fn(...best.args); } catch (e) { report(e); }
		}
		const cbs = [...rafs.values()];
		rafs.clear();
		const ts = vnow();
		for (const cb of cbs) { try { cb(ts); } catch (e) { report(e); } }
		syncAnims();
		first = false;
	};

	// La escena espera a pintar el estado nuevo (dos cuadros reales) antes de la foto. Los iframes de otro
	// origen NO esperan rAF: Chrome lo frena en iframes cruzados sin interacción y cada cuadro tardaba 2 s.
	// Basta con que terminen su trabajo; la escena, al pintar, ya compone lo último que entregaron.
	const painted = () => new Promise((r) => (window === top ? R.raf(() => R.raf(() => R.st(r, 0))) : R.st(r, 0)));
	window.__vtTick = (to, paint) => { step(to); return paint ? painted() : 0; };
}

module.exports = { virtualTime };
