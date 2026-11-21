// Estilizador Versátil (Explorar Estilos): una prenda en los 7 Estilos Universales.
import { store } from '../store.js';
import { ESTILOS_UNIVERSALES, OCASIONES, nombreCategoria, nombreColor, nombreClima } from '../constants.js';
import { explorarEstilos } from '../gemini.js';
import { thumbnail } from '../image.js';
import {
  $, $$, h, esc, toast, mostrarError, cargando, photoPicker, colorDot, opcionesCategoria,
  fechaCorta, abrirModal,
} from '../ui.js';

let root;
let modo = 'armario'; // 'armario' | 'nueva'
let seleccionId = '';
const vaciaNueva = () => ({ foto: '', nombre: '', categoria: '', descripcion: '' });
let nueva = vaciaNueva();
let resultado = null; // { base, res, histId }

/** Abre el estilizador con una prenda del armario ya elegida. */
export function preseleccionar(id) {
  modo = 'armario';
  seleccionId = id;
  resultado = null;
  if (root) mount(root);
}

/** Abre el estilizador con una prenda nueva (por ejemplo, desde "¿Me queda bien?"). */
export function preseleccionarNueva(datos) {
  modo = 'nueva';
  nueva = { ...vaciaNueva(), ...datos };
  resultado = null;
  if (root) mount(root);
}

export function mount(el) {
  root = el;
  el.innerHTML = `
    <div class="view-head">
      <p class="eyebrow">Estilizador versátil</p>
      <h2 class="display">Explorar Estilos</h2>
      <p class="lead">Elige una prenda y descubre cómo llevarla en los <b>7 Estilos Universales</b>. Aquí la IA no se limita a tu armario: te sugiere libremente lo que haría falta para cada look.</p>
    </div>
    <div class="card" id="est-form">
      <div class="seg" role="tablist">
        <button role="tab" data-m="armario" aria-selected="${modo === 'armario'}">👗 De Mi Armario</button>
        <button role="tab" data-m="nueva" aria-selected="${modo === 'nueva'}">📸 Prenda nueva</button>
      </div>
      <div id="est-fuente"></div>
      <button class="btn btn-gold btn-lg btn-block" id="btn-estilos">🎭 Combinar en todos los estilos (Sin límite de armario)</button>
      <p class="hint center" id="est-hint"></p>
    </div>
    <div id="est-resultado"></div>
    <div id="est-historial"></div>
  `;
  $$('.seg [data-m]', el).forEach((b) => b.addEventListener('click', () => {
    modo = b.dataset.m;
    $$('.seg [data-m]', el).forEach((x) => x.setAttribute('aria-selected', x === b));
    pintarFuente();
  }));
  $('#btn-estilos', el).addEventListener('click', generar);
  pintarFuente();
  pintarResultado();
  pintarHistorial();
}

export function show() {
  if (!root) return;
  if (modo === 'armario') pintarFuente();
  pintarHint();
  pintarHistorial();
}

export function onStore(part, visible) {
  if (!root) return;
  if (part === 'all') { resultado = null; seleccionId = ''; nueva = vaciaNueva(); mount(root); return; }
  if (!visible) return;
  if (part === 'armario' && modo === 'armario') pintarFuente();
  if (part === 'porComprar' || part === 'armario') pintarResultado();
  if (part === 'historial') pintarHistorial();
  pintarHint();
}

function pintarHint() {
  const { apiKey, diagnostico } = store.get();
  $('#est-hint', root).innerHTML = !apiKey
    ? '⚠️ Configura tu API Key en <a href="#ajustes">Ajustes</a> para usar el estilizador.'
    : !diagnostico
      ? '💡 Con tu <a href="#perfil">diagnóstico de 4 Pilares</a> los looks respetarán tu paleta y tu silueta.'
      : '';
}

