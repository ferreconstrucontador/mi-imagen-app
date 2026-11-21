// Conexión directa del navegador con la API REST de Google Gemini.
import { store } from './store.js';
import { dataUrlParts } from './image.js';
import { DEFAULT_MODEL, CATEGORIAS, COLORES, OCASIONES, nombreClima, nombreOcasion, nombreCategoria, nombreColor } from './constants.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const TIMEOUT_MS = 120000;

export class GeminiError extends Error {
  constructor(message, { code = 'desconocido', status = 0, detalle = '' } = {}) {
    super(message);
    this.name = 'GeminiError';
    this.code = code;
    this.status = status;
    this.detalle = detalle;
  }
}

export function hayApiKey() {
  return !!store.get().apiKey;
}

function traducirError(status, body) {
  const msg = body?.error?.message || '';
  const reason = JSON.stringify(body?.error?.details || '') + msg;
  if (/API_KEY_INVALID|API key not valid|API key expired/i.test(reason)) {
    return new GeminiError('Tu API Key no es válida o expiró. Revísala en Ajustes (cópiala completa desde Google AI Studio).', { code: 'api_key', status, detalle: msg });
  }
  if (status === 400 && /location is not supported|User location/i.test(msg)) {
    return new GeminiError('Google Gemini no está disponible en la ubicación desde la que te conectas.', { code: 'region', status, detalle: msg });
  }
  if (status === 403) {
    return new GeminiError('Tu API Key no tiene permiso para usar Gemini. Genera una nueva en Google AI Studio.', { code: 'permiso', status, detalle: msg });
  }
  if (status === 404) {
    return new GeminiError('El modelo de IA seleccionado no está disponible. Cambia el modelo en Ajustes (por ejemplo, gemini-2.5-flash).', { code: 'modelo', status, detalle: msg });
  }
  if (status === 429) {
    return new GeminiError('Alcanzaste el límite gratuito de consultas por ahora. Espera un minuto e inténtalo de nuevo, o prueba el modelo Flash-Lite en Ajustes.', { code: 'cuota', status, detalle: msg });
  }
  if (status >= 500) {
    return new GeminiError('Los servidores de Gemini están saturados en este momento. Inténtalo de nuevo en unos segundos.', { code: 'servidor', status, detalle: msg });
  }
  return new GeminiError(`Gemini respondió con un error (${status}). ${msg}`.trim(), { code: 'http', status, detalle: msg });
}

async function fetchConTimeout(url, opts, ms = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } catch (e) {
    if (e.name === 'AbortError') throw new GeminiError('La IA tardó demasiado en responder. Revisa tu conexión e inténtalo de nuevo.', { code: 'timeout' });
    if (!navigator.onLine) throw new GeminiError('Parece que no tienes conexión a internet. Conéctate para usar el análisis con IA.', { code: 'offline' });
    throw new GeminiError('No se pudo conectar con Google Gemini. Revisa tu conexión a internet.', { code: 'red', detalle: String(e) });
  } finally {
    clearTimeout(t);
  }
}

/** Comprueba la API Key listando el modelo configurado. */
export async function validarApiKey(apiKey, modelo) {
  const key = (apiKey || '').trim();
  if (!key) throw new GeminiError('Pega tu API Key antes de validarla.', { code: 'sin_key' });
  if (!/^[A-Za-z0-9_\-]{20,}$/.test(key)) {
    throw new GeminiError('El formato no parece una API Key de Google (suele empezar con "AIza" y no lleva espacios).', { code: 'formato' });
  }
  const m = (modelo || DEFAULT_MODEL).trim();
  const res = await fetchConTimeout(`${API_BASE}/models/${encodeURIComponent(m)}`, {
    headers: { 'x-goog-api-key': key },
  }, 20000);
  if (!res.ok) {
    let body = null;
    try { body = await res.json(); } catch { /* */ }
    throw traducirError(res.status, body);
  }
  return res.json();
}

