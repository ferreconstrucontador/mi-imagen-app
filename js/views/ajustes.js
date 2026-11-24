// Ajustes: API Key de Gemini, modelo, respaldos (.json y Doble Bóveda), almacenamiento e instalación.
import { store } from '../store.js';
import { MODELOS_SUGERIDOS, DEFAULT_MODEL, APP_NAME } from '../constants.js';
import { validarApiKey } from '../gemini.js';
import { $, esc, toast, mostrarError, mostrarDialogo, fechaCorta, cargando } from '../ui.js';
import { exportarRespaldo, nombreArchivo } from '../respaldo.js';
import { listarCopias, restaurarCopia, fechaLocal, MAX_COPIAS } from '../boveda.js';

let root;
let escuchando = false;

export function mount(el) {
  root = el;
  const s = store.get();
  el.innerHTML = `
    <div class="view-head">
      <p class="eyebrow">Configuración</p>
      <h2 class="display">Ajustes</h2>
    </div>

    <div class="card" data-tour="apikey">
      <h3 class="section-title">🔑 Conexión con Google Gemini IA</h3>
      <p class="muted small">Pega tu API Key gratuita de Google AI Studio. Se guarda <b>solo en este dispositivo</b> y se envía únicamente a Google para hacer los análisis.</p>
      <label class="field"><span>API Key de Gemini</span>
        <div class="input-group">
          <input type="password" id="api-key" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="AQ.… o AIza…" value="${esc(s.apiKey)}">
          <button type="button" class="btn btn-soft" id="toggle-key" aria-label="Mostrar u ocultar la API Key">👁️ Mostrar</button>
        </div>
      </label>
      <label class="field"><span>Modelo de IA</span>
        <input type="text" id="modelo" list="modelos" value="${esc(s.settings.modelo || DEFAULT_MODEL)}" autocapitalize="off" spellcheck="false">
        <datalist id="modelos">${MODELOS_SUGERIDOS.map((m) => `<option value="${m.id}">${esc(m.nombre)}</option>`).join('')}</datalist>
        <small class="hint">Recomendado: <code>${DEFAULT_MODEL}</code>. Si Google publica un modelo Flash más nuevo con visión, puedes escribir su nombre aquí.</small>
      </label>
      <div class="btn-row">
        <button class="btn btn-primary" id="btn-guardar-key">Guardar y validar</button>
        <button class="btn btn-ghost" id="btn-borrar-key">Quitar API Key</button>
      </div>
      <p class="key-status" id="key-status" aria-live="polite"></p>
      <details class="tips">
        <summary>¿Cómo consigo mi API Key gratis?</summary>
        <ol class="nice-list numbered">
          <li>Entra a <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">aistudio.google.com/apikey</a> con tu cuenta de Google (Gmail).</li>
          <li>Acepta los términos si es tu primera vez.</li>
          <li>Presiona <b>“Create API key”</b> (Crear clave de API).</li>
          <li>Copia la clave completa (empieza con <code>AQ.</code> o <code>AIza</code>).</li>
          <li>Pégala arriba y presiona <b>Guardar y validar</b>.</li>
        </ol>
        <p class="muted small">El nivel gratuito permite muchas consultas al día. Si ves un aviso de límite, espera un minuto o cambia a Flash-Lite.</p>
      </details>
    </div>

    <div class="card" data-tour="respaldo">
      <h3 class="section-title">💾 Respaldo de datos</h3>
      <p class="muted small">Toda tu información vive en este navegador. Exporta un respaldo de vez en cuando o para pasarla a otro teléfono.</p>
      <div class="storage-meter" id="storage-meter" aria-live="polite">
        <div class="storage-head"><b id="storage-usado">Calculando…</b><span id="storage-cuota"></span></div>
        <div class="bar"><span id="storage-bar"></span></div>
        <div class="storage-legend">
          <span><i class="sw-dot fotos"></i><span id="storage-fotos">Fotos</span></span>
          <span><i class="sw-dot texto"></i><span id="storage-texto">Textos y ajustes</span></span>
        </div>
        <small id="storage-text"></small>
        <button type="button" class="btn btn-sm btn-soft" id="btn-proteger">🛡️ Proteger mis datos en este dispositivo</button>
      </div>
      <ul class="stats-mini" id="stats-mini"></ul>
      <p class="callout small">🔐 Por seguridad, el respaldo <b>no incluye tu API Key</b> de Gemini: se queda solo en este dispositivo. Al importar un respaldo, tu clave actual se conserva.</p>
      <p class="muted small" id="ultimo-respaldo"></p>
      <div class="btn-row">
        <button class="btn btn-primary" id="btn-exportar">⬇️ Exportar respaldo (.json)</button>
        <label class="btn btn-soft">⬆️ Importar respaldo<input type="file" id="file-importar" accept="application/json,.json" hidden></label>
      </div>
    </div>

    <div class="card" id="boveda">
      <h3 class="section-title">🗄️ Copias internas (últimos ${MAX_COPIAS} días)</h3>
      <p class="muted small">Doble Bóveda: además de tus respaldos .json, la app guarda sola una copia al día dentro de este dispositivo, tomada la primera vez que la abres. Sirve para deshacer un error, aunque no hayas exportado nada. No incluye tu API Key y guarda las fotos en tamaño reducido para no ocupar espacio.</p>
      <ul class="boveda-lista" id="boveda-lista"><li class="muted small">Cargando copias…</li></ul>
    </div>

    <div class="card">
      <h3 class="section-title">📲 Instalar como app</h3>
      <div id="instalar"></div>
    </div>

    <div class="card">
      <h3 class="section-title">📖 Ayuda</h3>
      <div class="btn-row">
        <button class="btn btn-soft" id="btn-tour">🧭 Tour guiado (8 pasos)</button>
        <a class="btn btn-soft" href="#ayuda">❔ Preguntas frecuentes y ejemplos</a>
      </div>
    </div>

    <div class="card">
      <h3 class="section-title">🕘 Historial de análisis</h3>
      <div id="historial-resumen"></div>
    </div>

    <div class="card danger-zone">
      <h3 class="section-title">Zona delicada</h3>
      <p class="muted small">Borra todas tus fotos, diagnóstico, listas, armario, historial, copias internas y API Key de este dispositivo. No se puede deshacer.</p>
      <button class="btn btn-danger" id="btn-borrar-todo">Borrar todos mis datos</button>
    </div>

    <p class="muted small center footer-note">${APP_NAME} · v${esc(self.MIIMAGEN_VERSION || '')} · Hecho con 💖 · Tus datos nunca salen de tu dispositivo, excepto las consultas que tú envías a Google Gemini.</p>
  `;

  const inp = $('#api-key', el);
  $('#toggle-key', el).addEventListener('click', (e) => {
    const ver = inp.type === 'password';
    inp.type = ver ? 'text' : 'password';
    e.currentTarget.textContent = ver ? '🙈 Ocultar' : '👁️ Mostrar';
  });
  $('#btn-guardar-key', el).addEventListener('click', guardarKey);
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') guardarKey(); });
  $('#btn-borrar-key', el).addEventListener('click', quitarKey);
  $('#modelo', el).addEventListener('change', (e) => {
    const v = e.target.value.trim() || DEFAULT_MODEL;
    e.target.value = v;
    try { store.updateSettings({ modelo: v, apiKeyValidada: false }); pintarEstadoKey(); toast('Modelo actualizado. Presiona “Guardar y validar” para comprobarlo.'); } catch (err) { mostrarError(err); }
  });

  $('#btn-exportar', el).addEventListener('click', () => { try { exportarRespaldo(); } catch (e) { mostrarError(e); } });
  $('#file-importar', el).addEventListener('change', importar);
  $('#btn-tour', el).addEventListener('click', () => window.MiImagen.iniciarTour());
  $('#btn-borrar-todo', el).addEventListener('click', borrarTodo);
  $('#btn-proteger', el).addEventListener('click', proteger);
  if (!escuchando) { // la vista se vuelve a montar al importar/borrar: registrar una sola vez
    escuchando = true;
    document.addEventListener('mia:instalable', pintarInstalar);
    document.addEventListener('mia:respaldo', pintarUltimoRespaldo);
  }

  pintarEstadoKey();
  pintarDatos();
  pintarInstalar();
  pintarBoveda();
}

