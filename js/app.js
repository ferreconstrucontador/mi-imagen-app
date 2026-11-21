// Punto de entrada: enrutador con History API, estado global y registro de la PWA.
import { store } from './store.js';
import { $, $$, abrirModal, h, toast } from './ui.js';
import * as hist from './historial.js';
import * as perfil from './views/perfil.js';
import * as evaluar from './views/evaluar.js';
import * as comprar from './views/comprar.js';
import * as armario from './views/armario.js';
import * as ajustes from './views/ajustes.js';
import * as ayuda from './views/ayuda.js';
import * as estilos from './views/estilos.js';
import { iniciarTour } from './tour.js';

const VIEWS = { perfil, evaluar, comprar, armario, ajustes, ayuda, estilos };
// Pestañas de la barra inferior y vistas secundarias (se apilan sobre la pestaña de origen).
const PESTANAS = ['perfil', 'evaluar', 'comprar', 'armario', 'ajustes'];
const SECUNDARIAS = ['estilos', 'ayuda'];
const INICIO = 'perfil';
const LLAVE_ULTIMA = 'miimagen.ultimaPestana';

const montadas = new Set();
let actual = null;

// Posición en la pila de navegación:
// nivel 0 = Perfil (raíz) · nivel 1 = otra pestaña · nivel 2+ = vistas secundarias.
// Así "Atrás" siempre regresa: secundaria → pestaña de origen → Perfil → salir.
let pos = { vista: INICIO, nivel: 0, padre: null };
const estado = () => ({ vista: pos.vista, nivel: pos.nivel, padre: pos.padre, capas: [] });

function recordarPestana(nombre) {
  if (!PESTANAS.includes(nombre)) return;
  try { localStorage.setItem(LLAVE_ULTIMA, nombre); } catch { /* almacenamiento no disponible */ }
}
function ultimaPestana() {
  try {
    const v = localStorage.getItem(LLAVE_ULTIMA);
    return PESTANAS.includes(v) ? v : INICIO;
  } catch { return INICIO; }
}

/** Navega registrando la entrada correcta en el historial. */
export function irA(nombre) {
  if (!VIEWS[nombre]) nombre = INICIO;
  // Primero se cierran modales/tour y se esperan los retrocesos en curso.
  if (hist.hayCapas()) { hist.cerrarTodasLasCapas(() => irA(nombre)); return; }
  if (hist.ocupado()) { hist.cuandoLibre(() => irA(nombre)); return; }

  if (nombre === pos.vista) { mostrar(nombre); return; }

  if (SECUNDARIAS.includes(nombre)) {
    const padre = SECUNDARIAS.includes(pos.vista) ? pos.padre : pos.vista;
    pos = { vista: nombre, nivel: pos.nivel + 1, padre };
    history.pushState(estado(), '', '#' + nombre);
    mostrar(nombre);
    return;
  }

  // Pestaña principal: nunca se apila más de una pestaña sobre Perfil.
  const objetivo = nombre === INICIO ? 0 : 1;
  if (pos.nivel > objetivo) {
    hist.retroceder(pos.nivel - objetivo, () => { sincronizarDesdeHistorial(); irA(nombre); });
    return;
  }
  pos = { vista: nombre, nivel: objetivo, padre: null };
  if (objetivo === 0 || history.state?.nivel === 1) history.replaceState(estado(), '', '#' + nombre);
  else history.pushState(estado(), '', '#' + nombre);
  mostrar(nombre);
}

function sincronizarDesdeHistorial() {
  const st = history.state;
  if (st && typeof st.nivel === 'number' && VIEWS[st.vista]) {
    pos = { vista: st.vista, nivel: st.nivel, padre: st.padre || null };
  }
}

/** Sólo muestra una vista (sin tocar el historial). */
function mostrar(nombre, { recordar = true } = {}) {
  if (!VIEWS[nombre]) nombre = INICIO;
  const navActivo = SECUNDARIAS.includes(nombre) ? (nombre === pos.vista ? pos.padre : null) : nombre;
  $$('.view').forEach((v) => { v.hidden = v.dataset.view !== nombre; });
  $$('[data-nav]').forEach((a) => {
    const activo = a.dataset.nav === navActivo;
    a.classList.toggle('active', activo);
    if (activo) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const el = $('#view-' + nombre);
  const mod = VIEWS[nombre];
  if (!montadas.has(nombre)) {
    mod.mount(el);
    montadas.add(nombre);
  }
  mod.show && mod.show(el);
  if (actual !== nombre) window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  actual = nombre;
  if (recordar) recordarPestana(nombre);
}

function rutaActual() {
  const r = (location.hash || '').slice(1).split('?')[0];
  return VIEWS[r] ? r : '';
}

function actualizarCabecera() {
  const s = store.get();
  const st = $('#ai-status');
  if (!s.apiKey) {
    st.hidden = false;
    st.className = 'ai-status off';
    st.innerHTML = '<a href="#ajustes">⚠ Configurar IA</a>';
  } else {
    st.hidden = false;
    st.className = 'ai-status on';
    st.textContent = 'IA lista';
  }
  const b = $('#badge-comprar');
  b.hidden = !s.porComprar.length;
  b.textContent = s.porComprar.length;
}

store.subscribe((part) => {
  actualizarCabecera();
  // Avisamos a las vistas montadas para que se refresquen si les interesa.
  montadas.forEach((n) => VIEWS[n].onStore && VIEWS[n].onStore(part, n === actual));
});

// ---------- Botón / gesto "Atrás" ----------
window.addEventListener('popstate', (e) => {
  if (hist.consumirPropio()) return; // retroceso hecho por la propia app
  const st = e.state;
  // 1) Si hay un modal o el tour abierto, Atrás lo cierra.
  hist.cerrarCapasExcepto(st?.capas || []);
  if (st && typeof st.nivel === 'number' && VIEWS[st.vista]) {
    // 2) Vista secundaria → pestaña de origen · 3) pestaña → Perfil.
    pos = { vista: st.vista, nivel: st.nivel, padre: st.padre || null };
    mostrar(pos.vista);
  } else {
    // Entrada ajena (p. ej. se editó la URL a mano): la normalizamos.
    const v = rutaActual() || INICIO;
    pos = { vista: v, nivel: v === INICIO ? 0 : 1, padre: null };
    history.replaceState(estado(), '', '#' + v);
    mostrar(v);
  }
});

// Si alguien escribe otro #hash a mano en la barra de direcciones.
window.addEventListener('hashchange', () => {
  const r = rutaActual();
  if (r && r !== pos.vista && !hist.ocupado()) {
    sincronizarDesdeHistorial();
    if (r !== pos.vista) irA(r);
  }
});

// Todos los enlaces internos (#vista) pasan por el enrutador.
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const destino = a.getAttribute('href').slice(1);
  if (!VIEWS[destino]) return;
  e.preventDefault();
  irA(destino);
});

