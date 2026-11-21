// Tour guiado interactivo de 8 pasos (botón "? Manual").
import { store } from './store.js';
import { h, esc, $ } from './ui.js';

const PASOS = [
  {
    vista: 'perfil', sel: '#btn-manual', titulo: '¡Hola! Soy tu manual 👋',
    texto: 'MiImagenApp es tu asesora de imagen personal con IA. En 8 pasos te muestro cómo funciona. Puedes volver a este tour cuando quieras con el botón <b>? Manual</b>.',
  },
  {
    vista: 'ajustes', sel: '[data-tour="apikey"]', titulo: 'Tu API Key gratuita 🔑',
    texto: 'Entra a <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">aistudio.google.com/apikey</a> con tu Gmail, toca <b>“Create API key”</b>, cópiala y pégala aquí. Luego presiona <b>Guardar y validar</b>. Se guarda solo en tu teléfono.',
  },
  {
    vista: 'perfil', sel: '[data-tour="ubicacion"]', abrir: '#perfil-form', titulo: 'Tu perfil, ciudad y clima 📍',
    texto: 'Escribe tu ciudad (ej. <i>Campeche, México</i>) y tu clima predominante. La IA los usa en <b>todo</b>: telas, maquillaje que resiste tu clima, cuidado del cabello, compras y outfits.',
  },
  {
    vista: 'perfil', sel: '[data-tour="selfie"]', abrir: '#perfil-form', titulo: 'La foto ideal 📸',
    texto: 'Selfie con <b>luz natural</b> de frente (junto a una ventana), sin maquillaje ni filtros, cabello recogido y ropa neutra. La foto de cuerpo completo es opcional y mejora tu análisis de silueta.',
  },
  {
    vista: 'perfil', sel: '[data-tour="analizar"]', titulo: 'Tus 4 Pilares ✨',
    texto: 'Presiona <b>Analizar con Gemini IA</b> y recibe: 1) Colorimetría con draping digital, 2) Visagismo, maquillaje y cabello, 3) Morfología, ropa y accesorios, 4) Cuidado personal y presencia.',
  },
  {
    vista: 'evaluar', sel: '[data-tour="evaluar"]', titulo: '¿Me queda bien? 🛍️',
    texto: 'Antes de comprar, sube la foto o pega el enlace de la tienda, elige la ocasión y obtén una calificación del 1 al 10, con qué combina de tu armario y cómo llevarlo.',
  },
  {
    vista: 'comprar', sel: '[data-tour="comprar"]', titulo: 'Lista Por Comprar 🏷️',
    texto: 'Guarda lo que te conviene con foto, precio y enlace. Al comprarlo, toca <b>Marcar como Comprado</b> y pasará solito a tu Armario Virtual.',
  },
  {
    vista: 'armario', sel: '[data-tour="armario"]', titulo: 'Tu Armario Virtual 👗',
    texto: 'Con <b>Agregar inventario inicial</b> registras lo que ya tienes: foto + categoría y Gemini detecta nombre, color y ocasiones. Filtra por 9 categorías, color y ocasión, y pide <b>3 outfits</b> para cualquier ocasión. Con el <b>Estilizador Versátil</b> ves una prenda en los 7 estilos universales.<br><br>💾 Exporta un respaldo .json en Ajustes de vez en cuando y consulta la <a href="#ayuda">Ayuda</a> con 6 ejemplos prácticos. ¡Lista para brillar! 💖',
  },
];

let activo = null;

export function iniciarTour({ irA }) {
  if (activo) activo.cerrar();
  let i = 0;
  const overlay = h(`<div class="tour" role="dialog" aria-modal="true" aria-label="Tour guiado">
    <div class="tour-spot"></div>
    <div class="tour-card">
      <div class="tour-progress"></div>
      <h4 class="tour-title"></h4>
      <div class="tour-text"></div>
      <div class="tour-nav">
        <button class="btn btn-ghost btn-sm" data-t="skip">Salir</button>
        <span>
          <button class="btn btn-soft btn-sm" data-t="prev">← Atrás</button>
          <button class="btn btn-primary btn-sm" data-t="next">Siguiente →</button>
        </span>
      </div>
    </div>
  </div>`);
  document.body.appendChild(overlay);
  document.body.classList.add('tour-open');
  const spot = $('.tour-spot', overlay);
  const card = $('.tour-card', overlay);
  let target = null;

  const posicionar = () => {
    if (!target || !target.isConnected) { spot.style.opacity = 0; card.classList.add('centrado'); return; }
    const r = target.getBoundingClientRect();
    const pad = 8;
    spot.style.opacity = 1;
    Object.assign(spot.style, { top: `${r.top - pad}px`, left: `${r.left - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    card.classList.remove('centrado');
    const vh = window.innerHeight;
    const ch = card.offsetHeight;
    const abajo = r.bottom + pad + 12;
    let top = abajo + ch < vh - 8 ? abajo : r.top - pad - 12 - ch;
    if (top < 8) top = Math.max(8, vh - ch - 90);
    card.style.top = `${top}px`;
  };

  const pintar = () => {
    const p = PASOS[i];
    irA(p.vista);
    setTimeout(() => {
      if (p.abrir) { const d = document.querySelector(p.abrir); if (d) d.open = true; }
      target = document.querySelector(p.sel);
      $('.tour-progress', overlay).innerHTML = PASOS.map((_, k) => `<span class="${k <= i ? 'on' : ''}"></span>`).join('') + `<small>Paso ${i + 1} de ${PASOS.length}</small>`;
      $('.tour-title', overlay).textContent = p.titulo;
      $('.tour-text', overlay).innerHTML = p.texto;
      $('[data-t="prev"]', overlay).disabled = i === 0;
      $('[data-t="next"]', overlay).textContent = i === PASOS.length - 1 ? '¡Terminar! ✓' : 'Siguiente →';
      if (target) {
        const r = target.getBoundingClientRect();
        const y = window.scrollY + r.top - Math.max(80, (window.innerHeight - r.height) / 3);
        window.scrollTo({ top: Math.max(0, y), behavior: 'auto' });
      }
      requestAnimationFrame(posicionar);
      $('[data-t="next"]', overlay).focus({ preventScroll: true });
    }, 60);
  };

  const cerrar = () => {
    window.removeEventListener('resize', posicionar);
    window.removeEventListener('scroll', posicionar, true);
    document.removeEventListener('keydown', teclas);
    overlay.remove();
    document.body.classList.remove('tour-open');
    activo = null;
    try { store.updateSettings({ tourVisto: true }); } catch { /* */ }
  };
  const teclas = (e) => {
    if (e.key === 'Escape') cerrar();
    if (e.key === 'ArrowRight') $('[data-t="next"]', overlay).click();
    if (e.key === 'ArrowLeft' && i > 0) $('[data-t="prev"]', overlay).click();
  };

  overlay.addEventListener('click', (e) => {
    const t = e.target.closest('[data-t]');
    if (e.target.closest('a[href^="#"]')) { cerrar(); return; }
    if (!t) return;
    if (t.dataset.t === 'skip') return cerrar();
    if (t.dataset.t === 'prev' && i > 0) { i--; pintar(); }
    if (t.dataset.t === 'next') {
      if (i < PASOS.length - 1) { i++; pintar(); } else cerrar();
    }
  });
  window.addEventListener('resize', posicionar);
  window.addEventListener('scroll', posicionar, true);
  document.addEventListener('keydown', teclas);
  activo = { cerrar };
  pintar();
}
