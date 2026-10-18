/**
 * Plan de contenido de Gcode POS (GodCode), semana 1. Público: dueños de locales de comida en Chile y
 * Venezuela. Canales: Instagram @gcode.labs (Reels, carruseles, historias), TikTok, LinkedIn y WhatsApp.
 *
 *   node scripts/content-plan.cjs examples/godcode/semana-1.cjs out/plan-godcode
 *
 * Regla: solo se promete lo que el producto hace hoy. Todo lo que se muestra es la app real con datos
 * de prueba (Rica Pizza); los locales reales se muestran solo con su permiso.
 */
const A = './assets';

module.exports = {
	brand: {
		name: 'Gcode POS',
		tagline: 'Menú digital, pedidos online y caja para restaurantes. Sin comisión por venta.',
		logo: `${A}/logo-gcode.png`,
		colors: {
			bg: '#0d0d0d', bg2: '#141a4a',
			card: '#141418', card2: '#1b1b21', border: '#2e2e32',
			text: '#f4f4f5', muted: '#a1a1aa',
			accent: '#4f5bff', accent2: '#8b93ff', onAccent: '#ffffff',
			warm: '#ffb86b',
		},
		fonts: {
			url: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Geist:wght@400;500;600;700&family=Caveat:wght@600&display=block',
			display: "'Bebas Neue', Impact, sans-serif",
			text: 'Geist, system-ui, sans-serif',
			hand: 'Caveat, cursive',
		},
		handles: { web: 'www.godcode.me', instagram: '@gcode.labs', whatsapp: '+56 9 4384 8080', linkedin: 'linkedin.com/company/gcode-labs' },
		hashtags: ['#GcodePOS', '#MenuDigital', '#SinComision', '#Restaurantes'],
		slogan: 'Tu carta en un link. Tus pedidos en tu caja.',
	},

	plan: {
		file: 'gcode-plan-semana-1',
		legend: {
			reel: { label: 'Reel demo', color: '#4f5bff' },
			carrusel: { label: 'Carrusel / post', color: '#22c55e' },
			historia: { label: 'Historia', color: '#ffb86b' },
			decision: { label: 'Decisión del equipo', color: '#f472b6' },
		},

		page1: {
			title: 'Plan de **Contenido**',
			objective: 'Que los dueños de locales de comida conozcan Gcode POS, entiendan que **no cobra comisión** y pidan una demo por WhatsApp.',
			metrics: [
				{ icon: 'heart', label: 'Más seguidores' },
				{ icon: 'eye', label: 'Más alcance' },
				{ icon: 'message', label: 'Más interacción' },
				{ icon: 'store', label: 'Más demos' },
			],
			hand: 'A comerse las redes',

			columns: [
				{
					icon: 'camera', title: 'Capturas para contenido estático', subtitle: '(Carruseles, posts, historias)',
					blocks: [
						{ label: 'Qué capturar', items: [
							'La carta con fotos, categorías y variantes, vista en un celular.',
							'El carrito con el total en **USD y Bs** y los métodos de pago.',
							'El panel de caja con pedidos entrando en tiempo real.',
							'Cocina por columnas: entrantes, cocinando, listos.',
							'Reportes del día: ventas, ticket promedio, hora pico.',
							'Inventario con mínimos y productos que se pausan solos.',
							'El local real usando el sistema (con permiso del dueño).',
						] },
						{ label: 'Cómo capturar', style: 'tip', items: [
							'Siempre con datos de prueba: nunca correos ni nombres reales.',
							'Celular a 390×844; el panel en escritorio a 1440 de ancho.',
							'Nada a medio cargar: espera la pantalla completa.',
							'Una idea por lámina y una palabra clave en **azul**.',
						] },
					],
					images: [
						{ src: `${A}/menu-carta.webp`, caption: 'La carta en el celular' },
						{ src: `${A}/menu-carrito.webp`, caption: 'Carrito en USD y Bs' },
						{ src: `${A}/panel-caja.webp`, caption: 'Caja con pedidos' },
					],
					hand: 'Lo que se ve es la app real',
				},
				{
					icon: 'video', title: 'Videos para Reels', subtitle: '(15 – 40 segundos, app real, datos falsos)',
					blocks: [
						{ label: 'Qué grabar', items: [
							'**Así pide tu cliente**: del link al pedido confirmado.',
							'**Y llega a tu caja**: el pedido entra al panel con sonido.',
							'**Mi cuenta y puntos**: el cliente suma y canjea (marca Gcode).',
							'**Delivery o retiro**: zonas con costo y comprobante de pago.',
							'**Carga tu carta en minutos**: panel, productos y fotos.',
							'Un dueño contando cómo le cambió el día (con permiso).',
						] },
						{ label: 'Cómo grabar', items: [
							'Vertical 9:16 con `--safe=instagram`; horizontal solo para la landing.',
							'Gancho en los primeros 3 s: el chat que no para o la pantalla bloqueada.',
							'Un título por paso; la historia se entiende sin sonido.',
							'Celebración al confirmar y cierre con logo, godcode.me y llamado a pedir demo.',
						] },
					],
					images: [
						{ src: `${A}/poster-cliente.jpg`, caption: 'Así pide tu cliente' },
						{ src: `${A}/poster-caja.jpg`, caption: 'Así lo recibes tú' },
						{ src: `${A}/mi-cuenta.jpg`, caption: 'Mi cuenta y puntos' },
					],
					tallImages: true,
					note: 'Cada reel sale de un escenario de esta skill: el pedido final se responde en falso y nunca toca la base real.',
				},
			],

			decide: {
				icon: 'star', title: 'Qué decide el equipo de Gcode',
				intro: 'Lo que cambia semana a semana y define qué se publica: ofertas, casos y novedades reales.',
				blocks: [{ label: 'Contenido a definir', items: [
					'Promo vigente (hoy: **1er pago, 2 meses al precio de 1**).',
					'Qué locales mostrar como caso real y pedirles permiso antes.',
					'Precio que se comunica (desde **$19 USD/mes**, sin permanencia).',
					'Novedades a anunciar (Mi cuenta y puntos para los clientes del local).',
					'Fechas que mueven pedidos: Halloween, fiestas de fin de año.',
					'Colaboraciones con locales, influencers gastronómicos o gremios.',
				] }],
				examplesLabel: 'Ejemplos de contenido a decidir',
				examples: [
					{ src: `${A}/panel-reportes.webp`, title: 'Caso real', caption: 'Un local y sus números, con permiso.' },
					{ src: `${A}/menu-pago.webp`, title: 'Promo del mes', caption: 'Precio, condición y hasta cuándo.' },
					{ src: `${A}/mi-cuenta.jpg`, title: 'Novedad', caption: 'Qué es, para quién y cómo se activa.' },
					{ src: `${A}/panel-inventario.webp`, title: 'Fecha especial', caption: 'Cómo preparar el local con el sistema.' },
				],
				remember: { title: 'Recuerda', text: 'Solo se promete lo que el producto hace hoy. Nada de pantallas que no existen ni de funciones «pronto». Los locales reales aparecen solo con permiso.' },
				hand: 'Cero comisión, cero humo',
			},

			calendarTitle: 'Calendario de contenido', calendarSubtitle: '(Semana 1)',
			calendarText: 'Una pieza por día, alternando producto, educación, prueba social y detrás de Gcode Labs. Dos reels nunca repiten el mismo flujo.',
			week: [
				{ day: 'Lunes', type: 'reel', long: 'Día 1 · Lunes', title: 'Así pide tu cliente', desc: 'Pedido completo desde el link, gancho de pantalla bloqueada.', image: `${A}/poster-cliente.jpg`, tip: 'Vertical, 35–40 s. Cierra con «Pide tu demo».' },
				{ day: 'Martes', type: 'carrusel', long: 'Día 2 · Martes', title: 'Sin comisión: cuánto te ahorras', desc: 'Cinco láminas con la calculadora de comisiones de la landing.', image: `${A}/menu-pago.webp`, tip: 'Número grande por lámina; la última, el precio del plan.' },
				{ day: 'Miércoles', type: 'historia', long: 'Día 3 · Miércoles', title: 'Detrás de Gcode Labs', desc: 'Cómo se carga la carta de un local, en 3 historias.', image: `${A}/menu-carta.webp`, tip: 'Sticker de pregunta: «¿Cuántos productos tiene tu carta?».' },
				{ day: 'Jueves', type: 'reel', long: 'Día 4 · Jueves', title: 'Y el pedido llega a tu caja', desc: 'Del menú al panel: entra con sonido, va a cocina, se cobra.', image: `${A}/poster-caja.jpg`, tip: '20–30 s. Mostrar el cobro dividido.' },
				{ day: 'Viernes', type: 'decision', long: 'Día 5 · Viernes', title: 'Caso real de un cliente', desc: 'Oishi Sushi o Rica Pizza, con su permiso y sus palabras.', image: `${A}/panel-reportes.webp`, tip: 'Pedir permiso el lunes. Sin permiso, se publica el Día 6 en su lugar.' },
				{ day: 'Sábado', type: 'carrusel', long: 'Día 6 · Sábado', title: 'Desde $19 al mes, sin comisión', desc: 'Post gráfico con la promo vigente y el QR a godcode.me.', image: `${A}/panel-caja.webp`, tip: 'Mismo diseño que la ficha historia; CTA a WhatsApp.' },
				{ day: 'Domingo', type: 'reel', long: 'Día 7 · Domingo', title: 'Mi cuenta y puntos', desc: 'El cliente suma puntos y canjea una recompensa, con marca Gcode.', image: `${A}/mi-cuenta.jpg`, tip: 'Regrabar con marca Gcode; cierre «Tus clientes vuelven».' },
			],
		},

		page2: {
			headline: 'Más que un menú, es **tu caja**.',
			tagline: 'Identidad oscura, directa y de producto: la app real en un teléfono, una palabra clave en azul y cero promesas vacías.',
			paletteTitle: 'Línea gráfica',
			palette: [
				{ name: 'Azul Gcode', hex: '#4f5bff', role: 'Principal' },
				{ name: 'Azul claro', hex: '#8b93ff', role: 'Palabra clave' },
				{ name: 'Negro', hex: '#0d0d0d', role: 'Fondos' },
				{ name: 'Humo', hex: '#f4f4f5', role: 'Títulos' },
				{ name: 'Gris', hex: '#a1a1aa', role: 'Textos' },
			],
			typography: { display: 'Bebas Neue', displayRole: 'Títulos en mayúsculas, una palabra en azul', text: 'Geist', textRole: 'Textos, cifras y descripciones' },
			elements: ['Teléfono con la app real', 'Píldoras con check azul', 'Confeti al confirmar', 'Cierre: logo + godcode.me', 'Capturas con datos de prueba'],
			pillarsTitle: 'Pilares de contenido',
			pillars: [
				{ icon: 'store', title: 'Producto', text: 'Menú digital, pedidos, caja, cocina y reportes. Siempre la app real.' },
				{ icon: 'book', title: 'Educación', text: 'Cómo funciona, qué cuesta una comisión, QR y link en la bio.' },
				{ icon: 'users', title: 'Prueba social', text: 'Locales reales en Chile y Venezuela, con permiso y en sus palabras.' },
				{ icon: 'zap', title: 'Detrás de Gcode Labs', text: 'Cómo se construye, el equipo y lo que se aprende con cada local.' },
			],
			reelsTitle: 'Ejemplos de Reels',
			reels: [
				{ image: `${A}/poster-cliente.jpg`, overlay: 'Así pide tu cliente', duration: '35–40 s', title: 'Flujo principal', text: 'Del link al pedido confirmado, con confeti y cierre de marca.' },
				{ image: `${A}/poster-caja.jpg`, overlay: 'Y llega a tu caja', duration: '20–30 s', title: 'El panel', text: 'Entra con sonido, pasa a cocina y se cobra dividido.' },
				{ image: `${A}/menu-pago.webp`, overlay: 'Sin comisión', duration: '8–15 s', title: 'Educativo', text: 'Un número grande: lo que te cobra una app vs. tu plan.' },
				{ image: `${A}/mi-cuenta.jpg`, overlay: 'Tus clientes vuelven', duration: '25–35 s', title: 'Mi cuenta y puntos', text: 'Suma, canjea y vuelve a pedir. Regrabado con marca Gcode.' },
			],
			daysTitle: 'Semana 1, día a día',
			tips: {
				title: 'Sugerencias de captura',
				items: [
					'Siempre datos de prueba: Rica Pizza o un local ficticio.',
					'Celular a 390×844, táctil; panel a 1440 de ancho.',
					'Espera la pantalla completa; nada a medio cargar.',
					'Modo oscuro en las piezas de marca, claro cuando se muestra la carta.',
					'Nunca una pantalla que la app no tiene.',
				],
				images: [`${A}/menu-carta.webp`, `${A}/menu-carrito.webp`, `${A}/panel-cocina.webp`, `${A}/panel-reportes.webp`],
				hand: 'A comerse las redes',
			},
		},
		footHand: 'Tu carta en un link. Tus pedidos en tu caja.',
		hashtags: ['#GcodePOS', '#MenuDigital', '#SinComision', '#Restaurantes'],
	},
};