export function show() { pintarDatos(); pintarEstadoKey(); pintarBoveda(); }
export function onStore(part) {
  if (!root) return;
  if (part === 'all') { mount(root); return; }
  pintarDatos();
}

// ---------- Textos que describen exactamente qué hay ----------
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

function resumenActual() {
  const s = store.get();
  const partes = [];
  if (s.profile.selfie || s.profile.cuerpo || s.profile.ciudad) partes.push('tu perfil y fotos base');
  if (s.diagnostico) partes.push('tu diagnóstico de 4 Pilares');
  partes.push(plural(s.armario.length, 'prenda del armario', 'prendas del armario'));
  partes.push(plural(s.porComprar.length, 'artículo por comprar', 'artículos por comprar'));
  partes.push(plural(s.historial.length, 'análisis del historial', 'análisis del historial'));
  return partes.join(', ');
}

// ---------- API Key ----------
function pintarEstadoKey(msg, tipo) {
  const st = $('#key-status', root);
  const s = store.get();
  if (msg) { st.className = `key-status ${tipo}`; st.textContent = msg; return; }
  if (!s.apiKey) { st.className = 'key-status warn'; st.textContent = '⚠️ Aún no has configurado tu API Key.'; return; }
  st.className = `key-status ${s.settings.apiKeyValidada ? 'ok' : 'info'}`;
  st.textContent = s.settings.apiKeyValidada ? `✅ Conectada con ${s.settings.modelo}. ¡Todo listo!` : 'API Key guardada (sin validar).';
}

