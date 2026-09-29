#!/usr/bin/env node
/**
 * Genera la voz en off del escenario con ElevenLabs (una pista por frase) y la deja lista para el motor.
 *
 *   node voiceover.cjs <escenario.cjs> <carpeta-salida> [--voice=<voiceId>] [--model=eleven_v3] [--prefix='[Latin American Spanish accent]']
 *
 * --voice prueba otra voz sin tocar el escenario (p. ej. una voz incluida del plan gratuito: el plan
 * gratuito NO puede usar voces de la biblioteca por API).
 *
 * El escenario declara:
 *   voice: {
 *     voiceId: 'JddqVF50ZSIR7SRbJE6u',          // de tu cuenta o de la biblioteca de voces
 *     model: 'eleven_multilingual_v2',          // opcional
 *     settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35, speed: 1.05 },  // opcional
 *     lines: { hook: '¿Todavía tomas los pedidos…?', cta: 'Crea tu menú hoy.' },
 *   }
 * En el guion: `await api.say('hook')` la pone a sonar en ese instante del video.
 *
 * Salida: <salida>/voz/<id>.mp3 y <salida>/voz/voz.json (duración de cada frase). Una frase que no
 * cambió no se vuelve a generar (caché por texto + voz + ajustes): no gasta caracteres de más.
 *
 * Clave: variable ELEVENLABS_API_KEY o archivo ~/.elevenlabs_api_key (nunca en el repo).
 * Ojo con la licencia: el plan gratuito de ElevenLabs no permite uso comercial (publicidad).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const argv = process.argv.slice(2);
const flags = Object.fromEntries(argv.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const [scenarioPath, OUT] = argv.filter((a) => !a.startsWith('--'));
if (!scenarioPath || !OUT) {
	console.error('Uso: node voiceover.cjs <escenario.cjs> <carpeta-salida>');
	process.exit(1);
}
const S = require(path.resolve(scenarioPath));
const V = S.voice && { ...S.voice, voiceId: flags.voice || S.voice.voiceId, ...(flags.model ? { model: flags.model } : {}), ...(flags.prefix ? { prefix: flags.prefix + ' ' } : {}) };
if (!V?.voiceId || !V?.lines) {
	console.error('El escenario no tiene `voice: { voiceId, lines }`.');
	process.exit(1);
}
const keyFile = path.join(os.homedir(), '.elevenlabs_api_key');
const KEY = process.env.ELEVENLABS_API_KEY || (fs.existsSync(keyFile) ? fs.readFileSync(keyFile, 'utf8').trim() : '');
if (!KEY) {
	console.error('Falta la clave: define ELEVENLABS_API_KEY o crea ~/.elevenlabs_api_key');
	process.exit(1);
}

const dir = path.join(OUT, 'voz');
fs.mkdirSync(dir, { recursive: true });
const manifestFile = path.join(dir, 'voz.json');
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {};
const model = V.model || 'eleven_multilingual_v2';
const settings = { stability: 0.45, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true, ...(V.settings || {}) };

(async () => {
	let spent = 0;
	for (const [id, text] of Object.entries(V.lines)) {
		const hash = crypto.createHash('sha1').update(JSON.stringify([V.voiceId, model, settings, V.prefix || '', text])).digest('hex').slice(0, 12);
		const file = path.join(dir, `${id}.mp3`);
		if (manifest[id]?.hash === hash && fs.existsSync(file)) { console.log(`= ${id} (${manifest[id].duration.toFixed(2)} s, en caché)`); continue; }
		// Frases vecinas como contexto: la entonación sale más natural que generando cada una aislada.
		const ids = Object.keys(V.lines); const i = ids.indexOf(id);
		// Reintenta si la red falla (timeouts de conexión pasan).
		const post = async (url, opts) => { for (let k = 0; ; k++) { try { return await fetch(url, opts); } catch (e) { if (k >= 3) throw e; console.log(`  red: reintento ${k + 1}…`); await new Promise((r) => setTimeout(r, 1500 * (k + 1))); } } };
		const res = await post(`https://api.elevenlabs.io/v1/text-to-speech/${V.voiceId}/with-timestamps?output_format=mp3_44100_128`, {
			method: 'POST',
			headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
			body: JSON.stringify({
				// prefix: etiquetas del modelo v3 que no se leen, p. ej. '[Latin American Spanish accent] [cheerful] '.
				text: (V.prefix || '') + text, model_id: model, voice_settings: settings,
				...(V.language ? { language_code: V.language } : {}),
				// v3 no acepta texto de contexto; los otros modelos entonan mejor con él.
				...(/v3/.test(model) ? {} : {
					previous_text: i > 0 ? V.lines[ids[i - 1]] : undefined,
					next_text: i < ids.length - 1 ? V.lines[ids[i + 1]] : undefined,
				}),
			}),
		});
		const data = await res.json();
		if (!data.audio_base64) {
			const msg = JSON.stringify(data).slice(0, 300);
			console.error(`✗ ${id}:`, msg);
			if (/paid_plan_required/.test(msg)) console.error('El plan gratuito no puede usar voces de la biblioteca por API: sube de plan o prueba con --voice=<voz incluida>.');
			process.exitCode = 1;
			return;
		}
		fs.writeFileSync(file, Buffer.from(data.audio_base64, 'base64'));
		const ends = data.alignment?.character_end_times_seconds || [];
		const duration = ends.length ? ends[ends.length - 1] : 0;
		manifest[id] = { hash, text, duration, file: `${id}.mp3` };
		spent += text.length;
		console.log(`+ ${id} (${duration.toFixed(2)} s): ${text}`);
	}
	fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
	const total = Object.keys(V.lines).reduce((s, id) => s + manifest[id].duration, 0);
	console.log(`voz lista: ${Object.keys(V.lines).length} frases, ${total.toFixed(1)} s en total, ${spent} caracteres usados ahora`);
})().catch((e) => { console.error(e); process.exit(1); });
