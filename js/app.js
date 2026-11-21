// Punto de entrada: enrutador por hash, estado global y registro de la PWA.
import { store } from './store.js';
import { $, $$, abrirModal, h, cerrarModales } from './ui.js';
import * as perfil from './views/perfil.js';
import * as evaluar from './views/evaluar.js';
import * as comprar from './views/comprar.js';
import * as armario from './views/armario.js';
import * as ajustes from './views/ajustes.js';
import * as ayuda from './views/ayuda.js';
import { iniciarTour } from './tour.js';

const VIEWS = { perfil, evaluar, comprar, armario, ajustes, ayuda };
const montadas = new Set();
let actual = null;

export function irA(nombre) {
  if (location.hash !== '#' + nombre) history.pushState(null, '', '#' + nombre);
  mostrar(nombre);
}

function mostrar(nombre) {
  if (!VIEWS[nombre]) nombre = 'perfil';
  $$('.view').forEach((v) => { v.hidden = v.dataset.view !== nombre; });
  $$('[data-nav]').forEach((a) => {
    const activo = a.dataset.nav === nombre;
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
}

function rutaActual() {
  return (location.hash || '#perfil').slice(1).split('?')[0];
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

window.addEventListener('hashchange', () => { cerrarModales(); mostrar(rutaActual()); });
window.addEventListener('popstate', () => mostrar(rutaActual()));

$('#btn-manual').addEventListener('click', () => iniciarTour({ irA }));

// Exponemos el enrutador a otras vistas sin crear dependencias circulares.
window.MiImagen = { irA, iniciarTour: () => iniciarTour({ irA }) };

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
actualizarCabecera();
mostrar(rutaActual());

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
      if (b.dataset.a === 'tour') iniciarTour({ irA });
    }));
  }, 500);
}