async function quitarKey() {
  const key = store.get().apiKey;
  if (!key) return;
  const ok = await mostrarDialogo({
    mensaje: `Se quitará de este dispositivo la API Key de Gemini que termina en “…${key.slice(-4)}”.\n\nLos análisis con IA dejarán de funcionar hasta que pegues una clave nueva. Tus datos no se tocan.`,
    textoConfirmar: 'Quitar API Key',
    peligro: true,
  });
  if (!ok) return;
  store.set('apiKey', '');
  store.updateSettings({ apiKeyValidada: false });
  $('#api-key', root).value = '';
  pintarEstadoKey();
}

async function guardarKey() {
  const key = $('#api-key', root).value.trim();
  const modelo = $('#modelo', root).value.trim() || DEFAULT_MODEL;
  const btn = $('#btn-guardar-key', root);
  btn.disabled = true;
  pintarEstadoKey('⏳ Validando con Google…', 'info');
  try {
    await validarApiKey(key, modelo);
    store.set('apiKey', key);
    store.updateSettings({ modelo, apiKeyValidada: true });
    pintarEstadoKey();
    toast('¡Conectada con Gemini! ✨', 'ok');
  } catch (e) {
    // Si el formato es correcto pero falló la red, la guardamos de todos modos.
    if (e.code === 'red' || e.code === 'offline' || e.code === 'timeout') {
      store.set('apiKey', key);
      store.updateSettings({ modelo, apiKeyValidada: false });
      pintarEstadoKey(`⚠️ Guardada, pero no se pudo validar: ${e.message}`, 'warn');
    } else {
      pintarEstadoKey(`❌ ${e.message}`, 'error');
    }
  } finally {
    btn.disabled = false;
  }
}

// ---------- Datos e historial ----------
function pintarDatos() {
  const s = store.get();
  pintarAlmacenamiento();
  pintarUltimoRespaldo();
  $('#stats-mini', root).innerHTML = `
    <li><b>${s.profile.selfie ? '✓' : '—'}</b><span>Selfie</span></li>
    <li><b>${s.diagnostico ? '✓' : '—'}</b><span>Diagnóstico</span></li>
    <li><b>${s.porComprar.length}</b><span>Por comprar</span></li>
    <li><b>${s.armario.length}</b><span>En armario</span></li>
    <li><b>${s.historial.length}</b><span>Análisis</span></li>`;

  const hist = s.historial.slice(0, 8);
  const tipos = { diagnostico: '🪞', compra: '🛍️', outfits: '👯‍♀️', estilos: '🎭' };
  $('#historial-resumen', root).innerHTML = hist.length ? `
    <ul class="history-list compact">${hist.map((x) => `<li><span class="thumb-ph">${tipos[x.tipo] || '✨'}</span><span><b>${esc(x.titulo)}</b><small>${esc(x.resumen || '')} · ${fechaCorta(x.fecha)}</small></span>${x.puntuacion ? `<span class="mini-score">${x.puntuacion}</span>` : ''}</li>`).join('')}</ul>
    <button class="btn btn-sm btn-ghost" id="btn-limpiar-hist">Limpiar historial</button>`
    : '<p class="muted small">Todavía no hay análisis guardados.</p>';
  $('#btn-limpiar-hist', root)?.addEventListener('click', limpiarHistorial);
}

