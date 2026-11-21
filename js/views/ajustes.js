// Ajustes: API Key de Gemini, modelo, respaldos, almacenamiento e instalación.
import { store } from '../store.js';
import { MODELOS_SUGERIDOS, DEFAULT_MODEL, APP_NAME } from '../constants.js';
import { validarApiKey } from '../gemini.js';
import { $, $$, esc, toast, mostrarError, confirmar, descargar, fechaCorta } from '../ui.js';

let root;
const LIMITE_CARACTERES = 5 * 1024 * 1024; // ~5 millones de caracteres (límite típico de localStorage)

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
      <div class="storage-meter"><div class="bar"><span id="storage-bar"></span></div><small id="storage-text"></small></div>
      <ul class="stats-mini" id="stats-mini"></ul>
      <label class="switch"><input type="checkbox" id="incluir-key"><span></span> Incluir mi API Key en el respaldo</label>
      <div class="btn-row">
        <button class="btn btn-primary" id="btn-exportar">⬇️ Exportar respaldo (.json)</button>
        <label class="btn btn-soft">⬆️ Importar respaldo<input type="file" id="file-importar" accept="application/json,.json" hidden></label>
      </div>
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
      <p class="muted small">Borra todas tus fotos, diagnóstico, listas, armario e historial de este dispositivo. No se puede deshacer.</p>
      <button class="btn btn-danger" id="btn-borrar-todo">Borrar todos mis datos</button>
    </div>

    <p class="muted small center footer-note">${APP_NAME} · Hecho con 💖 · Tus datos nunca salen de tu dispositivo, excepto las consultas que tú envías a Google Gemini.</p>
  `;

  const inp = $('#api-key', el);
  $('#toggle-key', el).addEventListener('click', (e) => {
    const ver = inp.type === 'password';
    inp.type = ver ? 'text' : 'password';
    e.currentTarget.textContent = ver ? '🙈 Ocultar' : '👁️ Mostrar';
  });
  $('#btn-guardar-key', el).addEventListener('click', guardarKey);
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') guardarKey(); });
  $('#btn-borrar-key', el).addEventListener('click', async () => {
    if (!store.get().apiKey) return;
    if (await confirmar({ titulo: 'Quitar API Key', texto: 'La IA dejará de funcionar hasta que pegues una nueva clave.', ok: 'Quitar', peligro: true })) {
      store.set('apiKey', '');
      store.updateSettings({ apiKeyValidada: false });
      inp.value = '';
      pintarEstadoKey();
    }
  });
  $('#modelo', el).addEventListener('change', (e) => {
    const v = e.target.value.trim() || DEFAULT_MODEL;
    e.target.value = v;
    try { store.updateSettings({ modelo: v, apiKeyValidada: false }); pintarEstadoKey(); toast('Modelo actualizado. Presiona “Guardar y validar” para comprobarlo.'); } catch (err) { mostrarError(err); }
  });

  $('#btn-exportar', el).addEventListener('click', exportar);
  $('#file-importar', el).addEventListener('change', importar);
  $('#btn-tour', el).addEventListener('click', () => window.MiImagen.iniciarTour());
  $('#btn-borrar-todo', el).addEventListener('click', borrarTodo);
  document.addEventListener('mia:instalable', pintarInstalar);

  pintarEstadoKey();
  pintarDatos();
  pintarInstalar();
}

export function show() { pintarDatos(); pintarEstadoKey(); }
export function onStore(part) {
  if (!root) return;
  if (part === 'all') { mount(root); return; }
  pintarDatos();
}

function pintarEstadoKey(msg, tipo) {
  const st = $('#key-status', root);
  const s = store.get();
  if (msg) { st.className = `key-status ${tipo}`; st.textContent = msg; return; }
  if (!s.apiKey) { st.className = 'key-status warn'; st.textContent = '⚠️ Aún no has configurado tu API Key.'; return; }
  st.className = `key-status ${s.settings.apiKeyValidada ? 'ok' : 'info'}`;
  st.textContent = s.settings.apiKeyValidada ? `✅ Conectada con ${s.settings.modelo}. ¡Todo listo!` : 'API Key guardada (sin validar).';
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

function pintarDatos() {
  const s = store.get();
  const uso = store.usoAlmacenamiento();
  const pct = Math.min(100, Math.round((uso / LIMITE_CARACTERES) * 100));
  $('#storage-bar', root).style.width = pct + '%';
  $('#storage-bar', root).className = pct > 85 ? 'alto' : pct > 60 ? 'medio' : '';
  $('#storage-text', root).textContent = `Espacio usado: ${(uso / 1024 / 1024).toFixed(2)} MB de ~5 MB (${pct}%) · Las fotos se comprimen a 800 px automáticamente.`;
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
  $('#btn-limpiar-hist', root)?.addEventListener('click', async () => {
    if (await confirmar({ titulo: 'Limpiar historial', texto: 'Se borrarán las evaluaciones y outfits guardados (tu diagnóstico, listas y armario se conservan).', ok: 'Limpiar', peligro: true })) {
      store.set('historial', []);
      toast('Historial limpio ✓');
    }
  });
}

function exportar() {
  try {
    const incluir = $('#incluir-key', root).checked;
    const data = store.exportar({ incluirApiKey: incluir });
    const fecha = new Date().toISOString().slice(0, 10);
    descargar(`MiImagenApp-respaldo-${fecha}.json`, JSON.stringify(data, null, 2));
    toast('Respaldo descargado ✓', 'ok');
  } catch (e) { mostrarError(e); }
}

async function importar(e) {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  try {
    const texto = await f.text();
    let json;
    try { json = JSON.parse(texto); } catch { throw new Error('El archivo no es un JSON válido.'); }
    const d = json.data || json;
    const resumen = `Perfil${d.diagnostico ? ', diagnóstico' : ''}, ${(d.armario || []).length} artículos de armario y ${(d.porComprar || []).length} por comprar.`;
    const ok = await confirmar({
      titulo: 'Importar respaldo',
      texto: `Este respaldo${json.exportado ? ` del ${fechaCorta(json.exportado)}` : ''} contiene: ${resumen} Reemplazará los datos actuales de este dispositivo.`,
      ok: 'Importar',
    });
    if (!ok) return;
    store.importar(json);
    toast('¡Respaldo importado con éxito! ✓', 'ok');
  } catch (err) { mostrarError(err); }
}

async function borrarTodo() {
  const ok = await confirmar({ titulo: '¿Borrar todo?', texto: 'Se eliminarán tus fotos, diagnóstico, lista Por Comprar, armario, historial y API Key. Te recomendamos exportar un respaldo antes.', ok: 'Sí, borrar todo', peligro: true });
  if (!ok) return;
  store.borrarTodo();
  toast('Datos eliminados');
}

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
