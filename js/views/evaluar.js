// Evaluador inteligente de compras: "¿Me queda bien?"
import { store } from '../store.js';
import { evaluarCompra } from '../gemini.js';
import { thumbnail } from '../image.js';
import { preseleccionarNueva } from './estilos.js';
import { nombreOcasion, nombreCategoria } from '../constants.js';
import {
  $, $$, h, esc, toast, mostrarError, cargando, photoPicker, chipGroup, scoreRing,
  opcionesOcasion, opcionesCategoria, safeUrl, fechaCorta, abrirModal, colorDot,
} from '../ui.js';

let root;
const vacio = () => ({ foto: '', url: '', descripcion: '', precio: '', ocasion: 'casual', categoria: '' });
let form = vacio();
let resultado = null; // { res, form, agregado }

export function mount(el) {
  root = el;
  el.innerHTML = `
    <div class="view-head">
      <p class="eyebrow">Evaluador inteligente</p>
      <h2 class="display">¿Me queda bien?</h2>
      <p class="lead">Antes de comprar, pregúntale a tu asesora. Sube una foto o pega el enlace de la tienda y Gemini lo cruza con tus colores, tu silueta, tu clima y tu armario.</p>
    </div>
    <div class="card" id="eval-form" data-tour="evaluar">
      <div class="eval-grid">
        <div>
          <label class="field-label">Foto de la prenda, accesorio o maquillaje</label>
          <div id="pick-articulo"></div>
        </div>
        <div class="eval-fields">
          <label class="field"><span>Enlace de la tienda en línea (opcional)</span>
            <input type="url" name="url" inputmode="url" placeholder="https://tienda.com/vestido-lino"></label>
          <label class="field"><span>Descripción breve</span>
            <textarea name="descripcion" rows="2" placeholder="Ej. Vestido midi de lino color terracota, escote en V"></textarea></label>
          <div class="grid-2">
            <label class="field"><span>Precio (opcional)</span><input type="text" name="precio" inputmode="decimal" placeholder="Ej. $899 MXN"></label>
            <label class="field"><span>Categoría</span>
              <select name="categoria"><option value="">✨ Que la IA la detecte</option>
              ${opcionesCategoria().map((c) => `<option value="${c.id}">${c.icono} ${c.nombre}</option>`).join('')}</select></label>
          </div>
        </div>
      </div>
      <label class="field-label">¿Para qué ocasión o estilo?</label>
      <div id="chips-ocasion"></div>
      <button class="btn btn-primary btn-lg btn-block" id="btn-evaluar">💫 ¿Me queda bien? Analizar</button>
      <p class="hint center" id="eval-hint"></p>
    </div>
    <div id="eval-resultado"></div>
    <div id="eval-historial"></div>
  `;
  const picker = photoPicker({
    valor: form.foto, etiqueta: 'Toma o sube la foto', camara: 'environment', aspecto: '1/1',
    ayuda: 'También sirve una captura de pantalla',
    onChange: (v) => { form.foto = v; },
  });
  $('#pick-articulo', el).appendChild(picker);
  const chips = chipGroup({ opciones: opcionesOcasion(), seleccion: form.ocasion, onChange: (v) => { form.ocasion = v; }, clase: 'chips-wrap' });
  $('#chips-ocasion', el).appendChild(chips);

  ['url', 'descripcion', 'precio', 'categoria'].forEach((n) => {
    const inp = $(`[name="${n}"]`, el);
    inp.value = form[n] || '';
    inp.addEventListener('input', () => { form[n] = inp.value.trim(); });
  });
  $('#btn-evaluar', el).addEventListener('click', analizar);

  el._reset = () => {
    form = vacio();
    picker.setValue('');
    chips.setValue('casual');
    ['url', 'descripcion', 'precio', 'categoria'].forEach((n) => { $(`[name="${n}"]`, el).value = ''; });
  };
  renderTodo();
}

export function show() { renderTodo(); }

export function onStore(part, visible) {
  if (part === 'all' && root) { resultado = null; form = vacio(); mount(root); return; }
  if (visible && ['historial', 'armario', 'diagnostico', 'apiKey'].includes(part)) renderTodo();
}