async function limpiarHistorial() {
  const h = store.get().historial;
  const n = (t) => h.filter((x) => x.tipo === t).length;
  const detalle = [
    n('compra') && plural(n('compra'), 'evaluación de compra', 'evaluaciones de compra'),
    n('outfits') && plural(n('outfits'), 'grupo de outfits', 'grupos de outfits'),
    n('estilos') && plural(n('estilos'), 'exploración de estilos', 'exploraciones de estilos'),
    n('diagnostico') && plural(n('diagnostico'), 'registro de diagnóstico', 'registros de diagnóstico'),
  ].filter(Boolean).join(', ');
  const ok = await mostrarDialogo({
    mensaje: `Se borrarán ${plural(h.length, 'análisis guardado', 'análisis guardados')} del historial (${detalle}), con sus miniaturas.\n\nTu diagnóstico de 4 Pilares, tu armario y tu lista Por Comprar no se tocan.`,
    textoConfirmar: 'Limpiar historial',
    peligro: true,
  });
  if (!ok) return;
  store.set('historial', []);
  toast('Historial limpio ✓');
}

function pintarUltimoRespaldo() {
  const el = $('#ultimo-respaldo', root);
  if (!el) return;
  const { respaldo } = store.meta();
  el.textContent = respaldo
    ? `Último respaldo: ${new Date(respaldo).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · Se descarga como “${nombreArchivo()}”.`
    : `Aún no has descargado ningún respaldo. Se descarga como “${nombreArchivo()}”.`;
}

// ---------- Medidor de espacio (navigator.storage.estimate) ----------
function formatoBytes(b) {
  const n = Math.max(0, b || 0);
  const f = (v, d) => v.toLocaleString('es-MX', { maximumFractionDigits: d });
  if (n < 1024 * 1024) return `${f(n / 1024, 0)} KB`;
  if (n < 1024 ** 3) return `${f(n / 1024 / 1024, n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${f(n / 1024 ** 3, 1)} GB`;
}

let turnoMedidor = 0;
async function pintarAlmacenamiento() {
  const turno = ++turnoMedidor;
  const info = await store.infoAlmacenamiento();
  if (turno !== turnoMedidor || !root?.isConnected) return;
  const propio = info.fotos + info.texto;
  const meter = $('#storage-meter', root);
  const bar = $('#storage-bar', root);
  $('#storage-fotos', root).textContent = `Fotos (${info.nFotos}) · ${formatoBytes(info.fotos)}`;
  $('#storage-texto', root).textContent = `Textos y ajustes · ${formatoBytes(info.texto)}`;
  const tieneCuota = info.cuota !== null && info.usado !== null;
  meter.classList.toggle('sin-cuota', !tieneCuota);
  if (tieneCuota) {
    const pct = (info.usado / info.cuota) * 100;
    const libre = Math.max(0, info.cuota - info.usado);
    $('#storage-usado', root).textContent = `${formatoBytes(info.usado)} usados`;
    $('#storage-cuota', root).textContent = `${formatoBytes(libre)} disponibles`;
    bar.style.width = `${Math.max(1.5, Math.min(100, pct))}%`;
    bar.className = pct > 90 ? 'alto' : pct > 70 ? 'medio' : '';
    $('#storage-text', root).textContent = `${pct < 0.1 ? 'Menos del 0.1' : pct.toLocaleString('es-MX', { maximumFractionDigits: 1 })} % del espacio que el navegador reserva para MiImagenApp (${formatoBytes(info.cuota)} en total).`;
  } else {
    // El navegador no reporta su cuota: mostramos lo que ocupa la app con una barra decorativa.
    $('#storage-usado', root).textContent = `${formatoBytes(propio)} ocupados`;
    $('#storage-cuota', root).textContent = 'Espacio total no disponible';
    bar.style.width = '';
    bar.className = '';
    $('#storage-text', root).textContent = 'Tu navegador no informa cuánto espacio queda. Las fotos se guardan comprimidas (800 px) para ocupar lo mínimo.';
  }
  if (!info.indexedDB) {
    $('#storage-text', root).textContent += ' ⚠️ Este navegador no permite la base de datos de fotos: se guardan en el almacenamiento básico (máx. ~5 MB).';
  }
  // Botón "Proteger mis datos": siempre visible, indica si ya están protegidos.
  const btn = $('#btn-proteger', root);
  const soportado = !!navigator.storage?.persist;
  btn.hidden = !soportado;
  btn.disabled = info.persistente === true;
  btn.textContent = info.persistente === true ? '🛡️ Tus datos están protegidos en este dispositivo ✓' : '🛡️ Proteger mis datos en este dispositivo';
}

