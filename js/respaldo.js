// Respaldo .json y aviso inteligente para exportarlo.
//
// · El archivo se llama "miimagen-respaldo-AAAA-MM-DD.json" y NUNCA incluye la API Key.
// · El aviso aparece como máximo una vez cada 24 h y sólo si hubo actividad
//   (cambios en perfil, diagnóstico, armario, lista o historial) desde el último respaldo.
import { store } from './store.js';
import { descargar, toast, esc } from './ui.js';
import { fechaLocal } from './boveda.js';

const DIA_MS = 24 * 60 * 60 * 1000;

export const nombreArchivo = () => `miimagen-respaldo-${fechaLocal()}.json`;

/** Descarga el respaldo .json (sin API Key) y registra la fecha. */
export function exportarRespaldo() {
  const data = store.exportar();
  descargar(nombreArchivo(), JSON.stringify(data, null, 2));
  store.marcarRespaldo();
  quitarAviso();
  toast('Respaldo descargado ✓ (sin tu API Key, por seguridad)', 'ok');
  document.dispatchEvent(new CustomEvent('mia:respaldo'));
}

/** ¿Toca recordar el respaldo? */
export function debeRecordar(ahora = Date.now()) {
  if (!store.tieneDatos()) return false;
  const m = store.meta();
  if (!m.actividad) return false;
  if (m.respaldo && Date.parse(m.actividad) <= Date.parse(m.respaldo)) return false;
  if (m.aviso && ahora - Date.parse(m.aviso) < DIA_MS) return false;
  return true;
}

/**
 * Llamar al iniciar la app y al volver a ella.
 * La primera vez tras actualizar, si ya hay datos pero nunca se registró
 * actividad ni respaldo, los contamos como "sin respaldar".
 */
export function revisarRecordatorio() {
  const m = store.meta();
  if (!m.actividad && !m.respaldo && store.tieneDatos()) store.marcarActividad();
  if (!debeRecordar() || document.getElementById('aviso-respaldo')) return;
  store.marcarAviso();
  const desde = store.meta().respaldo;
  const texto = desde
    ? `Tienes cambios sin respaldar desde el ${new Date(desde).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}.`
    : 'Aún no has descargado un respaldo de tus datos.';
  const el = document.createElement('div');
  el.id = 'aviso-respaldo';
  el.className = 'aviso-banda';
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <span class="aviso-ico" aria-hidden="true">💾</span>
    <span class="aviso-txt">${esc(texto)} Guarda tu respaldo .json para no perder nada.</span>
    <button type="button" class="btn btn-sm btn-primary" data-a="exportar">Exportar</button>
    <button type="button" class="icon-btn" data-a="cerrar" aria-label="Recordármelo mañana">✕</button>`;
  el.querySelector('[data-a="exportar"]').addEventListener('click', () => {
    try { exportarRespaldo(); } catch (e) { toast(e.message || 'No se pudo exportar.', 'error'); }
  });
  el.querySelector('[data-a="cerrar"]').addEventListener('click', quitarAviso);
  contenedorAvisos().appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
}

function quitarAviso() {
  const el = document.getElementById('aviso-respaldo');
  if (!el) return;
  el.classList.remove('show');
  setTimeout(() => el.remove(), 250);
}

/** Contenedor fijo (sobre la barra inferior) para avisos discretos. */
export function contenedorAvisos() {
  let c = document.getElementById('avisos');
  if (!c) {
    c = document.createElement('div');
    c.id = 'avisos';
    c.className = 'avisos';
    document.body.appendChild(c);
  }
  return c;
}
