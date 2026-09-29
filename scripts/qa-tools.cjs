#!/usr/bin/env node
/**
 * Control de calidad y derivados de un video demo. Sirve el archivo con un mini servidor propio
 * (con soporte de rangos) y lo abre en Edge/Chrome, que sí decodifican H.264.
 *
 *   node qa-tools.cjs gaps   <video.mp4>                 → tirones: huecos entre fotogramas > 100 ms
 *   node qa-tools.cjs frames <video.mp4> <carpeta> [n]   → n fotogramas JPG repartidos (revisar toques y encuadres)
 *   node qa-tools.cjs poster <video.mp4> <salida.jpg> <segundo>  → portada a resolución completa
 *   node qa-tools.cjs web    <master.mp4> <salida.mp4> [ancho=720] [bitrate=2400000]
 *                                                       → versión liviana re-codificada desde la master, cuadro por cuadro (conserva los fps)
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
		// Re-codifica desde la master (conserva la toma limpia, no se regraba), cuadro por cuadro con WebCodecs:
		// se reproduce a media velocidad y cada fotograma nuevo se codifica con su tiempo original. Así se
		// mantienen los 60 fps de la master sin botar cuadros (antes: MediaRecorder a 30 en tiempo real).
		const [out, wArg, brArg] = rest; const w = Number(wArg || 720); const br = Number(brArg || 2_400_000);
		await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.1/build/mp4-muxer.min.js' });
		const r = await page.evaluate(async ({ w, br }) => {
			const v = document.getElementById('v'), c = document.getElementById('c');
			c.width = w; c.height = Math.round(((v.videoHeight / v.videoWidth) * w) / 2) * 2; const ctx = c.getContext('2d');
			let config = null;
			for (const codec of ['avc1.640033', 'avc1.64002a', 'avc1.640028', 'avc1.4d0033', 'avc1.42e033']) {
				const cfg = { codec, width: c.width, height: c.height, bitrate: br, framerate: 60, avc: { format: 'avc' }, latencyMode: 'quality' };
				const s = await VideoEncoder.isConfigSupported(cfg).catch(() => null); if (s && s.supported) { config = cfg; break; }
			}
			if (!config) throw new Error('Este navegador no codifica H.264 con WebCodecs');
			const muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: 'avc', width: c.width, height: c.height }, fastStart: 'in-memory', firstTimestampBehavior: 'offset' });
			let err = null; const enc = new VideoEncoder({ output: (ch, m) => muxer.addVideoChunk(ch, m), error: (e) => { err = String(e); } });
			enc.configure(config);
			let n = 0, last = -1, prev = null;
			// Cada cuadro se entrega con la duración hasta el siguiente: se codifica con un cuadro de retraso.
			const push = (t) => { if (prev) { const f = new VideoFrame(prev.bmp, { timestamp: prev.ts, duration: Math.max(1, t - prev.ts) }); enc.encode(f, { keyFrame: n % 120 === 0 }); f.close(); prev.bmp.close(); n++; } };
			await new Promise((res) => {
				const draw = async (_now, meta) => {
					if (meta.mediaTime > last) {
						last = meta.mediaTime; ctx.drawImage(v, 0, 0, c.width, c.height);
						const ts = Math.round(meta.mediaTime * 1e6); push(ts); prev = { ts, bmp: await createImageBitmap(c) };
					}
					if (!v.ended) v.requestVideoFrameCallback(draw);
				};
				let still = 0, lt = -1;
				const guard = setInterval(() => { if (v.currentTime === lt) { if (++still > 6) { clearInterval(guard); res(); } } else { still = 0; lt = v.currentTime; } }, 500);
				v.onended = () => { clearInterval(guard); setTimeout(res, 200); };
				v.playbackRate = 0.5; v.requestVideoFrameCallback(draw); v.play();
			});
			push(Math.round(v.duration * 1e6));
			await enc.flush(); if (err) throw new Error(err);
			muxer.finalize(); window.__blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
			return { size: window.__blob.size, frames: n };
		}, { w, br });
		const size = r.size;
		console.log(`${r.frames} cuadros re-codificados`);
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
