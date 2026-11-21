// Utilidades de interfaz reutilizables.
import { compressImage, approxKB } from './image.js';
import { COLORES, OCASIONES, CATEGORIAS, byId } from './constants.js';
import { QuotaError } from './store.js';
import { GeminiError } from './gemini.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function safeUrl(u) {
  try {
    const url = new URL(u);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

export function fechaCorta(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
}

// ---------- Toasts ----------
export function toast(msg, tipo = 'info', ms = 3500) {
  const cont = $('#toasts');
  const el = h(`<div class="toast toast-${tipo}" role="status">${esc(msg)}</div>`);
  cont.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, ms);
}

/** Muestra errores de forma amable según su tipo. */
export function mostrarError(e, contexto = '') {
  console.error(contexto, e);
  if (e instanceof QuotaError) return toast(e.message, 'error', 6000);
  if (e instanceof GeminiError) {
    if (e.code === 'sin_key') {
      return confirmar({
        titulo: 'Falta tu API Key',
        texto: 'Para usar el análisis con IA necesitas pegar tu API Key gratuita de Google AI Studio en Ajustes. Solo toma 2 minutos.',
        ok: 'Ir a Ajustes',
        cancelar: 'Ahora no',
      }).then((ok) => { if (ok) location.hash = '#ajustes'; });
    }
    return toast(e.message, 'error', 7000);
  }
  toast(e?.message || 'Ocurrió un error inesperado.', 'error', 6000);
}

// ---------- Modal / hoja inferior ----------
let modalStack = [];

export function abrirModal({ titulo = '', contenido, clase = '', onClose } = {}) {
  const root = $('#modal-root');
  const el = h(`
    <div class="modal-backdrop ${clase}">
      <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
        <div class="modal-head">
          <h3>${esc(titulo)}</h3>
          <button class="icon-btn modal-close" aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-body"></div>
      </div>
    </div>`);
  const body = $('.modal-body', el);
  if (typeof contenido === 'string') body.innerHTML = contenido;
  else if (contenido) body.appendChild(contenido);
  const cerrar = () => {
    el.classList.remove('open');
    modalStack = modalStack.filter((m) => m !== api);
    document.body.classList.toggle('modal-open', modalStack.length > 0);
    setTimeout(() => el.remove(), 250);
    onClose && onClose();
  };
  el.addEventListener('click', (ev) => { if (ev.target === el) cerrar(); });
  $('.modal-close', el).addEventListener('click', cerrar);
  root.appendChild(el);
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => el.classList.add('open'));
  const api = { el, body, cerrar };
  modalStack.push(api);
  return api;
}

export function cerrarModales() {
  [...modalStack].reverse().forEach((m) => m.cerrar());
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalStack.length) modalStack[modalStack.length - 1].cerrar();
});

export function confirmar({ titulo = '¿Estás segura?', texto = '', ok = 'Aceptar', cancelar = 'Cancelar', peligro = false } = {}) {
  return new Promise((resolve) => {
    let resuelto = false;
    const cont = h(`<div>
      <p class="muted">${esc(texto)}</p>
      <div class="btn-row end">
        <button class="btn btn-ghost" data-r="0">${esc(cancelar)}</button>
        <button class="btn ${peligro ? 'btn-danger' : 'btn-primary'}" data-r="1">${esc(ok)}</button>
      </div></div>`);
    const m = abrirModal({ titulo, contenido: cont, clase: 'modal-sm', onClose: () => { if (!resuelto) resolve(false); } });
    $$('[data-r]', cont).forEach((b) => b.addEventListener('click', () => {
      resuelto = true;
      resolve(b.dataset.r === '1');
      m.cerrar();
    }));
  });
}

// ---------- Cargando con mensajes ----------
export function cargando(mensajes = ['Analizando con Gemini IA…']) {
  const el = h(`<div class="loader-overlay" role="alert" aria-busy="true">
    <div class="loader-card">
      <div class="loader-mirror"><span></span></div>
      <p class="loader-msg">${esc(mensajes[0])}</p>
      <p class="loader-sub">Esto puede tardar entre 10 y 40 segundos.</p>
    </div></div>`);
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('open'));
  let i = 0;
  const iv = setInterval(() => {
    i = (i + 1) % mensajes.length;
    const msg = $('.loader-msg', el);
    msg.classList.add('fade');
    setTimeout(() => { msg.textContent = mensajes[i]; msg.classList.remove('fade'); }, 250);
  }, 3200);
  return () => {
    clearInterval(iv);
    el.classList.remove('open');
    setTimeout(() => el.remove(), 250);
  };
}

// ---------- Selector de foto con compresión automática ----------
/**
 * Crea un componente de foto con botones Cámara / Galería.
 * @param {{valor?:string, onChange:(dataUrl:string)=>void, etiqueta?:string, camara?:'user'|'environment', aspecto?:string, quitar?:boolean}} o
 */