async function proteger() {
  const ok = await store.protegerAlmacenamiento();
  toast(ok ? 'Listo: el navegador no borrará tus datos para liberar espacio 🛡️' : 'Tu navegador no permitió la protección. Exporta respaldos con frecuencia.', ok ? 'ok' : 'warn', 5000);
  pintarAlmacenamiento();
}

// ---------- Importar / borrar ----------
async function importar(e) {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  try {
    const texto = await f.text();
    let json;
    try { json = JSON.parse(texto); } catch { throw new Error('El archivo no es un JSON válido.'); }
    const d = json.data && typeof json.data === 'object' ? json.data : json;
    const trae = [
      d.profile && 'perfil',
      d.diagnostico && 'diagnóstico',
      plural((d.armario || []).length, 'prenda', 'prendas'),
      plural((d.porComprar || []).length, 'artículo por comprar', 'artículos por comprar'),
      plural((d.historial || []).length, 'análisis', 'análisis'),
    ].filter(Boolean).join(', ');
    const ok = await mostrarDialogo({
      mensaje: `Se reemplazarán TODOS los datos actuales de este dispositivo (${resumenActual()}) por los del respaldo “${f.name}”${json.exportado ? ` del ${fechaCorta(json.exportado)}` : ''}, que trae: ${trae}.\n\nTu API Key se conserva. Si te equivocas, puedes volver al estado de hoy desde “Copias internas”.`,
      textoConfirmar: 'Reemplazar con el respaldo',
      peligro: true,
    });
    if (!ok) return;
    const fin = cargando(['Importando tu respaldo…', 'Guardando tus fotos…']);
    try {
      await store.importar(json);
    } finally { fin(); }
    toast('¡Respaldo importado con éxito! ✓', 'ok');
  } catch (err) { mostrarError(err); }
}

async function borrarTodo() {
  const ok = await mostrarDialogo({
    mensaje: `Se borrarán para siempre de este dispositivo: ${resumenActual()}, las copias internas de los últimos ${MAX_COPIAS} días y tu API Key de Gemini.\n\nNo se puede deshacer. Te recomendamos exportar un respaldo .json antes.`,
    textoConfirmar: 'Sí, borrar todo',
    peligro: true,
  });
  if (!ok) return;
  await store.borrarTodo();
  toast('Datos eliminados');
}