/** Extrae JSON de una respuesta (con o sin bloque ```json). */
export function parseJSON(texto) {
  if (!texto) throw new GeminiError('La IA devolvió una respuesta vacía. Inténtalo de nuevo.', { code: 'vacio' });
  let t = texto.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  if (fence) t = fence[1].trim();
  try { return JSON.parse(t); } catch { /* intentamos recortar */ }
  const ini = Math.min(...['{', '['].map((c) => { const i = t.indexOf(c); return i < 0 ? Infinity : i; }));
  const fin = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (ini !== Infinity && fin > ini) {
    try { return JSON.parse(t.slice(ini, fin + 1)); } catch { /* */ }
  }
  throw new GeminiError('La respuesta de la IA llegó incompleta. Vuelve a intentarlo.', { code: 'json', detalle: texto.slice(0, 300) });
}

/**
 * Llamada genérica a generateContent.
 * @param {{prompt:string, imagenes?:string[], json?:boolean, urlContext?:boolean, temperatura?:number}} p
 */
export async function generar({ prompt, imagenes = [], json = true, urlContext = false, temperatura = 0.6 }) {
  const { apiKey, settings } = store.get();
  if (!apiKey) {
    throw new GeminiError('Primero configura tu API Key gratuita de Google Gemini en la pestaña Ajustes.', { code: 'sin_key' });
  }
  const modelo = (settings.modelo || DEFAULT_MODEL).trim();
  const parts = [{ text: prompt }];
  imagenes.filter(Boolean).forEach((img) => {
    const p = dataUrlParts(img);
    if (p) parts.push({ inlineData: { mimeType: p.mimeType, data: p.data } });
  });

  const body = {
    systemInstruction: { parts: [{ text: SISTEMA }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: temperatura },
  };
  // JSON estricto no se puede combinar con herramientas, así que con URL pedimos JSON en texto.
  if (urlContext) body.tools = [{ urlContext: {} }];
  else if (json) body.generationConfig.responseMimeType = 'application/json';

  const llamar = async (b) => {
    const res = await fetchConTimeout(`${API_BASE}/models/${encodeURIComponent(modelo)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(b),
    });
    let data = null;
    try { data = await res.json(); } catch { /* */ }
    if (!res.ok) throw traducirError(res.status, data);
    return data;
  };

  let data;
  try {
    data = await llamar(body);
  } catch (e) {
    if (e instanceof GeminiError && e.code === 'servidor') {
      await new Promise((r) => setTimeout(r, 2500));
      data = await llamar(body);
    } else if (e instanceof GeminiError && urlContext && (e.status === 400)) {
      // El modelo no admite lectura de enlaces: reintentamos sin la herramienta.
      delete body.tools;
      if (json) body.generationConfig.responseMimeType = 'application/json';
      data = await llamar(body);
    } else {
      throw e;
    }
  }

  if (data?.promptFeedback?.blockReason) {
    throw new GeminiError('Gemini no pudo procesar esta imagen por sus filtros de seguridad. Prueba con otra foto.', { code: 'bloqueo' });
  }
  const cand = data?.candidates?.[0];
  if (!cand) throw new GeminiError('La IA no devolvió resultados. Inténtalo de nuevo.', { code: 'vacio' });
  if (cand.finishReason === 'SAFETY') {
    throw new GeminiError('Gemini bloqueó la respuesta por sus filtros de seguridad. Prueba con otra foto o descripción.', { code: 'bloqueo' });
  }
  const texto = (cand.content?.parts || []).filter((p) => p.text && !p.thought).map((p) => p.text).join('');
  if (cand.finishReason === 'MAX_TOKENS' && !texto) {
    throw new GeminiError('La respuesta fue demasiado larga y se cortó. Inténtalo de nuevo.', { code: 'max_tokens' });
  }
  return json ? parseJSON(texto) : texto;
}

// ------------------------------------------------------------------
// Prompts
// ------------------------------------------------------------------

const SISTEMA = `Eres "Valentina", asesora de imagen personal femenina certificada, experta en colorimetría (sistema de 12 estaciones), visagismo, maquillaje profesional, morfología corporal, estilismo, cuidado de la piel y cabello, y presencia personal.
Reglas obligatorias:
- Responde SIEMPRE en español natural (de México, neutro), hablándole a la usuaria de "tú" y en femenino, con calidez, respeto y lenguaje positivo. Nunca hagas comentarios negativos sobre su cuerpo o rostro: habla de "equilibrar", "resaltar" y "favorecer".
- Usa OBLIGATORIAMENTE su ciudad de residencia y su clima predominante como contexto en cada recomendación: telas (transpirables, térmicas, etc.), fórmulas de maquillaje resistentes al clima (larga duración, a prueba de humedad/sudor, hidratantes en frío o clima seco), cuidado capilar (anti-frizz, hidratación, protección UV) y compras realistas para su ciudad.
- Sé concreta y práctica: nombra colores con su código HEX, prendas, cortes y productos específicos (tipos de fórmula, no marcas obligatorias).
- Si la foto no tiene buena luz o no es clara, haz tu mejor estimación e indícalo en el campo de notas correspondiente.
- Devuelve exclusivamente JSON válido cuando se te pida, sin texto adicional.`;

export function contextoPerfil({ incluirDiagnostico = true } = {}) {
  const { profile: p, diagnostico } = store.get();
  const lineas = [
    'PERFIL DE LA USUARIA:',
    p.nombre ? `- Nombre: ${p.nombre}` : null,
    p.edad ? `- Edad aproximada: ${p.edad} años` : null,
    p.estatura ? `- Estatura: ${p.estatura} cm` : null,
    p.estilos?.length ? `- Estilos que prefiere: ${p.estilos.join(', ')}` : null,
    `- Ciudad de residencia: ${p.ciudad || 'no indicada'}`,
    `- Clima predominante: ${p.clima ? nombreClima(p.clima) : 'no indicado'}`,
    p.notas ? `- Notas personales: ${p.notas}` : null,
  ].filter(Boolean);
  if (incluirDiagnostico && diagnostico?.data) {
    const d = diagnostico.data;
    const c = d.colorimetria || {};
    const v = d.visagismo || {};
    const m = d.morfologia || {};
    const lista = (arr) => (Array.isArray(arr) ? arr.map((x) => (typeof x === 'string' ? x : `${x.nombre} ${x.hex || ''}`.trim())).join(', ') : '');
    lineas.push(
      '',
      'DIAGNÓSTICO DE IMAGEN YA REALIZADO:',
      `- Estación: ${c.estacion || ''}; subtono: ${c.subtono || ''}; contraste: ${c.contraste || ''}`,
      `- Colores básicos: ${lista(c.paleta?.basicos)}`,
      `- Colores de acento: ${lista(c.paleta?.acentos)}`,
      `- Nudes de piel: ${lista(c.paleta?.nudesPiel)}; nudes de calzado: ${lista(c.paleta?.nudesCalzado)}`,
      `- Colores a evitar: ${lista(c.evitar)}`,
      `- Metales: ${c.metales?.ideal || ''} ${c.metales?.alternativo ? '(alternativo: ' + c.metales.alternativo + ')' : ''}`,
      `- Forma de rostro: ${v.formaRostro || ''}`,
      `- Silueta corporal: ${m.silueta || ''}; objetivo de estilismo: ${m.objetivo || ''}`,
    );
  }
  return lineas.join('\n');
}

const hexItem = '{"nombre": "string", "hex": "#RRGGBB"}';

export async function analizarDiagnostico() {
  const { profile } = store.get();
  const imagenes = [profile.selfie, profile.cuerpo].filter(Boolean);
  const prompt = `${contextoPerfil({ incluirDiagnostico: false })}

Te comparto ${profile.cuerpo ? 'dos fotografías: 1) una selfie con luz natural y 2) una foto de cuerpo completo' : 'una selfie con luz natural (no hay foto de cuerpo completo: para la morfología usa su estatura y da recomendaciones generales indicando que puede afinarse con una foto de cuerpo completo)'}.

Realiza un diagnóstico de imagen integral en 4 PILARES, adaptado a su ciudad (${profile.ciudad || 'no indicada'}) y clima (${nombreClima(profile.clima) || 'no indicado'}).
Devuelve SOLO un JSON con esta estructura exacta (todos los textos en español; los colores con HEX realista):
{
  "resumen": "2-3 frases cálidas que resuman su imagen ideal",
  "colorimetria": {
    "subtono": "Cálido | Frío | Neutro | Oliva (con una breve explicación)",
    "contraste": "Bajo | Medio | Alto (con breve explicación)",
    "estacion": "una de las 12: Primavera Clara, Primavera Cálida, Primavera Brillante, Verano Claro, Verano Frío, Verano Suave, Otoño Suave, Otoño Cálido, Otoño Profundo, Invierno Profundo, Invierno Frío, Invierno Brillante",
    "descripcionEstacion": "por qué pertenece a esa estación y cómo se ve su mejor versión",
    "paleta": {
      "basicos": [6 a 8 objetos ${hexItem}],
      "acentos": [6 a 8 objetos ${hexItem}],
      "nudesPiel": [3 a 4 objetos ${hexItem} (tonos nude exactos de ropa interior, blusas y labios según su piel)],
      "nudesCalzado": [3 objetos ${hexItem} (nude de zapatos que alargan la pierna)]
    },
    "evitar": [5 a 6 objetos {"nombre": "string", "hex": "#RRGGBB", "motivo": "string corto"}],
    "metales": {"ideal": "Oro amarillo | Oro blanco / Plata | Oro rosa", "alternativo": "string", "explicacion": "string"},
    "consejos": ["3 a 5 consejos prácticos de uso del color, considerando el clima local"]
  },
  "visagismo": {
    "formaRostro": "Ovalado | Redondo | Cuadrado | Rectangular | Corazón | Diamante | Triangular",
    "facciones": "descripción amable de facciones y rasgos a resaltar",
    "maquillaje": {
      "base": "tono, subtono y fórmula ideal para su clima (ej. matificante de larga duración en clima húmedo)",
      "corrector": "string",
      "rubor": "string con tonos",
      "sombras": "string con tonos",
      "delineador": "string",
      "labialesDia": [3 objetos ${hexItem}],
      "labialesNoche": [3 objetos ${hexItem}],
      "tipClima": "cómo hacer que el maquillaje dure en su clima"
    },
    "cabello": {
      "cortes": ["3 cortes ideales con explicación breve"],
      "flequillo": "string",
      "peinados": ["3 peinados prácticos para su clima"],
      "coloracion": "tonos de tinte o mechas que la favorecen",
      "cuidadoClima": "string"
    },
    "cejas": "diseño de cejas ideal según su rostro",
    "notas": "observaciones sobre la calidad de la foto si aplica, o cadena vacía"
  },
  "morfologia": {
    "silueta": "Reloj de arena | Triángulo (pera) | Triángulo invertido | Rectángulo | Óvalo (manzana) | Diamante",
    "proporciones": "descripción de proporciones considerando su estatura",
    "objetivo": "objetivo visual de estilismo (ej. equilibrar hombros y cadera)",
    "prendas": {
      "tops": "string", "escotes": "string", "pantalones": "string", "faldas": "string",
      "vestidos": "string", "largos": "largos ideales de falda/pantalón/sacos", "telas": "telas ideales para su clima", "estampados": "escala y tipo de estampados",
      "evitar": ["3 a 5 cosas que no la favorecen tanto"]
    },
    "accesorios": {
      "aretes": "string", "collares": "string (según tipo de escote)", "lentesOftalmicos": "armazones ideales",
      "lentesSol": "string", "bolsos": "tamaño y forma según su estatura", "cinturones": "string",
      "panuelosSombreros": "string (considerando su clima)", "relojesPulseras": "string", "calzado": "string"
    },
    "notas": "string"
  },
  "cuidado": {
    "skincareManana": ["pasos de la rutina de mañana adaptados al clima"],
    "skincareNoche": ["pasos de la rutina de noche"],
    "semanal": ["2 a 3 cuidados semanales"],
    "capilar": ["3 a 5 cuidados capilares según su clima"],
    "postura": ["3 consejos de postura"],
    "proyeccion": ["3 consejos de presencia y proyección personal"]
  }
}`;
  return generar({ prompt, imagenes, temperatura: 0.5 });
}

function armarioResumen() {
  const { armario } = store.get();
  if (!armario.length) return 'Su Armario Virtual está vacío por ahora.';
  return 'ARMARIO VIRTUAL (id | categoría | nombre | color | ocasiones):\n' + armario.slice(0, 150).map((a) =>
    `${a.id} | ${nombreCategoria(a.categoria)} | ${a.nombre} | ${nombreColor(a.color)} | ${a.ocasiones.map(nombreOcasion).join(', ') || 'sin ocasión'}`
  ).join('\n');
}

export async function evaluarCompra({ foto, url, descripcion, precio, ocasion, categoria }) {
  const { profile, diagnostico } = store.get();
  const imagenes = [];
  if (foto) imagenes.push(foto);
  const usarSelfie = !diagnostico?.data && profile.selfie;
  if (usarSelfie) imagenes.push(profile.selfie);
  const catIds = CATEGORIAS.map((c) => `${c.id} (${c.nombre})`).join(', ');
  const colorIds = COLORES.map((c) => `${c.id} (${c.nombre})`).join(', ');
  const prompt = `${contextoPerfil()}

${armarioResumen()}

ARTÍCULO A EVALUAR:
${foto ? '- La primera imagen adjunta es la foto de la prenda/accesorio/producto.' : '- No hay foto del artículo.'}
${usarSelfie ? '- La última imagen es la selfie de la usuaria (aún no tiene diagnóstico guardado; estímalo para esta evaluación).' : ''}
${url ? `- Enlace de la tienda: ${url} (si puedes leer la página, usa nombre, colores, tela y precio reales).` : ''}
${descripcion ? `- Descripción de la usuaria: ${descripcion}` : ''}
${precio ? `- Precio: ${precio}` : ''}
${categoria ? `- Categoría indicada: ${nombreCategoria(categoria)}` : ''}
- Ocasión / estilo en que piensa usarlo: ${nombreOcasion(ocasion)}

Evalúa si este artículo le queda bien considerando su colorimetría, visagismo, morfología, su clima en ${profile.ciudad || 'su ciudad'} y lo que ya tiene en su armario.
Responde SOLO con JSON (sin texto adicional) con esta estructura:
{
  "nombre": "nombre corto y descriptivo del artículo",
  "categoria": "uno de estos ids: ${catIds}",
  "color": "uno de estos ids según el color predominante: ${colorIds}",
  "ocasiones": ["ids de ocasiones donde funciona, de: ${OCASIONES.map((o) => o.id).join(', ')}"],
  "puntuacion": número entero del 1 al 10,
  "veredicto": "¡Cómprala! | Vale la pena con ajustes | Mejor déjala pasar",
  "resumen": "2-3 frases con el veredicto general",
  "colorimetria": "análisis de cómo el color favorece (o no) a su estación",
  "corte": "análisis del corte, silueta, largo y tela respecto a su morfología/visagismo y al clima",
  "combinaCon": [{"id": "id EXACTO de su armario", "porque": "string"}] (máximo 5; arreglo vacío si no hay coincidencias),
  "maquillaje": "sugerencia de maquillaje para usarlo",
  "accesorios": "sugerencia de accesorios y calzado",
  "consejoClima": "consejo sobre usarlo en su clima",
  "alternativa": "si la puntuación es menor a 7, qué buscar en su lugar; si no, cadena vacía",
  "precioEstimado": "precio detectado o estimado en moneda local, o cadena vacía"
}`;
  const r = await generar({ prompt, imagenes, urlContext: !!url, temperatura: 0.5 });
  return sanearEvaluacion(r);
}

function sanearEvaluacion(r) {
  const ids = new Set(store.get().armario.map((a) => a.id));
  const ocs = new Set(OCASIONES.map((o) => o.id));
  const out = { ...r };
  out.puntuacion = Math.max(1, Math.min(10, Math.round(+r.puntuacion || 5)));
  out.combinaCon = (Array.isArray(r.combinaCon) ? r.combinaCon : []).filter((c) => c && ids.has(String(c.id))).map((c) => ({ id: String(c.id), porque: c.porque || '' }));
  out.ocasiones = (Array.isArray(r.ocasiones) ? r.ocasiones : []).filter((o) => ocs.has(o));
  if (!CATEGORIAS.some((c) => c.id === r.categoria)) out.categoria = '';
  if (!COLORES.some((c) => c.id === r.color)) out.color = '';
  return out;
}

export async function detectarArticulo({ foto, categoria }) {
  const colorIds = COLORES.map((c) => `${c.id} (${c.nombre})`).join(', ');
  const prompt = `${contextoPerfil({ incluirDiagnostico: false })}

La usuaria está registrando un artículo que YA TIENE en su clóset, de la categoría "${nombreCategoria(categoria)}". Observa la foto y responde SOLO con JSON:
{
  "nombre": "nombre corto y descriptivo en español (máx. 6 palabras, ej. 'Blusa de lino coral manga corta')",
  "descripcion": "una frase con tela/textura aparente, corte y detalles",
  "color": "uno de estos ids: ${colorIds}",
  "ocasiones": ["1 a 3 ids de: ${OCASIONES.map((o) => `${o.id} (${o.nombre})`).join(', ')}"]
}`;
  const r = await generar({ prompt, imagenes: [foto], temperatura: 0.3 });
  const ocs = new Set(OCASIONES.map((o) => o.id));
  return {
    nombre: String(r.nombre || '').slice(0, 80),
    descripcion: String(r.descripcion || ''),
    color: COLORES.some((c) => c.id === r.color) ? r.color : '',
    ocasiones: (Array.isArray(r.ocasiones) ? r.ocasiones : []).filter((o) => ocs.has(o)),
  };
}

export async function generarOutfits({ ocasion }) {
  const { profile, armario } = store.get();
  const prompt = `${contextoPerfil()}

${armarioResumen()}

Arma EXACTAMENTE 3 outfits completos para la ocasión "${nombreOcasion(ocasion)}", usando ÚNICAMENTE artículos de su Armario Virtual (refiérete a ellos por su id exacto). Considera el clima de ${profile.ciudad || 'su ciudad'} (${nombreClima(profile.clima) || 'clima no indicado'}), su colorimetría y su morfología. Cada outfit debe incluir, si existen en el armario: prendas principales, calzado, bolso y joyería/accesorios. Si falta alguna pieza clave en su armario, menciónala en "faltantes".
Responde SOLO con JSON:
{
  "outfits": [
    {
      "titulo": "nombre inspirador del look",
      "piezas": ["ids exactos del armario"],
      "descripcion": "cómo combinarlo y llevarlo",
      "maquillaje": "sugerencia de maquillaje (considerando el clima)",
      "peinado": "sugerencia de peinado",
      "porQueFunciona": "por qué la favorece (color/silueta)"
    }
  ],
  "faltantes": ["prendas o accesorios que convendría tener para esta ocasión"]
}`;
  const r = await generar({ prompt, temperatura: 0.8 });
  const ids = new Set(armario.map((a) => a.id));
  const outfits = (Array.isArray(r.outfits) ? r.outfits : []).slice(0, 3).map((o) => ({
    titulo: o.titulo || 'Look',
    piezas: (Array.isArray(o.piezas) ? o.piezas : []).map(String).filter((id) => ids.has(id)),
    descripcion: o.descripcion || '',
    maquillaje: o.maquillaje || '',
    peinado: o.peinado || '',
    porQueFunciona: o.porQueFunciona || '',
  }));
  return { outfits, faltantes: Array.isArray(r.faltantes) ? r.faltantes.map(String) : [] };
}