function renderTodo() {
  const { diagnostico, apiKey } = store.get();
  const hint = $('#eval-hint', root);
  hint.innerHTML = !apiKey
    ? '⚠️ Configura tu API Key en <a href="#ajustes">Ajustes</a> para evaluar.'
    : !diagnostico
      ? '💡 Tip: haz primero tu <a href="#perfil">diagnóstico de 4 Pilares</a> para evaluaciones más precisas.'
      : '';
  renderResultado();
  renderHistorial();
}

async function analizar() {
  if (!form.foto && !form.url && !form.descripcion) {
    toast('Agrega una foto, un enlace o una descripción del artículo.', 'warn');
    return;
  }
  if (form.url && !safeUrl(form.url)) {
    toast('El enlace no parece válido. Debe empezar con https://', 'warn');
    return;
  }
  const fin = cargando([
    'Revisando el color contra tu paleta…',
    'Analizando el corte y tu silueta…',
    form.url ? 'Leyendo la página de la tienda…' : 'Pensando en tu clima…',
    'Buscando combinaciones en tu armario…',
    'Preparando tu veredicto…',
  ]);
  try {
    const res = await evaluarCompra(form);
    resultado = { res, form: { ...form }, agregado: false };
    let thumb = '';
    if (form.foto) { try { thumb = await thumbnail(form.foto); } catch { /* */ } }
    const { foto, ...formSinFoto } = form;
    store.addHistorial({ tipo: 'compra', titulo: res.nombre || 'Artículo evaluado', resumen: res.veredicto || '', puntuacion: res.puntuacion, thumb, resultado: res, form: formSinFoto });
    renderResultado();
    setTimeout(() => $('#eval-resultado', root)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  } catch (e) {
    mostrarError(e, 'evaluar');
  } finally {
    fin();
  }
}

/** HTML del veredicto reutilizable (también en Por Comprar). */
export function veredictoHTML(r, { ocasion } = {}) {
  const { armario } = store.get();
  const combina = (r.combinaCon || []).map((c) => ({ ...c, item: armario.find((a) => a.id === c.id) })).filter((c) => c.item);
  return `
    <div class="verdict-head">
      ${scoreRing(r.puntuacion)}
      <div>
        <p class="eyebrow">${esc(nombreCategoria(r.categoria) || 'Artículo')}${ocasion ? ' · ' + esc(nombreOcasion(ocasion)) : ''}</p>
        <h3>${esc(r.nombre || 'Tu artículo')}</h3>
        <span class="verdict-tag v-${r.puntuacion >= 8 ? 'alto' : r.puntuacion >= 6 ? 'medio' : 'bajo'}">${esc(r.veredicto || '')}</span>
      </div>
    </div>
    ${r.resumen ? `<p class="verdict-sum">${esc(r.resumen)}</p>` : ''}
    <div class="info-grid">
      ${r.colorimetria ? `<div class="info-block"><h5>🎨 Colorimetría</h5><p>${esc(r.colorimetria)}</p></div>` : ''}
      ${r.corte ? `<div class="info-block"><h5>✂️ Corte y visagismo</h5><p>${esc(r.corte)}</p></div>` : ''}
      ${r.maquillaje ? `<div class="info-block"><h5>💄 Maquillaje para usarlo</h5><p>${esc(r.maquillaje)}</p></div>` : ''}
      ${r.accesorios ? `<div class="info-block"><h5>👜 Accesorios y calzado</h5><p>${esc(r.accesorios)}</p></div>` : ''}
      ${r.consejoClima ? `<div class="info-block"><h5>🌦️ En tu clima</h5><p>${esc(r.consejoClima)}</p></div>` : ''}
      ${r.alternativa ? `<div class="info-block avoid"><h5>🔁 Mejor busca</h5><p>${esc(r.alternativa)}</p></div>` : ''}
    </div>
    <h4 class="sub">Combina con tu armario</h4>
    ${combina.length ? `<div class="match-row">${combina.map((c) => `
      <div class="match">
        ${c.item.foto ? `<img src="${c.item.foto}" alt="">` : `<div class="match-ph">${colorDot(c.item.color, { tam: 28 })}</div>`}
        <b>${esc(c.item.nombre)}</b><small>${esc(c.porque)}</small>
      </div>`).join('')}</div>`
      : `<p class="muted small">${armario.length ? 'No encontré combinaciones claras en tu armario actual.' : 'Tu armario está vacío. Registra tus prendas en <a href="#armario">Mi Armario</a> para ver combinaciones.'}</p>`}
  `;
}

function renderResultado() {
  const cont = $('#eval-resultado', root);
  if (!resultado) { cont.innerHTML = ''; return; }
  const { res, form: f } = resultado;
  cont.innerHTML = `
    <div class="card verdict-card">
      <div class="verdict-photo-wrap">${f.foto ? `<img class="verdict-photo" src="${f.foto}" alt="Artículo evaluado">` : ''}</div>
      ${veredictoHTML(res, { ocasion: f.ocasion })}
      ${safeUrl(f.url) ? `<p><a href="${esc(safeUrl(f.url))}" target="_blank" rel="noopener noreferrer">🔗 Ver en la tienda</a></p>` : ''}
      <div class="btn-row">
        <button class="btn btn-primary" data-a="comprar" ${resultado.agregado ? 'disabled' : ''}>${resultado.agregado ? '✓ En tu lista' : '🏷️ Agregar a Por Comprar'}</button>
        <button class="btn btn-soft" data-a="armario" ${resultado.agregado ? 'disabled' : ''}>👗 Ya lo tengo: a Mi Armario</button>
        <button class="btn btn-soft" data-a="estilos">🎭 Verla en los 7 estilos</button>
        <button class="btn btn-ghost" data-a="nueva">Nueva evaluación</button>
      </div>
    </div>`;
  $$('[data-a]', cont).forEach((b) => b.addEventListener('click', () => accion(b.dataset.a)));
}

function itemDesdeResultado() {
  const { res, form: f } = resultado;
  const ocasiones = [...new Set([f.ocasion, ...(res.ocasiones || [])])].filter(Boolean);
  return {
    foto: f.foto,
    nombre: res.nombre || f.descripcion || 'Artículo',
    descripcion: f.descripcion,
    categoria: res.categoria || f.categoria || 'tops',
    color: res.color || 'multicolor',
    ocasiones,
    url: safeUrl(f.url),
    precio: f.precio || res.precioEstimado || '',
    puntuacion: res.puntuacion,
    veredicto: { ...res, ocasionEvaluada: f.ocasion },
  };
}

function accion(a) {
  if (a === 'nueva') {
    resultado = null;
    root._reset();
    renderResultado();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  if (a === 'estilos') {
    const { res, form: f } = resultado;
    preseleccionarNueva({ foto: f.foto, nombre: res.nombre || f.descripcion, categoria: res.categoria || f.categoria, descripcion: f.descripcion });
    window.MiImagen.irA('estilos');
    return;
  }
  try {
    if (a === 'comprar') {
      store.addPorComprar(itemDesdeResultado());
      toast('Agregado a tu lista Por Comprar 🏷️', 'ok');
    } else if (a === 'armario') {
      store.addArmario({ ...itemDesdeResultado(), origen: 'inventario' });
      toast('Agregado a Mi Armario 👗', 'ok');
    }
    resultado.agregado = true;
    renderResultado();
  } catch (e) { mostrarError(e); }
}

function renderHistorial() {
  const cont = $('#eval-historial', root);
  const items = store.get().historial.filter((x) => x.tipo === 'compra').slice(0, 15);
  if (!items.length) { cont.innerHTML = ''; return; }
  cont.innerHTML = `
    <details class="card history">
      <summary>🕘 Evaluaciones recientes (${items.length})</summary>
      <ul class="history-list">
        ${items.map((x) => `<li><button type="button" data-id="${esc(x.id)}">
          ${x.thumb ? `<img src="${x.thumb}" alt="">` : '<span class="thumb-ph">🛍️</span>'}
          <span><b>${esc(x.titulo)}</b><small>${esc(nombreOcasion(x.form?.ocasion))} · ${fechaCorta(x.fecha)}</small></span>
          <span class="mini-score">${esc(x.puntuacion ?? '')}</span>
        </button></li>`).join('')}
      </ul>
    </details>`;
  $$('[data-id]', cont).forEach((b) => b.addEventListener('click', () => {
    const x = items.find((i) => i.id === b.dataset.id);
    if (!x?.resultado) return;
    abrirModal({
      titulo: 'Evaluación guardada',
      contenido: `<div class="verdict-card">${x.thumb ? `<img class="verdict-photo small" src="${x.thumb}" alt="">` : ''}${veredictoHTML(x.resultado, { ocasion: x.form?.ocasion })}</div>`,
    });
  }));
}