const abrirTour = () => iniciarTour({ irA, ver: (v) => mostrar(v, { recordar: false }) });
$('#btn-manual').addEventListener('click', abrirTour);

// Exponemos el enrutador a otras vistas sin crear dependencias circulares.
window.MiImagen = { irA, iniciarTour: abrirTour };

// ---------- Instalación PWA ----------
window.MiImagen.instalacion = { prompt: null };
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.MiImagen.instalacion.prompt = e;
  document.dispatchEvent(new CustomEvent('mia:instalable'));
});
window.addEventListener('appinstalled', () => {
  window.MiImagen.instalacion.prompt = null;
  document.dispatchEvent(new CustomEvent('mia:instalable'));
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW no registrado', e));
  });
}

// ---------- Arranque ----------
function arrancar() {
  const st = history.state;
  if (st && typeof st.nivel === 'number' && VIEWS[st.vista]) {
    // Recarga dentro de la misma sesión: conservamos la pila existente.
    pos = { vista: st.vista, nivel: st.nivel, padre: st.padre || null };
    if (st.capas?.length) history.replaceState(estado(), '', '#' + pos.vista); // los modales no sobreviven a la recarga
    mostrar(pos.vista);
    return;
  }
  // Apertura nueva: un #hash explícito (atajo o enlace) manda; si no, la última pestaña visitada.
  const pedido = rutaActual();
  const pestana = PESTANAS.includes(pedido) ? pedido : ultimaPestana();
  pos = { vista: INICIO, nivel: 0, padre: null };
  history.replaceState(estado(), '', '#' + INICIO);
  if (pestana !== INICIO) {
    pos = { vista: pestana, nivel: 1, padre: null };
    history.pushState(estado(), '', '#' + pestana);
  }
  if (SECUNDARIAS.includes(pedido)) {
    pos = { vista: pedido, nivel: pos.nivel + 1, padre: pos.vista };
    history.pushState(estado(), '', '#' + pedido);
  }
  mostrar(pos.vista);
}

// Avisos de la capa de fotos (p. ej. si IndexedDB falla y se usa el respaldo).
document.addEventListener('mia:aviso-almacenamiento', (e) => toast(e.detail, 'warn', 7000));

// Carga los datos (y la primera vez mueve las fotos de localStorage a IndexedDB).
let inicio = { migradas: 0, faltantes: 0 };
try {
  inicio = await store.iniciar();
} catch (e) {
  console.error('No se pudieron cargar los datos', e);
}
actualizarCabecera();
arrancar();
if (inicio.migradas) {
  toast(`Tus ${inicio.migradas} foto${inicio.migradas === 1 ? '' : 's'} se movieron a un almacenamiento más amplio ✓`, 'ok', 5000);
}
if (inicio.faltantes) {
  toast(`No se encontraron ${inicio.faltantes} foto${inicio.faltantes === 1 ? '' : 's'} guardada${inicio.faltantes === 1 ? '' : 's'}. Puedes volver a subirlas o importar un respaldo.`, 'warn', 8000);
}

if (!store.get().settings.tourVisto) {
  setTimeout(() => {
    const cont = h(`<div class="welcome">
      <img src="icons/icon-192.png" alt="" width="72" height="72">
      <p class="lead">Soy tu asesora de imagen personal con inteligencia artificial. Juntas descubriremos tus colores, tu maquillaje ideal, los cortes que más te favorecen y armaremos outfits con lo que ya tienes.</p>
      <ul class="nice-list">
        <li>Tus fotos y datos se guardan <b>solo en tu teléfono</b>.</li>
        <li>Necesitas una API Key <b>gratuita</b> de Google AI Studio (te enseño cómo).</li>
        <li>Puedes instalarla como app en Android o iPhone.</li>
      </ul>
      <div class="btn-row end">
        <button class="btn btn-ghost" data-a="no">Explorar sola</button>
        <button class="btn btn-primary" data-a="tour">Iniciar tour guiado ✨</button>
      </div></div>`);
    const m = abrirModal({ titulo: '¡Bienvenida a MiImagenApp!', contenido: cont, clase: 'modal-sm' });
    $$('[data-a]', cont).forEach((b) => b.addEventListener('click', () => {
      try { store.updateSettings({ tourVisto: true }); } catch { /* */ }
      m.cerrar();
      if (b.dataset.a === 'tour') abrirTour();
    }));
  }, 500);
}
