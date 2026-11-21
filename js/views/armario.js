// Mi Armario: inventario visual, filtros, carga rápida con IA y generador de outfits.
import { store } from '../store.js';
import { CATEGORIAS, COLORES, OCASIONES, nombreCategoria, nombreColor, nombreOcasion, nombreClima } from '../constants.js';
import { detectarArticulo, generarOutfits, hayApiKey } from '../gemini.js';
import { preseleccionar } from './estilos.js';
import {
  $, $$, h, esc, toast, mostrarError, abrirModal, confirmar, cargando, photoPicker, chipGroup,
  selectColor, colorDot, opcionesOcasion, opcionesCategoria, fechaCorta, lista,
} from '../ui.js';

let root;
let cat = 'todo';
const filtroColores = new Set();
const filtroOcasiones = new Set();

export function mount(el) {
  root = el;
  el.innerHTML = `
    <div class="view-head">
      <p class="eyebrow">Armario virtual</p>
      <h2 class="display">Mi Armario</h2>
    </div>
    <div class="action-row" data-tour="armario">
      <button class="btn btn-primary" id="btn-inventario">＋ Agregar inventario inicial</button>
      <button class="btn btn-gold" id="btn-outfits">✨ Generar outfits</button>
      <a class="btn btn-soft span-all" href="#estilos">🎭 Estilizador Versátil: explora una prenda en 7 estilos</a>
    </div>
    <div class="cat-tabs" id="cat-tabs" role="tablist"></div>
    <div class="filters">
      <div class="filter-row">
        <span class="filter-label">Color</span>
        <div class="color-filter" id="color-filter"></div>
      </div>
      <div class="filter-row">
        <span class="filter-label">Ocasión</span>
        <div class="chips chips-scroll" id="oca-filter"></div>
      </div>
      <button class="link-btn" id="btn-limpiar" hidden>Limpiar filtros ✕</button>
    </div>
    <p class="muted small" id="armario-count"></p>
    <div class="closet-grid" id="closet-grid"></div>
    <div id="ultimos-outfits"></div>
  `;
  $('#btn-inventario', el).addEventListener('click', abrirInventario);
  $('#btn-outfits', el).addEventListener('click', abrirOutfits);
  $('#btn-limpiar', el).addEventListener('click', () => { filtroColores.clear(); filtroOcasiones.clear(); render(); });
  render();
}

export function show() { render(); }
export function onStore(part, visible) {
  if (visible && ['armario', 'all', 'historial'].includes(part)) render();
}

function filtrar(items) {
  return items.filter((i) =>
    (cat === 'todo' || i.categoria === cat) &&
    (!filtroColores.size || filtroColores.has(i.color)) &&
    (!filtroOcasiones.size || i.ocasiones.some((o) => filtroOcasiones.has(o))));
}

