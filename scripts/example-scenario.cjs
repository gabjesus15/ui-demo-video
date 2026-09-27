/**
 * Escenario de ejemplo: un cliente pide en el menú digital de una pizzería ficticia.
 * Copia este archivo a tu proyecto y cambia URLs, textos, reglas de red y el guion.
 *
 *   node <ruta-de-la-skill>/scripts/record-demo.cjs ./mi-escenario.cjs ./out master
 *
 * Todo lo que aparece aquí (rutas /demo-store, /api/orders, selectores, textos) es de EJEMPLO:
 * explora tu app y reemplázalo. Regla de oro: si la app escribe en una base REAL, cada escritura
 * del recorrido va en `network.fakes` (se responde aquí) o no ocurre (se bloquea). Nunca en `allowWrites`.
 */
module.exports = {
	name: 'como-pide-tu-cliente',

	// App y escena en orígenes distintos (localhost vs 127.0.0.1) = procesos distintos = sin tirones.
	appOrigin: 'http://localhost:3000',
	stageOrigin: 'http://127.0.0.1:3000',
	stageBlankPath: '/robots.txt', // cualquier URL liviana del mismo servidor (la escena se monta encima)
	embedPathPrefix: '/demo-store', // documentos a los que se les quita frame-ancestors/X-Frame-Options

	// main se ve al inicio; alt queda precargado debajo para pasar a él con un fundido (sin navegar).
	urls: { main: '/demo-store', alt: '/demo-store/menu' },

	// CSS inyectado en la app: ocultar indicadores de desarrollo, banners de cookies, chats flotantes…
	frameCss: 'nextjs-portal{display:none!important} #cookie-banner{display:none!important}',

	// browserChannel: 'chrome', // si no tienes Microsoft Edge

	brand: {
		accent: '#4f5bff',
		logo: '/logo-white.png', // servido por el mismo servidor de la escena (appOrigin/stageOrigin)
		logoToWhite: true, // pinta el logo de blanco para el cierre sobre el color de marca
		site: 'www.tu-sitio.com',
	},

	copy: {
		intro: ['¿Y cómo pide', 'tu cliente?'], // la 2.ª línea va en una caja blanca
		celebrate: '¡Y listo!',
		celebrateSub: 'Pedido recibido en el local',
		outro: 'Y el pedido llega directo a tu caja',
		outroKey: [4, 5, 6], // índices de palabras resaltadas
	},

	network: {
		// Respuestas inventadas: nunca llegan al servidor. Imita la forma del JSON que espera tu app.
		// `cors: true` cuando el host es otro (Supabase, una API externa): sin CORS el navegador la descarta.
		fakes: [
			{ match: /\/api\/orders$/, method: 'POST', label: 'crear pedido', body: { id: 9001, number: 214, status: 'received' } },
			// Ejemplo Supabase (RPC):
			// { match: /\/rest\/v1\/rpc\/create_order/, cors: true, label: 'crear pedido (RPC)', body: { id: 9001 } },
			// Llamadas que la app hace DESPUÉS de crear (datos de entrega, comprobantes…) también van aquí:
			// { match: /\/api\/orders\/\d+\/delivery/, method: 'POST', label: 'datos de entrega', body: { ok: true } },
		],
		// POST que SOLO leen (calcular precios, validar carrito). Revisa en el código que no escriben.
		allowWrites: [/\/api\/cart\/quote$/],
		// Salidas a terceros que no deben ocurrir nunca (mensajes, correos, pagos).
		block: [/wa\.me|whatsapp\.com/, /api\.stripe\.com/, /mercadopago/],
	},

	/**
	 * Ensayo sin grabar (contexto móvil propio, mismo blindaje de red): recorre TODO el flujo una vez,
	 * incluido el envío falso, para que el servidor compile y el navegador descargue todo.
	 * En modo desarrollo la primera carga de cada pantalla congela ~1 s: sin ensayo, sale en el video.
	 */
	async warmUp({ page, app, sleep }) {
		const click = (loc) => loc.evaluate((n) => n.click()).then(() => sleep(600));
		await page.goto(`${app}/demo-store`, { waitUntil: 'networkidle' });
		await page.goto(`${app}/demo-store/menu`, { waitUntil: 'networkidle' });
		await sleep(5000); // hidratación: un clic antes puede recargar la página en vez de abrir el panel
		// Reintenta sin volver a tocar mientras el panel anima.
		for (let i = 0; i < 20; i++) {
			await page.getByText('Pizza Margarita', { exact: true }).locator('visible=true').first().evaluate((n) => n.click());
			const opened = await page.getByRole('button', { name: /^Agregar/ }).waitFor({ state: 'visible', timeout: 4000 }).then(() => true, () => false);
			if (opened) break;
		}
		await click(page.getByRole('button', { name: /^Agregar/ }));
		await click(page.getByRole('button', { name: /^Carrito/ }));
		await click(page.getByRole('button', { name: 'Ir a pagar' }));
		await page.getByPlaceholder('Tu nombre').fill('Ensayo');
		await page.getByPlaceholder('Teléfono').fill('+56 9 0000 0000');
		await click(page.getByRole('button', { name: 'Confirmar pedido' }));
		await page.getByText('¡Pedido recibido!').waitFor({ timeout: 15000 });
	},

	/**
	 * Guion de la toma. `api`:
	 *   cam(x, y, escala, rotY?, rotX?)  y positivo baja el teléfono; escala 1.1–1.2 = acercamiento
	 *   caption(texto, [índices resaltados])   caption('') lo oculta
	 *   tap(locator|selector, { travel, hold, click })   typeInto(locator, texto)
	 *   smoothScroll(dy, ms)   swapToAlt()   frame()   frames.main / frames.alt
	 *   intro()  introOut()  celebrate()  outro()  fingerHide()  sleep(ms)
	 */
	async run(api) {
		const { sleep, cam, caption, tap, typeInto, smoothScroll } = api;
		const f = () => api.frame();

		// Intro de marca
		await sleep(350);
		await api.intro();
		await sleep(1900);
		await api.introOut();
		await cam(0, 60, 0.84, -8, 4); // entra con un leve giro 3D…
		await sleep(1250);
		await cam(0, 60, 0.84, 0, 0); // …y se endereza

		// Inicio → carta: se "toca" el enlace sin navegar y se pasa al iframe precargado
		await caption('Abre tu link', [2]);
		await sleep(800);
		await tap(api.frames.main.getByRole('link', { name: /Ver (el )?men[uú]/i }), { click: false });
		await sleep(220);
		await api.swapToAlt();
		await sleep(500);

		await caption('Mira la carta', [2]);
		await cam(0, 150, 1.12);
		await sleep(900);
		await smoothScroll(420, 1500);

		await caption('Elige tu pizza', [2]);
		await tap(f().getByText('Pizza Margarita', { exact: true }).first());
		await sleep(450);
		await cam(0, -110, 1.1); // el panel del producto sube desde abajo
		await sleep(900);
		await tap(f().getByRole('button', { name: /^Agregar/ }));
		await sleep(900);

		await caption('Revisa tu pedido', [2]);
		await cam(0, -230, 1.18);
		await sleep(700);
		await tap(f().getByRole('button', { name: /^Carrito/ }), { travel: 600 });
		await sleep(400);
		await cam(0, 26, 0.97); // teléfono completo: se ven los productos y el total
		await sleep(1500);
		await tap(f().getByRole('button', { name: 'Ir a pagar' }));
		await sleep(900);

		await caption('Confirma y listo', [2]);
		await cam(0, 40, 1.05);
		await sleep(500);
		await typeInto(f().getByPlaceholder('Tu nombre'), 'Camila Rojas'); // datos INVENTADOS
		await typeInto(f().getByPlaceholder('Teléfono'), '+56 9 5555 0199');
		await sleep(300);
		await tap(f().getByRole('button', { name: 'Confirmar pedido' }));
		await f().getByText('¡Pedido recibido!').waitFor({ timeout: 15000 }); // confirmación REAL, pedido FALSO
		await api.fingerHide();
		await caption('');
		await sleep(900);

		// Celebración y cierre
		await cam(0, 250, 0.66);
		await api.celebrate();
		await sleep(3000);
		await api.outro();
		await sleep(3600);
	},
};
