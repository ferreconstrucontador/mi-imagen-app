// Ayuda: preguntas frecuentes y 6 ejemplos prácticos.
import { $, esc } from '../ui.js';

const FAQ = [
  ['¿MiImagenApp es gratis?', 'Sí. La app es gratuita y usa la API Key gratuita de Google AI Studio. El nivel gratuito de Gemini permite muchas consultas al día para uso personal. Solo necesitas una cuenta de Google.'],
  ['¿Dónde se guardan mis fotos y datos?', 'Únicamente en tu teléfono o computadora (en el almacenamiento local del navegador). No hay servidores propios ni cuentas. Las fotos solo viajan a Google Gemini en el momento en que tú pides un análisis.'],
  ['¿Qué es la API Key y cómo la obtengo?', 'Es una “llave” personal que permite a la app hablar con la inteligencia artificial de Google. Entra a aistudio.google.com/apikey con tu Gmail, presiona “Create API key”, cópiala y pégala en Ajustes → Guardar y validar.'],
  ['¿Por qué me pide ciudad y clima?', 'Porque no es lo mismo vestirse y maquillarse en Campeche que en Bogotá. La IA usa tu ubicación y clima en TODOS los análisis: telas frescas o térmicas, bases resistentes a la humedad, cuidado anti-frizz, compras y outfits.'],
  ['¿Qué tan precisa es la colorimetría?', 'Es muy buena orientación si tu selfie tiene luz natural, sin maquillaje y sin filtros. Usa el draping digital para comprobarlo tú misma: los colores ideales iluminan tu piel y suavizan ojeras. Si cambias mucho tu color de cabello, vuelve a analizarte.'],
  ['¿Qué es el draping digital?', 'Es la técnica de las asesoras de poner telas de colores bajo el rostro. En el Pilar 1 puedes “probarte” cada color de tu paleta alrededor de tu selfie y comparar lado a lado un color ideal contra uno a evitar.'],
  ['¿Por qué un análisis tarda o falla?', 'Gemini puede tardar de 10 a 40 segundos. Si ves “límite gratuito alcanzado”, espera un minuto. Si dice “modelo no disponible”, cambia el modelo en Ajustes a gemini-2.5-flash o al más reciente.'],
  ['¿Qué es el Estilizador Versátil?', 'Está en Mi Armario → “Estilizador Versátil”. Eliges una prenda de tu armario (o le tomas foto a una nueva) y Gemini te muestra cómo llevarla en los 7 Estilos Universales: Natural, Clásico, Elegante, Romántico, Seductor, Creativo y Dramático. Aquí la IA sugiere libremente prendas que quizá no tienes; puedes mandar cualquiera a tu lista Por Comprar con un toque.'],
  ['¿Cómo paso mis datos a otro teléfono?', 'En Ajustes → Exportar respaldo (.json). Envíate el archivo (correo, WhatsApp, Drive) y en el otro teléfono usa Importar respaldo. Funciona también para guardar copias de seguridad.'],
  ['¿Funciona sin internet?', 'Sí para consultar tu diagnóstico, armario y lista Por Comprar. Los análisis con IA necesitan conexión.'],
  ['¿Cuántas prendas puedo guardar?', 'Cientos. Cada foto se comprime automáticamente (máx. 800 px, ~60–120 KB) y se guarda en la base de datos del navegador, que normalmente tiene varios GB disponibles. En Ajustes ves el espacio real usado y disponible; exporta respaldos con frecuencia.'],
  ['¿Cómo la instalo como app?', 'Android (Chrome): menú ⋮ → “Instalar app”. iPhone (Safari): botón Compartir → “Agregar a pantalla de inicio”. Se abrirá a pantalla completa como cualquier app.'],
];