// ---------- Doble Bóveda ----------
let turnoBoveda = 0;
async function pintarBoveda() {
  const turno = ++turnoBoveda;
  const ul = $('#boveda-lista', root);
  if (!ul) return;
  if (!store.usaIndexedDB()) {
    ul.innerHTML = '<li class="muted small">Este navegador no permite la base de datos interna, así que no hay copias automáticas. Exporta respaldos .json con frecuencia.</li>';
    return;
  }
  let copias = [];
  try { copias = await listarCopias(); } catch (e) { console.warn(e); }
  if (turno !== turnoBoveda || !ul.isConnected) return;
  if (!copias.length) {
    ul.innerHTML = '<li class="muted small">Todavía no hay copias. La primera se crea sola en cuanto tengas datos y abras la app.</li>';
    return;
  }
  const hoy = fechaLocal();
  ul.innerHTML = copias.map((c) => {
    const [a, m, d] = c.fecha.split('-').map(Number);
    const texto = new Date(a, m - 1, d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
    const dia = texto.charAt(0).toUpperCase() + texto.slice(1); // "Martes 24 de nov"
    const hora = c.creada ? new Date(c.creada).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '';
    const r = c.resumen || {};
    const det = [
      plural(r.prendas || 0, 'prenda', 'prendas'),
      plural(r.porComprar || 0, 'por comprar', 'por comprar'),
      r.diagnostico ? `diagnóstico${r.estacion ? ` (${r.estacion})` : ''}` : 'sin diagnóstico',
      formatoBytes(c.tamano),
    ].join(' · ');
    return `<li>
      <span class="boveda-info"><b>${c.fecha === hoy ? 'Hoy · ' : ''}${esc(dia)}</b><small>Tomada a las ${esc(hora)} · ${esc(det)}</small></span>
      <button type="button" class="btn btn-sm btn-soft" data-fecha="${esc(c.fecha)}" data-dia="${esc(dia)}">Restaurar</button>
    </li>`;
  }).join('');
  ul.querySelectorAll('[data-fecha]').forEach((b) => b.addEventListener('click', () => restaurar(b.dataset.fecha, b.dataset.dia)));
}

async function restaurar(fecha, diaTitulo) {
  const dia = diaTitulo.charAt(0).toLowerCase() + diaTitulo.slice(1); // va a mitad de frase
  const copia = (await listarCopias()).find((c) => c.fecha === fecha);
  if (!copia) { toast('Esa copia ya no existe.', 'warn'); pintarBoveda(); return; }
  const r = copia.resumen || {};
  const ok = await mostrarDialogo({
    mensaje: `Se reemplazarán tus datos actuales (${resumenActual()}) por la copia interna del ${dia}, que tiene ${plural(r.prendas || 0, 'prenda', 'prendas')}, ${plural(r.porComprar || 0, 'artículo por comprar', 'artículos por comprar')} y ${r.diagnostico ? 'tu diagnóstico' : 'ningún diagnóstico'}.\n\nSe perderán los cambios hechos después de esa copia. Tu API Key se conserva. Las fotos que ya no estén en el dispositivo se recuperarán en tamaño reducido.`,
    textoConfirmar: 'Restaurar esta copia',
    peligro: true,
  });
  if (!ok) return;
  const fin = cargando(['Restaurando tu copia interna…', 'Recuperando tus fotos…']);
  try {
    const { reducidas } = await restaurarCopia(fecha);
    toast(`Copia del ${dia} restaurada ✓${reducidas ? ` (${plural(reducidas, 'foto recuperada', 'fotos recuperadas')} en tamaño reducido)` : ''}`, 'ok', 6000);
  } catch (e) {
    mostrarError(e);
  } finally { fin(); }
}

// ---------- Instalación ----------
function pintarInstalar() {
  const cont = $('#instalar', root);
  if (!cont) return;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const prompt = window.MiImagen?.instalacion?.prompt;
  if (standalone) {
    cont.innerHTML = '<p class="muted small">✅ Ya estás usando MiImagenApp instalada. ¡Perfecto!</p>';
  } else if (prompt) {
    cont.innerHTML = '<p class="muted small">Instálala en tu pantalla de inicio para abrirla como cualquier app, incluso sin internet.</p><button class="btn btn-primary" id="btn-instalar">📲 Instalar MiImagenApp</button>';
    $('#btn-instalar', cont).addEventListener('click', async () => {
      prompt.prompt();
      try { await prompt.userChoice; } catch { /* */ }
      window.MiImagen.instalacion.prompt = null;
      pintarInstalar();
    });
  } else if (ios) {
    cont.innerHTML = `<ol class="nice-list numbered small">
      <li>Abre esta página en <b>Safari</b>.</li>
      <li>Toca el botón <b>Compartir</b> (cuadro con flecha ↑).</li>
      <li>Elige <b>“Agregar a pantalla de inicio”</b> y confirma.</li></ol>`;
  } else {
    cont.innerHTML = `<ol class="nice-list numbered small">
      <li>En Android, abre el menú <b>⋮</b> de Chrome.</li>
      <li>Toca <b>“Instalar app”</b> o <b>“Agregar a pantalla principal”</b>.</li>
      <li>En computadora, busca el ícono de instalar en la barra de direcciones.</li></ol>`;
  }
}
