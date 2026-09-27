#!/usr/bin/env node
/**
 * Control de calidad y derivados de un video demo. Sirve el archivo con un mini servidor propio
 * (con soporte de rangos) y lo abre en Edge/Chrome, que sí decodifican H.264.
 *
 *   node qa-tools.cjs gaps   <video.mp4>                 → tirones: huecos entre fotogramas > 100 ms
 *   node qa-tools.cjs frames <video.mp4> <carpeta> [n]   → n fotogramas JPG repartidos (revisar toques y encuadres)
 *   node qa-tools.cjs poster <video.mp4> <salida.jpg> <segundo>  → portada a resolución completa
 *   node qa-tools.cjs web    <master.mp4> <salida.mp4> [ancho=720] [bitrate=1600000]
 *                                                       → versión liviana re-codificada desde la master
 *
 * Ejecutar desde un proyecto con `playwright` instalado. Canal: msedge (usa CHANNEL=chrome si no hay Edge).
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
// Playwright del proyecto actual o, si no hay, el instalado junto a la skill (npm install en su carpeta).
const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(), path.join(__dirname, '..')] }));

const [cmd, input, ...rest] = process.argv.slice(2);
if (!cmd || !input) {
	console.error('Uso: node qa-tools.cjs <gaps|frames|poster|web> <video.mp4> [...]');
	process.exit(1);
}

/** Sirve el video en 127.0.0.1 con rangos (el reproductor los usa para buscar). */
function serve(file) {
	const size = fs.statSync(file).size;
	const server = http.createServer((req, res) => {
		if (req.url === '/') {
			res.writeHead(200, { 'content-type': 'text/html' });
			return res.end('<video id=v muted playsinline preload=auto src="/v.mp4"></video><canvas id=c></canvas>');
		}
		const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
		const start = range && range[1] ? Number(range[1]) : 0;
		const end = range && range[2] ? Number(range[2]) : size - 1;
		res.writeHead(range ? 206 : 200, {
			'content-type': 'video/mp4',
			'accept-ranges': 'bytes',
			'content-length': end - start + 1,
			...(range ? { 'content-range': `bytes ${start}-${end}/${size}` } : {}),
		});
		fs.createReadStream(file, { start, end }).pipe(res);
	});
	return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

(async () => {
	const server = await serve(path.resolve(input));
	const url = `http://127.0.0.1:${server.address().port}/`;
	const browser = await chromium.launch({ channel: process.env.CHANNEL || 'msedge', args: ['--autoplay-policy=no-user-gesture-required'] });
	const page = await browser.newPage();
	await page.goto(url);
	await page.evaluate(() => new Promise((r) => { const v = document.getElementById('v'); if (v.readyState >= 4) r(); else v.oncanplaythrough = r; setTimeout(r, 10000); }));
	const info = await page.evaluate(() => { const v = document.getElementById('v'); return { duration: v.duration, w: v.videoWidth, h: v.videoHeight }; });
	console.log(JSON.stringify(info), (fs.statSync(input).size / 1e6).toFixed(1) + ' MB');

	if (cmd === 'gaps') {
		// Reproduce a 1x y anota el tiempo de cada fotograma que trae el archivo.
		const r = await page.evaluate(() => new Promise((res) => {
			const v = document.getElementById('v'); const times = [];
			let last = -1, still = 0;
			const done = () => {
				clearInterval(guard);
				const gaps = []; for (let i = 1; i < times.length; i++) { const g = times[i] - times[i - 1]; if (g > 0.1) gaps.push([+times[i - 1].toFixed(2), +g.toFixed(3)]); }
				res({ frames: times.length, fpsReal: +(times.length / v.duration).toFixed(1), gaps });
			};
			// Algunos MP4 de MediaRecorder no disparan "ended": se corta si el tiempo deja de avanzar.
			const guard = setInterval(() => { if (v.currentTime === last) { if (++still > 6) done(); } else { still = 0; last = v.currentTime; } }, 500);
			const cb = (_n, meta) => { times.push(meta.mediaTime); if (!v.ended) v.requestVideoFrameCallback(cb); };
			v.onended = done; v.requestVideoFrameCallback(cb); v.play();
		}));
		console.log(JSON.stringify(r));
		console.log('Guía: huecos < 0,15 s casi no se notan; en intro/cierre (pantallas quietas) no importan. Preocupa > 0,25 s en plena acción.');
	}

	if (cmd === 'frames' || cmd === 'poster') {
		const grab = (t, w) => page.evaluate(async ({ t, w }) => {
			const v = document.getElementById('v'); const c = document.getElementById('c');
			v.currentTime = t; await new Promise((r) => (v.onseeked = r)); await new Promise((r) => setTimeout(r, 300)); // sin esta espera salen cuadros negros
			const k = w ? w / v.videoWidth : 1; c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
			c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.82);
		}, { t, w });
		const save = (dataUrl, file) => fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
		if (cmd === 'frames') {
			const [dir, nArg] = rest; const n = Number(nArg || 32);
			fs.mkdirSync(dir, { recursive: true });
			for (let i = 0; i < n; i++) {
				const t = (info.duration * (i + 0.5)) / n;
				save(await grab(t, 270), path.join(dir, `f${String(i).padStart(2, '0')}-${t.toFixed(1)}s.jpg`));
			}
			console.log(`${n} fotogramas en ${dir}`);
		} else {
			const [out, sec] = rest;
			save(await grab(Number(sec || 1), 0), out);
			console.log('portada', out);
		}
	}

	if (cmd === 'web') {
		// Re-codifica en tiempo real desde la master: conserva la toma limpia (no se regraba).
		const [out, wArg, brArg] = rest; const w = Number(wArg || 720); const br = Number(brArg || 1_600_000);
		const size = await page.evaluate(({ w, br }) => new Promise((res) => {
			const v = document.getElementById('v'), c = document.getElementById('c');
			c.width = w; c.height = Math.round((v.videoHeight / v.videoWidth) * w); const ctx = c.getContext('2d');
			const rec = new MediaRecorder(c.captureStream(30), { mimeType: 'video/mp4;codecs=avc1.640028', videoBitsPerSecond: br });
			const parts = []; rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
			rec.onstop = () => { window.__blob = new Blob(parts, { type: 'video/mp4' }); res(window.__blob.size); };
			const draw = () => { ctx.drawImage(v, 0, 0, c.width, c.height); if (!v.ended) v.requestVideoFrameCallback(draw); };
			v.onended = () => setTimeout(() => rec.stop(), 150);
			ctx.drawImage(v, 0, 0, c.width, c.height); rec.start(); v.requestVideoFrameCallback(draw); v.play();
		}), { w, br });
		const chunks = [];
		for (let i = 0; ; i++) {
			const b64 = await page.evaluate((n) => new Promise((r) => { const s = 4 << 20; const part = window.__blob.slice(n * s, (n + 1) * s); if (!part.size) return r(null); const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(part); }), i);
			if (!b64) break; chunks.push(Buffer.from(b64, 'base64'));
		}
		fs.writeFileSync(out, Buffer.concat(chunks));
		console.log('web', out, (size / 1e6).toFixed(1) + ' MB');
	}

	await browser.close();
	server.close();
})().catch((e) => { console.error(e); process.exit(1); });