export function photoPicker({ valor = '', onChange, etiqueta = 'Agregar foto', camara = 'environment', aspecto = '3/4', quitar = true, ayuda = '' }) {
  const el = h(`<div class="photo-picker" style="--aspect:${aspecto}">
      <div class="photo-preview">
        <img alt="" hidden>
        <div class="photo-empty"><span class="photo-icon">📷</span><span>${esc(etiqueta)}</span>${ayuda ? `<small>${esc(ayuda)}</small>` : ''}</div>
        <span class="photo-size" hidden></span>
      </div>
      <div class="photo-actions">
        <label class="btn btn-sm btn-soft">📸 Cámara<input type="file" accept="image/*" capture="${camara}" hidden></label>
        <label class="btn btn-sm btn-soft">🖼️ Galería<input type="file" accept="image/*" hidden></label>
        ${quitar ? '<button type="button" class="btn btn-sm btn-ghost photo-remove" hidden>Quitar</button>' : ''}
      </div>
    </div>`);
  const img = $('img', el);
  const empty = $('.photo-empty', el);
  const size = $('.photo-size', el);
  const rm = $('.photo-remove', el);
  const pintar = (v) => {
    img.hidden = !v;
    empty.hidden = !!v;
    if (rm) rm.hidden = !v;
    size.hidden = !v;
    if (v) { img.src = v; size.textContent = `${approxKB(v)} KB`; }
    else img.removeAttribute('src');
  };
  pintar(valor);
  $$('input[type=file]', el).forEach((inp) => inp.addEventListener('change', async () => {
    const f = inp.files?.[0];
    inp.value = '';
    if (!f) return;
    el.classList.add('busy');
    try {
      const data = await compressImage(f);
      pintar(data);
      onChange && (await onChange(data));
    } catch (e) {
      mostrarError(e);
      pintar(valor);
    } finally {
      el.classList.remove('busy');
    }
  }));
  rm && rm.addEventListener('click', () => { pintar(''); onChange && onChange(''); });
  el.setValue = (v) => { valor = v; pintar(v); };
  return el;
}

// ---------- Chips y círculos de color ----------
export function colorDot(colorId, { tam = 22, titulo = true } = {}) {
  const c = byId(COLORES, colorId);
  const css = c ? c.css : '#ccc';
  return `<span class="color-dot" style="--c:${esc(css)};--s:${tam}px" ${titulo && c ? `title="${esc(c.nombre)}"` : ''}></span>`;
}

export function swatch(hex, nombre = '', extra = '') {
  const safe = /^#[0-9a-fA-F]{3,8}$/.test(hex || '') ? hex : '#cccccc';
  return `<div class="swatch ${extra}" title="${esc(nombre)} ${esc(safe)}"><span style="background:${safe}"></span><small>${esc(nombre)}</small><code>${esc(safe.toUpperCase())}</code></div>`;
}

/** Grupo de chips seleccionables. multiple=true para varias opciones. */
export function chipGroup({ opciones, seleccion = [], multiple = false, onChange, clase = '' }) {
  const sel = new Set(Array.isArray(seleccion) ? seleccion : [seleccion].filter(Boolean));
  const el = h(`<div class="chips ${clase}" role="${multiple ? 'group' : 'radiogroup'}"></div>`);
  opciones.forEach((o) => {
    const b = h(`<button type="button" class="chip" data-id="${esc(o.id)}" aria-pressed="${sel.has(o.id)}">${o.icono ? `<span>${o.icono}</span> ` : ''}${esc(o.nombre)}</button>`);
    b.addEventListener('click', () => {
      if (multiple) {
        sel.has(o.id) ? sel.delete(o.id) : sel.add(o.id);
      } else {
        sel.clear();
        sel.add(o.id);
      }
      $$('.chip', el).forEach((c) => c.setAttribute('aria-pressed', sel.has(c.dataset.id)));
      onChange && onChange(multiple ? [...sel] : o.id);
    });
    el.appendChild(b);
  });
  el.setValue = (v) => {
    sel.clear();
    (Array.isArray(v) ? v : [v]).filter(Boolean).forEach((x) => sel.add(x));
    $$('.chip', el).forEach((c) => c.setAttribute('aria-pressed', sel.has(c.dataset.id)));
  };
  return el;
}

export function selectColor({ valor = '', onChange }) {
  const el = h('<div class="color-picker"></div>');
  COLORES.forEach((c) => {
    const b = h(`<button type="button" class="color-opt" data-id="${c.id}" aria-pressed="${c.id === valor}" title="${esc(c.nombre)}">${colorDot(c.id, { tam: 28, titulo: false })}<small>${esc(c.nombre)}</small></button>`);
    b.addEventListener('click', () => {
      valor = c.id;
      $$('.color-opt', el).forEach((x) => x.setAttribute('aria-pressed', x.dataset.id === valor));
      onChange && onChange(valor);
    });
    el.appendChild(b);
  });
  el.setValue = (v) => { valor = v; $$('.color-opt', el).forEach((x) => x.setAttribute('aria-pressed', x.dataset.id === v)); };
  return el;
}

export const opcionesOcasion = () => OCASIONES.map((o) => ({ id: o.id, nombre: o.nombre, icono: o.icono }));
export const opcionesCategoria = () => CATEGORIAS.map((o) => ({ id: o.id, nombre: o.nombre, icono: o.icono }));

export function scoreRing(p) {
  const n = Math.max(0, Math.min(10, +p || 0));
  const tono = n >= 8 ? 'alto' : n >= 6 ? 'medio' : 'bajo';
  return `<div class="score-ring score-${tono}" style="--p:${n * 10}"><span>${n}</span><small>/10</small></div>`;
}

export function lista(items) {
  if (!Array.isArray(items) || !items.length) return '';
  return `<ul class="nice-list">${items.map((i) => `<li>${esc(typeof i === 'string' ? i : JSON.stringify(i))}</li>`).join('')}</ul>`;
}

export function descargar(nombre, contenido, tipo = 'application/json') {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