function render() {
  const { armario } = store.get();
  // Pestañas de categorías
  const counts = Object.fromEntries(CATEGORIAS.map((c) => [c.id, 0]));
  armario.forEach((i) => { counts[i.categoria] = (counts[i.categoria] || 0) + 1; });
  const tabs = $('#cat-tabs', root);
  tabs.innerHTML = [{ id: 'todo', nombre: 'Todo', icono: '✨' }, ...CATEGORIAS].map((c, i) => `
    <button role="tab" class="cat-tab" data-cat="${c.id}" aria-selected="${cat === c.id}">
      <span>${c.icono}</span>${c.id === 'todo' ? '' : `<small>${i}.</small> `}${esc(c.nombre)} <b>${c.id === 'todo' ? armario.length : counts[c.id]}</b>
    </button>`).join('');
  $$('.cat-tab', tabs).forEach((b) => b.addEventListener('click', () => {
    cat = b.dataset.cat;
    render();
    $(`.cat-tab[data-cat="${cat}"]`, root)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }));

  // Filtro por color (círculos)
  const presentes = new Set(armario.map((i) => i.color));
  const cf = $('#color-filter', root);
  cf.innerHTML = COLORES.map((c) => `<button type="button" class="cf-dot ${presentes.has(c.id) ? '' : 'is-empty'}" data-c="${c.id}" aria-pressed="${filtroColores.has(c.id)}" title="${esc(c.nombre)}" aria-label="${esc(c.nombre)}">${colorDot(c.id, { tam: 30, titulo: false })}<small>${esc(c.nombre.split(' /')[0])}</small></button>`).join('');
  $$('.cf-dot', cf).forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.c;
    filtroColores.has(id) ? filtroColores.delete(id) : filtroColores.add(id);
    render();
  }));

  // Filtro por ocasión
  const of = $('#oca-filter', root);
  of.innerHTML = OCASIONES.map((o) => `<button type="button" class="chip" data-o="${o.id}" aria-pressed="${filtroOcasiones.has(o.id)}">${o.icono} ${esc(o.corto)}</button>`).join('');
  $$('.chip', of).forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.o;
    filtroOcasiones.has(id) ? filtroOcasiones.delete(id) : filtroOcasiones.add(id);
    render();
  }));
  $('#btn-limpiar', root).hidden = !filtroColores.size && !filtroOcasiones.size;

  // Rejilla
  const items = filtrar(armario);
  $('#armario-count', root).textContent = armario.length
    ? `Mostrando ${items.length} de ${armario.length} artículo${armario.length === 1 ? '' : 's'}`
    : '';
  const grid = $('#closet-grid', root);
  if (!armario.length) {
    grid.innerHTML = `<div class="empty span-all">
      <span class="empty-ico">👗</span>
      <h3>Tu armario está esperando</h3>
      <p class="muted">Registra lo que ya tienes: toma una foto por artículo, elige su categoría y Gemini detecta el nombre, el color y las ocasiones por ti.</p>
      <button class="btn btn-primary" data-empty-add>＋ Agregar mi primer artículo</button>
    </div>`;
    $('[data-empty-add]', grid).addEventListener('click', abrirInventario);
  } else if (!items.length) {
    grid.innerHTML = '<div class="empty span-all"><p class="muted">No hay artículos con estos filtros.</p></div>';
  } else {
    grid.innerHTML = items.map((i) => `
      <button type="button" class="closet-item" data-id="${esc(i.id)}">
        <div class="ci-photo">${i.foto ? `<img src="${i.foto}" alt="" loading="lazy">` : `<div class="photo-ph">${colorDot(i.color, { tam: 36 })}</div>`}
          ${i.origen === 'compra' ? '<span class="ci-badge">Nuevo</span>' : ''}</div>
        <div class="ci-info">${colorDot(i.color, { tam: 12 })}<span>${esc(i.nombre)}</span></div>
        <div class="ci-tags">${i.ocasiones.slice(0, 3).map((o) => `<span title="${esc(nombreOcasion(o))}">${OCASIONES.find((x) => x.id === o)?.icono || ''}</span>`).join('')}</div>
      </button>`).join('');
    $$('.closet-item', grid).forEach((b) => b.addEventListener('click', () => detalle(b.dataset.id)));
  }

  renderUltimosOutfits();
}

