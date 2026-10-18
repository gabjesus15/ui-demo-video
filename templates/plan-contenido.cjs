/**
 * Plantilla de plan de contenido semanal. Cópiala a tu proyecto, cambia la marca y el contenido y genera:
 *
 *   node <skill>/scripts/content-plan.cjs mi-plan.cjs out/plan
 *
 * Todo campo con imagen acepta una ruta relativa a este archivo (png, jpg, webp) o una URL.
 * En cualquier texto, `**palabra**` la resalta con el color de acento de la marca.
 * Lo que dejes vacío o quites no se dibuja: `page2` entera es opcional.
 */
module.exports = {
	brand: {
		name: 'Tu marca',
		tagline: 'Una frase corta de lo que haces.', // bajo el título
		logo: './assets/logo.png',
		// Paleta clara (como el plan de referencia). Para una marca oscura, mira examples/godcode/semana-1.cjs.
		colors: {
			bg: '#fbf7ef', bg2: '#fde7c8', // fondo y mancha de color de la esquina superior derecha
			card: '#ffffff', card2: '#f3eee4', border: '#e8dfcf',
			text: '#1d1a16', muted: '#6b655c',
			accent: '#e9772c', accent2: '#c2152f', onAccent: '#ffffff', // color de marca, acento secundario, texto sobre el acento
			warm: '#d97706', // notas manuscritas y tips
		},
		// Fuentes de Google. `display` para títulos (mayúsculas), `text` para el resto, `hand` para las notas manuscritas.
		fonts: {
			url: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Geist:wght@400;500;600;700&family=Caveat:wght@600&display=block',
			display: "'Bebas Neue', Impact, sans-serif",
			text: 'Geist, system-ui, sans-serif',
			hand: 'Caveat, cursive',
		},
		handles: { web: 'www.tu-sitio.com', instagram: '@tu.marca', whatsapp: '+56 9 0000 0000' },
		hashtags: ['#TuMarca', '#TuRubro'],
		slogan: '¡Tu frase de cierre!', // manuscrita, abajo a la izquierda
	},

	plan: {
		file: 'plan-semana-1', // nombre de los archivos de salida
		// Tipos de pieza y su color (la leyenda del calendario). Usa las claves en `week[].type`.
		legend: {
			foto: { label: 'Fotos (estático)', color: '#e9772c' },
			reel: { label: 'Videos (reels)', color: '#2866b2' },
			decision: { label: 'Decisión del dueño', color: '#7c3aed' },
		},

		page1: {
			title: 'Plan de **Contenido**',
			objectiveLabel: 'OBJETIVO',
			objective: 'Aumentar la visibilidad de la marca, conectar con la comunidad y generar más pedidos.',
			metrics: [ // 4 íconos con su texto. Íconos: heart, eye, message, cart, trend, users, store, zap…
				{ icon: 'heart', label: 'Más seguidores' },
				{ icon: 'eye', label: 'Más alcance' },
				{ icon: 'message', label: 'Más interacción' },
				{ icon: 'cart', label: 'Más pedidos' },
			],
			hand: 'El antojo también se comparte', // frase manuscrita arriba a la derecha
			heroImage: './assets/hero.jpg', // opcional

			// Dos columnas de "qué producir". Cada bloque es una lista con viñetas (check) o tips (bombilla).
			columns: [
				{
					icon: 'camera', title: 'Fotos para contenido estático', subtitle: '(Feed, carruseles, stories)',
					blocks: [
						{ label: 'Qué tomar en fotos', items: ['Platos destacados del menú.', 'Detalles de ingredientes y texturas.', 'Combos y promociones.'] },
						{ label: 'Tips de fotografía', style: 'tip', items: ['Usa luz natural o luz blanca suave.', 'Mantén fondos limpios y simples.'] },
					],
					images: [{ src: './assets/foto-1.jpg', caption: 'Plato destacado' }, { src: './assets/foto-2.jpg', caption: 'Detalle' }, { src: './assets/foto-3.jpg', caption: 'Combo' }],
					hand: '¡La comida se ve mejor cuando se siente real!',
				},
				{
					icon: 'video', title: 'Videos para reels breves', subtitle: '(15 – 30 segundos)',
					blocks: [
						{ label: 'Qué grabar', items: ['Preparación del producto (proceso completo o en partes).', 'Close ups y presentación.', 'Detrás de cámaras del local y del equipo.'] },
						{ label: 'Cómo grabar', items: ['Celular en vertical (9:16).', 'Buena iluminación.', 'Videos cortos y dinámicos, con texto en pantalla.'] },
					],
					images: [{ src: './assets/reel-1.jpg', caption: 'Close up' }, { src: './assets/reel-2.jpg', caption: 'Proceso' }, { src: './assets/reel-3.jpg', caption: 'Contenido divertido' }],
					tallImages: true,
					note: 'Tip extra: usa formatos reales, sin filtros excesivos. La naturalidad genera confianza.',
				},
			],

			// Tercera columna: lo que el dueño del negocio tiene que definir.
			decide: {
				icon: 'star', title: 'Qué debe decidir el dueño del local',
				intro: 'Este contenido es clave para mantener la identidad del local, destacar lo más relevante y generar expectativa.',
				blocks: [{ label: 'Contenido a definir', items: ['Producto de la semana (nombre, ingredientes, foto).', 'Promociones especiales (2x1, combos, descuentos).', 'Campañas temáticas (Halloween, Día de la Madre…).', 'Novedades del menú.', 'Horarios especiales.'] }],
				examplesLabel: 'Ejemplo de contenido a decidir por el dueño',
				examples: [
					{ src: './assets/ej-1.jpg', title: 'Producto de la semana', caption: 'Nombre, ingredientes y foto.' },
					{ src: './assets/ej-2.jpg', title: 'Combo especial', caption: 'Fecha y precio.' },
					{ src: './assets/ej-3.jpg', title: 'Promociones', caption: 'o descuentos.' },
					{ src: './assets/ej-4.jpg', title: 'Eventos', caption: 'o colaboraciones.' },
				],
				remember: { title: 'Recuerda', text: 'El dueño del local tiene la última palabra en los contenidos especiales. Nosotros le damos forma visual y los convertimos en piezas para redes.' },
				hand: '¡Tu sazón también es parte de la marca!',
			},

			calendarTitle: 'Calendario de contenido', calendarSubtitle: '(1 semana)',
			calendarText: 'Una combinación equilibrada de fotos, videos y contenido estratégico para mantener la marca activa.',
			// Una tarjeta por día: `type` es una clave de `legend`.
			week: [
				{ day: 'Lunes', type: 'foto', title: 'Plato destacado del menú', desc: 'Foto + texto.', image: './assets/foto-1.jpg', tip: 'Fondo oscuro, luz cálida.' },
				{ day: 'Martes', type: 'reel', title: 'Preparación de un producto', desc: 'Proceso, manos y montaje.', image: './assets/reel-2.jpg', tip: 'Planos cortos, música dinámica.' },
				{ day: 'Miércoles', type: 'foto', title: 'Ingredientes y texturas', image: './assets/foto-2.jpg' },
				{ day: 'Jueves', type: 'reel', title: 'Reacción de un cliente', desc: 'Con permiso.', image: './assets/reel-3.jpg' },
				{ day: 'Viernes', type: 'decision', title: 'Producto de la semana', desc: 'Lo define el dueño.', image: './assets/ej-1.jpg' },
				{ day: 'Sábado', type: 'foto', title: 'Trends o contenido creativo', image: './assets/foto-3.jpg' },
				{ day: 'Domingo', type: 'reel', title: 'Detrás de cámaras', desc: 'El equipo y el local.', image: './assets/reel-1.jpg' },
			],
			// O varias semanas: weeks: [{ title: 'Semana 1', days: [...] }, { title: 'Semana 2', days: [...] }]
		},

		// Página 2 (opcional): identidad, pilares, ejemplos de reels y el calendario con tips.
		page2: {
			headline: 'Más que **producto**, es marca.',
			tagline: 'Una identidad visual fresca y apetecible que potencia la presencia en redes.',
			paletteTitle: 'Línea gráfica',
			palette: [
				{ name: 'Naranja', hex: '#e9772c', role: 'Principal' },
				{ name: 'Rojo', hex: '#c2152f', role: 'Acentos' },
				{ name: 'Crema', hex: '#fdf0c8', role: 'Fondos' },
				{ name: 'Negro', hex: '#201c20', role: 'Contraste' },
			],
			typography: { display: 'Bebas Neue', displayRole: 'Títulos y destacados', text: 'Geist', textRole: 'Textos y descripciones' },
			elements: ['Formas y líneas de la marca', 'Stickers', 'Mascota'],
			pillarsTitle: 'Pilares de contenido',
			pillars: [
				{ icon: 'store', title: 'Producto irresistible', text: 'Platos, ingredientes, preparación y combos.' },
				{ icon: 'smile', title: 'Entretenimiento y personalidad', text: 'Memes, situaciones cotidianas y humor.' },
				{ icon: 'users', title: 'Comunidad y estilo de vida', text: 'Clientes, equipo, interacción y momentos.' },
				{ icon: 'megaphone', title: 'Promociones y ventas', text: 'Novedades, ofertas, ubicación y pedidos.' },
			],
			reelsTitle: 'Ejemplos de Reels / Stories',
			reels: [
				{ image: './assets/reel-1.jpg', overlay: 'Producto del mes', duration: '8–15 s', title: 'Producto protagonista', text: 'Close ups, buena luz y sonido ambiente.' },
				{ image: './assets/reel-3.jpg', overlay: 'Yo intentando hacer dieta…', duration: '7–12 s', title: 'Humor y personalidad', text: 'Textos cortos y dinámicos.' },
				{ image: './assets/reel-2.jpg', overlay: 'Detrás de cada producto', duration: '12–20 s', title: 'Proceso de preparación', text: 'Ingredientes, manos y montaje.' },
				{ image: './assets/ej-2.jpg', overlay: '¿Team A o team B?', duration: '8–12 s', title: 'Interacción', text: 'Preguntas y encuestas.' },
			],
			daysTitle: 'Plan de contenido · 1 semana',
			// days: si lo omites, usa `page1.week` (con `tip` y `long` por día). `long` es el rótulo: 'Día 1 · Lunes'.
			tips: {
				title: 'Sugerencias de fotografía',
				items: ['Luz natural o luz cálida (evita sombras fuertes).', 'Fondo limpio y neutro.', 'Enfoque en la textura.', 'Planos variados: cenital, 45° y close up.'],
				images: ['./assets/foto-1.jpg', './assets/foto-2.jpg', './assets/foto-3.jpg', './assets/reel-1.jpg'],
				hand: 'El antojo también se comparte',
			},
		},
		footHand: '¡Buen producto, buena vibra!',
		hashtags: ['#TuMarca', '#TuRubro'],
	},
};