const EJEMPLOS = [
  {
    titulo: 'Mi primer diagnóstico',
    persona: 'Mariana, 29 años · Mérida, Yucatán · Cálido húmedo',
    situacion: 'Siente que el negro la “apaga” y que su maquillaje se derrite a mediodía.',
    pasos: ['Pega su API Key en Ajustes.', 'Toma su selfie junto a la ventana, sin maquillaje y con el cabello recogido.', 'Escribe “Mérida, Yucatán” y elige “Cálido húmedo”.', 'Presiona “Analizar con Gemini IA”.'],
    resultado: 'Primavera Cálida, subtono cálido y contraste medio. Su paleta incluye coral, durazno, verde oliva claro y camel; el negro va lejos del rostro. Metal ideal: oro amarillo. Base matificante de larga duración, primer controlador de grasa y bruma fijadora.',
    tip: 'En el draping compara coral vs. negro: verás cómo el coral ilumina y el negro marca ojeras.',
  },
  {
    titulo: '¿Compro este saco para la oficina?',
    persona: 'Laura, 42 años · Monterrey, Nuevo León · Cálido seco',
    situacion: 'Encontró un saco camel en una tienda en línea y duda si le queda.',
    pasos: ['Va a “Evaluar Compra”.', 'Pega el enlace de la tienda y agrega una captura de pantalla.', 'Elige la ocasión “Oficina / Ejecutivo”.', 'Presiona “¿Me queda bien?”.'],
    resultado: '9/10 “¡Cómprala!”. El camel está en su paleta de Otoño Suave y el corte recto al hueso de la cadera equilibra su silueta rectángulo. Combina con su pantalón marino y blusa marfil de su armario. Sugerencia: aretes medianos dorados y labial terracota.',
    tip: 'Presiona “Agregar a Por Comprar” para no olvidarlo y comparar precios.',
  },
  {
    titulo: 'Vestido para una boda de noche',
    persona: 'Sofía, 35 años · Ciudad de México · Templado',
    situacion: 'Quiere un vestido negro largo para una boda.',
    pasos: ['Sube la foto del vestido.', 'Elige “Noche / Fiesta / Gala”.', 'Analiza.'],
    resultado: '5/10 “Mejor déjala pasar”. Como Verano Suave, el negro puro endurece sus facciones. Gemini sugiere azul marino profundo, ciruela o gris carbón, con escote en V y plata o oro blanco. Para la noche: labial frambuesa suave y ahumado en taupe.',
    tip: 'El campo “Mejor busca” te dice exactamente qué buscar en la tienda.',
  },
  {
    titulo: 'Cargar mi clóset en 15 minutos',
    persona: 'Daniela, 24 años · Bogotá, Colombia · Frío',
    situacion: 'Quiere registrar lo que ya tiene sin escribir todo a mano.',
    pasos: ['En “Mi Armario” presiona “Agregar inventario inicial”.', 'Toma la foto de una prenda sobre la cama.', 'Elige la categoría (ej. Sacos / Abrigos).', 'Gemini detecta “Abrigo largo de paño gris”, color Gris y ocasiones Oficina y Casual.', 'Presiona “Guardar y agregar otra” y repite.'],
    resultado: 'En 15 minutos registró 20 artículos organizados por las 9 categorías, filtrables por color y ocasión.',
    tip: 'Fotografía cada prenda extendida sobre un fondo liso para mejores detecciones.',
  },
  {
    titulo: 'Outfits de oficina con lo que ya tengo',
    persona: 'Patricia, 51 años · Guadalajara, Jalisco · Variable',
    situacion: 'Siente que “no tiene qué ponerse” para la oficina.',
    pasos: ['Con 25 artículos en su armario, presiona “Generar outfits”.', 'Elige “Oficina / Ejecutivo”.', 'Presiona “Crear mis 3 outfits”.'],
    resultado: 'Tres looks completos con fotos de sus propias prendas: pantalón wide leg marino + blusa marfil + mocasines nude + collar corto dorado; incluye capas para el clima variable, maquillaje y peinado. Además, una lista de piezas que completarían su armario.',
    tip: 'Los outfits se guardan en “Outfits generados” para consultarlos en la mañana.',
  },
  {
    titulo: 'Maquillaje que aguante la playa',
    persona: 'Andrea, 31 años · Cancún, Quintana Roo · Cálido húmedo',
    situacion: 'Quiere un labial para sus vacaciones que no se corra con el calor.',
    pasos: ['Sube la foto del labial (o el enlace de la tienda).', 'Elige “Clima Cálido / Vacaciones / Playa”.', 'Analiza.'],
    resultado: '8/10. El tono coral rosado está en su paleta de labiales de día. Gemini recomienda la versión líquida mate de larga duración (más resistente a la humedad que la cremosa), aplicar bálsamo con FPS debajo y fijar con polvo traslúcido.',
    tip: 'Si lo compras, “Marcar como Comprado” lo mueve a tu categoría Maquillaje en Mi Armario.',
  },
];

export function mount(el) {
  el.innerHTML = `
    <div class="view-head">
      <p class="eyebrow">Centro de ayuda</p>
      <h2 class="display">Ayuda y ejemplos</h2>
      <p class="lead">Todo lo que necesitas para sacarle el máximo provecho a tu asesora de imagen con IA.</p>
      <div class="btn-row">
        <button class="btn btn-primary" id="ayuda-tour">🧭 Iniciar tour guiado</button>
        <a class="btn btn-soft" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">🔑 Obtener API Key gratis</a>
      </div>
    </div>

    <div class="card">
      <h3 class="section-title">Preguntas frecuentes</h3>
      <div class="faq">${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
    </div>

    <h3 class="section-title outside">6 ejemplos prácticos</h3>
    <div class="examples">${EJEMPLOS.map((e, i) => `
      <article class="card example">
        <span class="example-num">${i + 1}</span>
        <h4>${esc(e.titulo)}</h4>
        <p class="eyebrow">${esc(e.persona)}</p>
        <p><b>Situación:</b> ${esc(e.situacion)}</p>
        <h5>Paso a paso</h5>
        <ol class="nice-list numbered">${e.pasos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>
        <h5>Lo que obtiene</h5>
        <p>${esc(e.resultado)}</p>
        <div class="callout">💡 ${esc(e.tip)}</div>
      </article>`).join('')}
    </div>
  `;
  $('#ayuda-tour', el).addEventListener('click', () => window.MiImagen.iniciarTour());
}
