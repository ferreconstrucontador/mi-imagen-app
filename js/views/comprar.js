// Lista "Por Comprar".
import { store } from '../store.js';
import { nombreCategoria } from '../constants.js';
import { veredictoHTML } from './evaluar.js';
import { $, $$, h, esc, toast, mostrarError, abrirModal, confirmar, safeUrl, fechaCorta, colorDot } from '../ui.js';

let root;
let orden = 'fecha';

export function mount(el) {
  root = el;
  render();
}
export function show() { render(); }
export function onStore(part, visible) {
  if (visible && ['porComprar', 'all', 'armario'].includes(part)) render();
}

function totalEstimado(items) {
  let suma = 0;
  let cuenta = 0;
  items.forEach((i) => {
    const n = parseFloat(String(i.precio).replace(/[^\d.,]/g, '').replace(/,(?=\d{3}\b)/g, '').replace(',', '.'));
    if (Number.isFinite(n)) { suma += n; cuenta++; }
  });
  return { suma, cuenta };
}

function render() {
  const items = [...store.get().porComprar];
  if (orden === 'puntuacion') items.sort((a, b) => (b.puntuacion ?? 0) - (a.puntuacion ?? 0));
  const { suma, cuenta } = totalEstimado(items);
  root.innerHTML = `
    <div class="view-head" data-tour="comprar">
      <p class="eyebrow">Tu lista de deseos inteligente</p>
      <h2 class="display">Por Comprar</h2>
      <p class="lead">Los artículos que evaluaste y te convienen. Cuando los compres, márcalos y pasarán solos a tu Armario Virtual.</p>
    </div>
    ${items.length ? `
      <div class="toolbar">
        <span class="muted small">${items.length} artículo${items.length === 1 ? '' : 's'}${cuenta ? ` · Total estimado: <b>$${suma.toLocaleString('es-MX', { maximumFractionDigits: 2 })}</b>` : ''}</span>
        <label class="mini-select">Ordenar:
          <select id="orden"><option value="fecha">Más recientes</option><option value="puntuacion">Mejor puntuación</option></select>
        </label>
      </div>
      <div class="buy-list">${items.map(card).join('')}</div>`
    : `<div class="empty">
        <span class="empty-ico">🏷️</span>
        <h3>Tu lista está vacía</h3>
        <p class="muted">Evalúa una prenda o producto y presiona “Agregar a Por Comprar”.</p>
        <a href="#evaluar" class="btn btn-primary">Evaluar una compra</a>
      </div>`}
  `;
  const sel = $('#orden', root);
  if (sel) { sel.value = orden; sel.addEventListener('change', () => { orden = sel.value; render(); }); }
  $$('[data-act]', root).forEach((b) => b.addEventListener('click', () => accion(b.dataset.act, b.closest('[data-id]').dataset.id)));
}

function card(i) {
  const url = safeUrl(i.url);
  const p = i.puntuacion;
  return `<article class="buy-card" data-id="${esc(i.id)}">
    <div class="buy-photo">${i.foto ? `<img src="${i.foto}" alt="${esc(i.nombre)}" loading="lazy">` : `<div class="photo-ph">${colorDot(i.color, { tam: 40 })}</div>`}
      ${p ? `<span class="score-badge s-${p >= 8 ? 'alto' : p >= 6 ? 'medio' : 'bajo'}">${p}/10</span>` : ''}</div>
    <div class="buy-info">
      <small class="eyebrow">${esc(nombreCategoria(i.categoria))}${i.veredicto?.origen === 'estilizador' ? ' · 🎭 Estilizador' : ''}</small>
      <h4>${esc(i.nombre)}</h4>
      ${i.veredicto?.veredicto ? `<p class="small"><b>${esc(i.veredicto.veredicto)}</b> ${esc(i.veredicto.resumen || '').slice(0, 140)}${(i.veredicto.resumen || '').length > 140 ? '…' : ''}</p>` : ''}
      <p class="buy-meta">
        ${i.precio ? `<span class="price">💲 ${esc(i.precio)}</span>` : ''}
        ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">🔗 Ir a la tienda</a>` : ''}
        <span class="muted">${fechaCorta(i.fecha)}</span>
      </p>
      <div class="btn-row">
        <button class="btn btn-sm btn-primary" data-act="comprado">✓ Marcar como Comprado</button>
        ${i.veredicto && i.veredicto.origen !== 'estilizador' ? '<button class="btn btn-sm btn-soft" data-act="ver">Ver análisis</button>' : ''}
        <button class="btn btn-sm btn-ghost" data-act="editar">Editar</button>
        <button class="btn btn-sm btn-ghost danger" data-act="borrar" aria-label="Eliminar">🗑️</button>
      </div>
    </div>
  </article>`;
}

async function accion(act, id) {
  const it = store.get().porComprar.find((x) => x.id === id);
  if (!it) return;
  try {
    if (act === 'comprado') {
      store.marcarComprado(id);
      toast('¡Felicidades por tu compra! Ya está en Mi Armario 👗', 'ok');
    } else if (act === 'borrar') {
      if (await confirmar({ titulo: 'Eliminar artículo', texto: `¿Quitar “${it.nombre}” de tu lista?`, ok: 'Eliminar', peligro: true })) {
        store.removePorComprar(id);
        toast('Artículo eliminado');
      }
    } else if (act === 'ver') {
      abrirModal({
        titulo: 'Análisis de Gemini',
        contenido: `<div class="verdict-card">${it.foto ? `<img class="verdict-photo small" src="${it.foto}" alt="">` : ''}${veredictoHTML(it.veredicto, { ocasion: it.veredicto?.ocasionEvaluada })}</div>`,
      });
    } else if (act === 'editar') {
      editar(it);
    }
  } catch (e) { mostrarError(e); }
}

function editar(it) {
  const cont = h(`<form class="stack">
    <label class="field"><span>Nombre</span><input name="nombre" value="${esc(it.nombre)}" required></label>
    <label class="field"><span>Precio estimado</span><input name="precio" value="${esc(it.precio)}" placeholder="Ej. $599 MXN"></label>
    <label class="field"><span>Enlace de compra</span><input name="url" type="url" value="${esc(it.url)}" placeholder="https://…"></label>
    <div class="btn-row end"><button class="btn btn-primary" type="submit">Guardar</button></div>
  </form>`);
  const m = abrirModal({ titulo: 'Editar artículo', contenido: cont, clase: 'modal-sm' });
  cont.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(cont);
    const url = String(fd.get('url') || '').trim();
    if (url && !safeUrl(url)) { toast('El enlace debe empezar con https://', 'warn'); return; }
    try {
      store.updatePorComprar(it.id, { nombre: String(fd.get('nombre')).trim() || it.nombre, precio: String(fd.get('precio')).trim(), url: safeUrl(url) });
      m.cerrar();
      toast('Cambios guardados ✓', 'ok');
    } catch (err) { mostrarError(err); }
  });
}