function pintarFuente() {
  const cont = $('#est-fuente', root);
  const { armario } = store.get();
  if (modo === 'armario') {
    if (seleccionId && !armario.some((a) => a.id === seleccionId)) seleccionId = '';
    if (!armario.length) {
      cont.innerHTML = `<div class="empty compact"><p class="muted">Tu armario está vacío. Registra prendas en <a href="#armario">Mi Armario</a> o usa la pestaña <b>Prenda nueva</b>.</p></div>`;
    } else {
      // Primero la ropa (no maquillaje), que es lo que tiene sentido estilizar.
      const items = [...armario].sort((a, b) => (a.categoria === 'maquillaje') - (b.categoria === 'maquillaje'));
      cont.innerHTML = `
        <label class="field-label">Elige la prenda base (${armario.length})</label>
        <div class="pick-strip">${items.map((i) => `
          <button type="button" class="pick-item" data-id="${esc(i.id)}" aria-pressed="${i.id === seleccionId}">
            <span class="pi-photo">${i.foto ? `<img src="${i.foto}" alt="" loading="lazy">` : colorDot(i.color, { tam: 30 })}</span>
            <small>${esc(i.nombre)}</small>
          </button>`).join('')}</div>
        <p class="muted small" id="pick-sel"></p>`;
      const sel = () => {
        const it = armario.find((a) => a.id === seleccionId);
        $('#pick-sel', cont).innerHTML = it ? `Seleccionada: <b>${esc(it.nombre)}</b> · ${esc(nombreCategoria(it.categoria))} · ${esc(nombreColor(it.color))}` : 'Toca una prenda para seleccionarla.';
      };
      $$('.pick-item', cont).forEach((b) => b.addEventListener('click', () => {
        seleccionId = b.dataset.id;
        $$('.pick-item', cont).forEach((x) => x.setAttribute('aria-pressed', x === b));
        sel();
      }));
      sel();
      $('.pick-item[aria-pressed="true"]', cont)?.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
  } else {
    cont.innerHTML = `
      <div class="eval-grid">
        <div><label class="field-label">Foto de la prenda</label><div id="est-foto"></div></div>
        <div class="eval-fields">
          <label class="field"><span>Nombre o descripción breve</span><input name="est-nombre" placeholder="Ej. Blazer oversize color camel"></label>
          <label class="field"><span>Categoría</span><select name="est-cat"><option value="">✨ Que la IA la detecte</option>
            ${opcionesCategoria().map((c) => `<option value="${c.id}">${c.icono} ${esc(c.nombre)}</option>`).join('')}</select></label>
          <label class="field"><span>Detalles (opcional)</span><textarea name="est-desc" rows="2" placeholder="Tela, corte, largo…"></textarea></label>
        </div>
      </div>`;
    $('#est-foto', cont).appendChild(photoPicker({
      valor: nueva.foto, aspecto: '1/1', etiqueta: 'Toma o sube la foto', camara: 'environment',
      ayuda: 'Prenda extendida, fondo liso', onChange: (v) => { nueva.foto = v; },
    }));
    [['est-nombre', 'nombre'], ['est-cat', 'categoria'], ['est-desc', 'descripcion']].forEach(([n, k]) => {
      const inp = $(`[name="${n}"]`, cont);
      inp.value = nueva[k] || '';
      inp.addEventListener('input', () => { nueva[k] = inp.value.trim(); });
    });
  }
  pintarHint();
}

function baseActual() {
  if (modo === 'armario') {
    const it = store.get().armario.find((a) => a.id === seleccionId);
    return it ? { foto: it.foto, nombre: it.nombre, categoria: it.categoria, color: it.color, descripcion: it.descripcion, armarioId: it.id } : null;
  }
  if (!nueva.foto && !nueva.nombre && !nueva.descripcion) return null;
  return { ...nueva, color: '' };
}

async function generar() {
  const base = baseActual();
  if (!base) {
    toast(modo === 'armario' ? 'Elige una prenda de tu armario.' : 'Agrega una foto o el nombre de la prenda.', 'warn');
    return;
  }
  const fin = cargando([
    'Estudiando tu prenda…',
    'Llevándola al estilo Natural y Clásico…',
    'Afinando el look Elegante y Romántico…',
    'Subiendo el glam para el estilo Seductor…',
    'Jugando con el estilo Creativo…',
    'Diseñando el look Dramático…',
    `Adaptando todo al clima de ${store.get().profile.ciudad || 'tu ciudad'}…`,
  ]);
  try {
    const res = await explorarEstilos(base);
    if (!res.estilos.length) throw new Error('La IA no devolvió los estilos. Inténtalo de nuevo.');
    let thumb = '';
    if (base.foto) { try { thumb = await thumbnail(base.foto); } catch { /* */ } }
    const { foto, ...baseSinFoto } = base;
    store.addHistorial({ tipo: 'estilos', titulo: `Estilos · ${res.prenda.nombre}`, resumen: `${res.estilos.length} estilos`, thumb, base: baseSinFoto, resultado: res });
    resultado = { base, res };
    pintarResultado();
    setTimeout(() => $('#est-resultado', root)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  } catch (e) {
    mostrarError(e, 'estilos');
  } finally {
    fin();
  }
}

// ------------------------------------------------------------------
// Resultado: tarjetas de los 7 estilos
// ------------------------------------------------------------------
const clave = (s) => String(s || '').trim().toLowerCase();

function yaEnLista(nombre) {
  return store.get().porComprar.some((p) => clave(p.nombre) === clave(nombre));
}

export function estilosHTML(res, base) {
  const { armario, profile } = store.get();
  const faltantes = res.estilos.length < ESTILOS_UNIVERSALES.length
    ? `<p class="muted small">La IA devolvió ${res.estilos.length} de 7 estilos. Puedes volver a intentarlo para completar el resto.</p>` : '';
  return h(`<div class="estilos-res">
    <div class="card est-base">
      ${base?.foto ? `<img src="${base.foto}" alt="">` : '<span class="thumb-ph big">👚</span>'}
      <div>
        <p class="eyebrow">Prenda base</p>
        <h3>${esc(res.prenda.nombre)}</h3>
        ${res.prenda.analisis ? `<p class="small">${esc(res.prenda.analisis)}</p>` : ''}
        <p class="muted small">📍 ${esc(profile.ciudad || 'Tu ciudad')} · ${esc(nombreClima(profile.clima) || 'clima no indicado')}</p>
      </div>
    </div>
    <nav class="est-index" aria-label="Ir a un estilo">${res.estilos.map((e) => {
      const u = ESTILOS_UNIVERSALES.find((x) => x.id === e.id);
      return `<a href="#est-${e.id}" data-jump="${e.id}" style="--acento:${u.acento}">${u.icono} ${esc(u.nombre.split(' /')[0])}</a>`;
    }).join('')}</nav>
    ${faltantes}
    <div class="est-grid">${res.estilos.map((e, i) => {
      const u = ESTILOS_UNIVERSALES.find((x) => x.id === e.id);
      return `<article class="est-card" id="est-${e.id}" style="--acento:${u.acento}">
        <header>
          <span class="est-ico">${u.icono}</span>
          <div><small>Estilo ${i + 1} · ${esc(u.nombre)}</small><h4>${esc(e.titulo)}</h4></div>
        </header>
        ${e.paleta.length ? `<div class="est-paleta">${e.paleta.map((c) => `<span style="background:${c.hex}" title="${esc(c.nombre)} ${c.hex}"></span>`).join('')}</div>` : ''}
        ${e.esencia ? `<p class="est-esencia">${esc(e.esencia)}</p>` : ''}
        ${e.comoLlevarla ? `<div class="est-row"><b>👚 Cómo llevar tu prenda</b><p>${esc(e.comoLlevarla)}</p></div>` : ''}
        ${e.prendasSugeridas.length ? `<div class="est-row"><b>🛍️ Prendas sugeridas para este look</b>
          <ul class="sug-list">${e.prendasSugeridas.map((p, k) => {
            const similar = p.similarEnArmario ? armario.find((a) => a.id === p.similarEnArmario) : null;
            const agregada = yaEnLista(p.nombre);
            return `<li>
              ${p.color ? colorDot(p.color, { tam: 18 }) : '<span class="color-dot" style="--c:#ddd;--s:18px"></span>'}
              <span class="sug-info"><b>${esc(p.nombre)}</b>
                <small>${p.categoria ? esc(nombreCategoria(p.categoria)) + ' · ' : ''}${esc(p.porQue)}</small>
                ${similar ? `<small class="sug-tienes">✓ Ya tienes algo similar: ${esc(similar.nombre)}</small>` : ''}</span>
              <button type="button" class="btn btn-sm ${agregada ? 'btn-ghost' : 'btn-soft'}" data-add="${e.id}:${k}" ${agregada ? 'disabled' : ''}>${agregada ? '✓ En lista' : '＋ Por Comprar'}</button>
            </li>`;
          }).join('')}</ul></div>` : ''}
        <div class="est-details">
          ${e.calzado ? `<p><b>👠 Calzado:</b> ${esc(e.calzado)}</p>` : ''}
          ${e.accesorios ? `<p><b>💍 Accesorios:</b> ${esc(e.accesorios)}</p>` : ''}
          ${e.peinado ? `<p><b>💇‍♀️ Peinado:</b> ${esc(e.peinado)}</p>` : ''}
          ${e.maquillaje ? `<p><b>💄 Maquillaje:</b> ${esc(e.maquillaje)}</p>` : ''}
          ${e.tipClima ? `<p class="est-clima">🌦️ ${esc(e.tipClima)}</p>` : ''}
        </div>
      </article>`;
    }).join('')}</div>
  </div>`);
}

/** Conecta los botones "＋ Por Comprar" e índice de una tarjeta de resultados. */
function conectar(nodo, res) {
  $$('[data-jump]', nodo).forEach((a) => a.addEventListener('click', (ev) => {
    ev.preventDefault(); // no cambiar el hash: el enrutador lo interpretaría como vista
    nodo.querySelector(`#est-${a.dataset.jump}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  $$('[data-add]', nodo).forEach((b) => b.addEventListener('click', () => {
    const [estiloId, k] = b.dataset.add.split(':');
    const e = res.estilos.find((x) => x.id === estiloId);
    const p = e?.prendasSugeridas[+k];
    if (!p) return;
    const u = ESTILOS_UNIVERSALES.find((x) => x.id === estiloId);
    try {
      store.addPorComprar({
        foto: '',
        nombre: p.nombre,
        descripcion: p.porQue,
        categoria: p.categoria || 'tops',
        color: p.color || 'multicolor',
        ocasiones: OCASIONES.some((o) => o.id === u.ocasion) ? [u.ocasion] : [],
        url: '',
        precio: '',
        puntuacion: null,
        veredicto: {
          origen: 'estilizador',
          nombre: p.nombre,
          veredicto: `Sugerida para tu look ${u.nombre}`,
          resumen: `${p.porQue}${res.prenda.nombre ? ` Para combinar con: ${res.prenda.nombre}.` : ''}`,
          estilo: u.id,
        },
      });
      b.disabled = true;
      b.className = 'btn btn-sm btn-ghost';
      b.textContent = '✓ En lista';
      toast(`“${p.nombre}” agregada a Por Comprar 🏷️`, 'ok');
    } catch (err) { mostrarError(err); }
  }));
}

function pintarResultado() {
  const cont = $('#est-resultado', root);
  if (!cont) return;
  cont.innerHTML = '';
  if (!resultado) return;
  const nodo = estilosHTML(resultado.res, resultado.base);
  cont.appendChild(nodo);
  conectar(nodo, resultado.res);
}

function pintarHistorial() {
  const cont = $('#est-historial', root);
  if (!cont) return;
  const hist = store.get().historial.filter((x) => x.tipo === 'estilos').slice(0, 8);
  if (!hist.length) { cont.innerHTML = ''; return; }
  cont.innerHTML = `<details class="card history"><summary>🎭 Exploraciones recientes (${hist.length})</summary>
    <ul class="history-list">${hist.map((x) => `<li><button type="button" data-id="${esc(x.id)}">
      ${x.thumb ? `<img src="${x.thumb}" alt="">` : '<span class="thumb-ph">🎭</span>'}
      <span><b>${esc(x.titulo)}</b><small>${esc(x.resumen || '')} · ${fechaCorta(x.fecha)}</small></span><span>›</span>
    </button></li>`).join('')}</ul></details>`;
  $$('[data-id]', cont).forEach((b) => b.addEventListener('click', () => {
    const x = hist.find((i) => i.id === b.dataset.id);
    if (!x?.resultado) return;
    const nodo = estilosHTML(x.resultado, { foto: x.thumb });
    abrirModal({ titulo: x.titulo, contenido: nodo, clase: 'modal-lg' });
    conectar(nodo, x.resultado);
  }));
}