// ------------------------------------------------------------------
// Detalle / edición
// ------------------------------------------------------------------
function detalle(id) {
  const it = store.get().armario.find((x) => x.id === id);
  if (!it) return;
  const edit = { nombre: it.nombre, categoria: it.categoria, color: it.color, ocasiones: [...it.ocasiones], descripcion: it.descripcion, foto: it.foto };
  const cont = h(`<div class="stack">
    <div class="detail-top">
      <div id="d-foto"></div>
      <div class="stack">
        <label class="field"><span>Nombre</span><input name="nombre" value="${esc(it.nombre)}"></label>
        <label class="field"><span>Categoría</span><select name="categoria">${opcionesCategoria().map((c) => `<option value="${c.id}" ${c.id === it.categoria ? 'selected' : ''}>${c.icono} ${esc(c.nombre)}</option>`).join('')}</select></label>
        <label class="field"><span>Descripción</span><textarea name="descripcion" rows="2">${esc(it.descripcion)}</textarea></label>
        <p class="muted small">${it.origen === 'compra' ? `Comprado el ${fechaCorta(it.fechaCompra)}` : `Registrado el ${fechaCorta(it.fecha)}`}${it.puntuacion ? ` · Compatibilidad ${it.puntuacion}/10` : ''}</p>
      </div>
    </div>
    <label class="field-label">Color predominante</label><div id="d-color"></div>
    <label class="field-label">Ocasiones de uso</label><div id="d-oca"></div>
    <button class="btn btn-gold btn-block" data-a="estilos">🎭 Ver esta prenda en los 7 estilos</button>
    <div class="btn-row spread">
      <button class="btn btn-ghost danger" data-a="borrar">🗑️ Eliminar</button>
      <button class="btn btn-primary" data-a="guardar">Guardar cambios</button>
    </div>
  </div>`);
  $('#d-foto', cont).appendChild(photoPicker({ valor: it.foto, aspecto: '1/1', etiqueta: 'Foto', quitar: false, onChange: (v) => { edit.foto = v; } }));
  $('#d-color', cont).appendChild(selectColor({ valor: it.color, onChange: (v) => { edit.color = v; } }));
  $('#d-oca', cont).appendChild(chipGroup({ opciones: opcionesOcasion(), seleccion: it.ocasiones, multiple: true, onChange: (v) => { edit.ocasiones = v; }, clase: 'chips-wrap' }));
  const m = abrirModal({ titulo: it.nombre, contenido: cont });
  $('[data-a="guardar"]', cont).addEventListener('click', () => {
    try {
      store.updateArmario(id, {
        ...edit,
        nombre: $('[name=nombre]', cont).value.trim() || it.nombre,
        categoria: $('[name=categoria]', cont).value,
        descripcion: $('[name=descripcion]', cont).value.trim(),
      });
      m.cerrar();
      toast('Cambios guardados ✓', 'ok');
    } catch (e) { mostrarError(e); }
  });
  $('[data-a="estilos"]', cont).addEventListener('click', () => {
    m.cerrar();
    preseleccionar(id);
    window.MiImagen.irA('estilos');
  });
  $('[data-a="borrar"]', cont).addEventListener('click', async () => {
    if (await confirmar({ titulo: 'Eliminar del armario', texto: `¿Eliminar “${it.nombre}” de tu armario?`, ok: 'Eliminar', peligro: true })) {
      try { store.removeArmario(id); m.cerrar(); toast('Artículo eliminado'); } catch (e) { mostrarError(e); }
    }
  });
}

// ------------------------------------------------------------------
// Inventario inicial: carga rápida 1 a 1 con foto
// ------------------------------------------------------------------
function abrirInventario() {
  let agregados = 0;
  const nuevo = (categoria = cat !== 'todo' ? cat : '') => ({ foto: '', categoria, nombre: '', descripcion: '', color: '', ocasiones: [] });
  let item = nuevo();
  let detectando = 0;

  const cont = h(`<div class="stack inv">
    <p class="muted small">Registra lo que ya tienes en tu clóset, un artículo a la vez. <b>1)</b> Toma la foto <b>2)</b> Elige la categoría <b>3)</b> Gemini completa nombre, color y ocasiones. Revisa y guarda.</p>
    <div class="inv-grid">
      <div id="inv-foto"></div>
      <div class="stack">
        <label class="field-label">Categoría <b class="req">*</b></label>
        <div id="inv-cat"></div>
      </div>
    </div>
    <div class="ai-detect" id="inv-ai" hidden></div>
    <label class="field"><span>Nombre / descripción breve</span><input name="nombre" placeholder="Ej. Jeans rectos azul claro"></label>
    <label class="field-label">Color predominante</label><div id="inv-color"></div>
    <label class="field-label">Ocasiones sugeridas</label><div id="inv-oca"></div>
    <div class="btn-row spread">
      <span class="muted small" id="inv-count"></span>
      <span class="btn-row">
        <button class="btn btn-soft" data-a="otra">Guardar y agregar otra</button>
        <button class="btn btn-primary" data-a="cerrar">Guardar</button>
      </span>
    </div>
  </div>`);

  const foto = photoPicker({ aspecto: '1/1', etiqueta: 'Foto del artículo', camara: 'environment', ayuda: 'Sobre fondo liso, bien iluminado', onChange: (v) => { item.foto = v; intentarDetectar(); } });
  $('#inv-foto', cont).appendChild(foto);
  const cats = chipGroup({ opciones: opcionesCategoria(), seleccion: item.categoria, onChange: (v) => { item.categoria = v; intentarDetectar(); }, clase: 'chips-wrap chips-sm' });
  $('#inv-cat', cont).appendChild(cats);
  const color = selectColor({ valor: '', onChange: (v) => { item.color = v; } });
  $('#inv-color', cont).appendChild(color);
  const ocas = chipGroup({ opciones: opcionesOcasion(), seleccion: [], multiple: true, onChange: (v) => { item.ocasiones = v; }, clase: 'chips-wrap chips-sm' });
  $('#inv-oca', cont).appendChild(ocas);
  const nombre = $('[name=nombre]', cont);
  nombre.addEventListener('input', () => { item.nombre = nombre.value; });
  const ai = $('#inv-ai', cont);

  const m = abrirModal({ titulo: 'Agregar inventario inicial', contenido: cont, clase: 'modal-lg' });

  async function intentarDetectar() {
    if (!item.foto || !item.categoria) return;
    if (!hayApiKey()) {
      ai.hidden = false;
      ai.className = 'ai-detect warn';
      ai.innerHTML = 'Sin API Key: completa los datos a mano o configúrala en <a href="#ajustes">Ajustes</a> para que la IA los detecte.';
      return;
    }
    const ticket = ++detectando;
    ai.hidden = false;
    ai.className = 'ai-detect busy';
    ai.innerHTML = '<span class="spinner"></span> Gemini está detectando nombre, color y ocasiones…';
    try {
      const r = await detectarArticulo({ foto: item.foto, categoria: item.categoria });
      if (ticket !== detectando || !cont.isConnected) return;
      item.nombre = r.nombre || item.nombre;
      item.descripcion = r.descripcion || '';
      if (r.color) item.color = r.color;
      if (r.ocasiones.length) item.ocasiones = r.ocasiones;
      nombre.value = item.nombre;
      color.setValue(item.color);
      ocas.setValue(item.ocasiones);
      ai.className = 'ai-detect ok';
      ai.innerHTML = `✨ Detectado: <b>${esc(item.nombre)}</b> · ${esc(nombreColor(item.color))}. Puedes ajustar lo que quieras.`;
    } catch (e) {
      if (ticket !== detectando) return;
      ai.className = 'ai-detect warn';
      ai.innerHTML = `${esc(e.message)} <button type="button" class="link-btn" data-retry>Reintentar</button>`;
      $('[data-retry]', ai)?.addEventListener('click', intentarDetectar);
    }
  }

  const guardar = (seguir) => {
    if (!item.foto && !item.nombre.trim()) { toast('Agrega al menos una foto o un nombre.', 'warn'); return; }
    if (!item.categoria) { toast('Elige la categoría del artículo.', 'warn'); return; }
    try {
      store.addArmario({
        ...item,
        nombre: item.nombre.trim() || `${nombreCategoria(item.categoria)} sin nombre`,
        color: item.color || 'multicolor',
        origen: 'inventario',
      });
      agregados++;
      toast('Guardado en Mi Armario ✓', 'ok', 1800);
      if (seguir) {
        detectando++;
        item = nuevo(item.categoria);
        foto.setValue('');
        nombre.value = '';
        color.setValue('');
        ocas.setValue([]);
        ai.hidden = true;
        $('#inv-count', cont).textContent = `Llevas ${agregados} artículo${agregados === 1 ? '' : 's'} en esta sesión 💪`;
        cont.closest('.modal-body')?.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        m.cerrar();
      }
    } catch (e) { mostrarError(e); }
  };
  $('[data-a="otra"]', cont).addEventListener('click', () => guardar(true));
  $('[data-a="cerrar"]', cont).addEventListener('click', () => guardar(false));
}

// ------------------------------------------------------------------
// Generador de outfits
// ------------------------------------------------------------------
function abrirOutfits() {
  const { armario, profile } = store.get();
  if (armario.length < 3) {
    toast('Registra al menos 3 artículos en tu armario para generar outfits.', 'warn', 4500);
    return;
  }
  let ocasion = 'casual';
  const cont = h(`<div class="stack">
    <p class="muted small">Gemini armará <b>3 combinaciones completas</b> usando únicamente lo que tienes en tu armario, pensando en el clima de <b>${esc(profile.ciudad || 'tu ciudad')}</b>${profile.clima ? ` (${esc(nombreClima(profile.clima).toLowerCase())})` : ''}.</p>
    <label class="field-label">¿Para qué ocasión?</label>
    <div id="out-oca"></div>
    <button class="btn btn-gold btn-block" data-a="gen">✨ Crear mis 3 outfits</button>
    <div id="out-res"></div>
  </div>`);
  $('#out-oca', cont).appendChild(chipGroup({ opciones: opcionesOcasion(), seleccion: ocasion, onChange: (v) => { ocasion = v; }, clase: 'chips-wrap' }));
  abrirModal({ titulo: 'Generador de outfits', contenido: cont, clase: 'modal-lg' });
  $('[data-a="gen"]', cont).addEventListener('click', async () => {
    const fin = cargando(['Abriendo tu armario…', 'Combinando colores de tu paleta…', 'Revisando el clima de tu ciudad…', 'Eligiendo calzado y accesorios…', 'Afinando los últimos detalles…']);
    try {
      const r = await generarOutfits({ ocasion });
      if (!r.outfits.length) throw new Error('La IA no pudo armar outfits con tu armario actual. Agrega más prendas e inténtalo de nuevo.');
      store.addHistorial({ tipo: 'outfits', titulo: `Outfits · ${nombreOcasion(ocasion)}`, ocasion, resultado: r });
      const res = $('#out-res', cont);
      res.innerHTML = '';
      res.appendChild(outfitsHTML(r, ocasion));
      res.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      mostrarError(e, 'outfits');
    } finally { fin(); }
  });
}

function outfitsHTML(r, ocasion) {
  const { armario } = store.get();
  return h(`<div class="outfits">
    <h4 class="sub">${esc(nombreOcasion(ocasion))}</h4>
    ${r.outfits.map((o, i) => {
      const piezas = o.piezas.map((id) => armario.find((a) => a.id === id)).filter(Boolean);
      return `<article class="outfit">
        <header><span class="outfit-num">${i + 1}</span><h5>${esc(o.titulo)}</h5></header>
        <div class="outfit-pieces">${piezas.map((p) => `<figure>${p.foto ? `<img src="${p.foto}" alt="">` : `<div class="photo-ph">${colorDot(p.color, { tam: 28 })}</div>`}<figcaption>${esc(p.nombre)}</figcaption></figure>`).join('') || '<p class="muted small">(Piezas eliminadas del armario)</p>'}</div>
        ${o.descripcion ? `<p>${esc(o.descripcion)}</p>` : ''}
        <div class="outfit-extra">
          ${o.maquillaje ? `<p><b>💄 Maquillaje:</b> ${esc(o.maquillaje)}</p>` : ''}
          ${o.peinado ? `<p><b>💇‍♀️ Peinado:</b> ${esc(o.peinado)}</p>` : ''}
          ${o.porQueFunciona ? `<p><b>💖 Por qué te favorece:</b> ${esc(o.porQueFunciona)}</p>` : ''}
        </div>
      </article>`;
    }).join('')}
    ${r.faltantes?.length ? `<div class="callout">🛍️ <b>Piezas que completarían tu armario:</b>${lista(r.faltantes)}<a href="#evaluar" class="small">Evaluar una compra →</a></div>` : ''}
  </div>`);
}

function renderUltimosOutfits() {
  const cont = $('#ultimos-outfits', root);
  const hist = store.get().historial.filter((x) => x.tipo === 'outfits').slice(0, 6);
  if (!hist.length) { cont.innerHTML = ''; return; }
  cont.innerHTML = `<details class="card history"><summary>👯‍♀️ Outfits generados (${hist.length})</summary>
    <ul class="history-list">${hist.map((x) => `<li><button type="button" data-id="${esc(x.id)}"><span class="thumb-ph">${OCASIONES.find((o) => o.id === x.ocasion)?.icono || '✨'}</span><span><b>${esc(x.titulo)}</b><small>${fechaCorta(x.fecha)}</small></span><span>›</span></button></li>`).join('')}</ul></details>`;
  $$('[data-id]', cont).forEach((b) => b.addEventListener('click', () => {
    const x = hist.find((i) => i.id === b.dataset.id);
    if (x?.resultado) abrirModal({ titulo: x.titulo, contenido: outfitsHTML(x.resultado, x.ocasion), clase: 'modal-lg' });
  }));
}
