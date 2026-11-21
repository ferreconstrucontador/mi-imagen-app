// Integración con la History API para que el botón/gesto "Atrás" del celular
// se comporte como en una app nativa.
//
// Cada modal o el tour abre una "capa": se agrega una entrada al historial con
// la lista de capas abiertas. Al presionar Atrás, el evento popstate cierra la
// capa superior en vez de cambiar de pantalla. Si la capa se cierra desde la
// interfaz (✕, fondo, botón), retrocedemos su entrada sin que el enrutador
// interprete ese retroceso como una navegación.

const capas = []; // [{ id, cerrar, empujada }]
let pendientes = 0; // retrocesos propios en curso (se ignoran en popstate)
let alLiberar = []; // tareas a ejecutar cuando no haya retrocesos en curso
let seguro = null;

export const idsCapas = () => capas.filter((c) => c.empujada).map((c) => c.id);
export const hayCapas = () => capas.length > 0;
export const ocupado = () => pendientes > 0;

function liberar() {
  if (pendientes > 0) return;
  const tareas = alLiberar;
  alLiberar = [];
  tareas.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
}

/** Ejecuta fn cuando terminen los retrocesos propios en curso. */
export function cuandoLibre(fn) {
  if (pendientes === 0) fn();
  else alLiberar.push(fn);
}

/** Retrocede n entradas sin que el enrutador lo trate como navegación. */
export function retroceder(n, despues) {
  if (despues) alLiberar.push(despues);
  if (n <= 0) { liberar(); return; }
  pendientes++;
  history.go(-n);
  // Respaldo por si el navegador no emite popstate (p. ej. sin entradas previas).
  clearTimeout(seguro);
  seguro = setTimeout(() => {
    if (pendientes > 0) { pendientes = 0; liberar(); }
  }, 800);
}

/** Llamar al inicio del manejador popstate. Devuelve true si el evento era propio. */
export function consumirPropio() {
  if (pendientes === 0) return false;
  pendientes--;
  if (pendientes === 0) { clearTimeout(seguro); liberar(); }
  return true;
}

/**
 * Registra una capa (modal, tour…). `cerrarDom` sólo debe quitarla de la pantalla.
 * Devuelve `soltar(despues?)`, que se llama cuando la interfaz la cierra.
 */
export function abrirCapa(cerrarDom) {
  const capa = { id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), cerrar: cerrarDom, empujada: false };
  capas.push(capa);
  // Si hay un retroceso propio en curso, esperamos a que termine antes de empujar.
  cuandoLibre(() => {
    if (!capas.includes(capa)) return;
    capa.empujada = true;
    history.pushState({ ...(history.state || {}), capas: idsCapas() }, '', location.href);
  });
  return function soltar(despues) {
    const i = capas.indexOf(capa);
    if (i < 0) { despues && cuandoLibre(despues); return; }
    capas.splice(i, 1);
    const tope = history.state?.capas;
    if (capa.empujada && Array.isArray(tope) && tope[tope.length - 1] === capa.id) {
      retroceder(1, despues);
    } else if (despues) {
      cuandoLibre(despues);
    }
  };
}

/** Cierra (de arriba hacia abajo) las capas que no estén en `mantener`. Devuelve cuántas cerró. */
export function cerrarCapasExcepto(mantener = []) {
  const set = new Set(mantener);
  let n = 0;
  for (let i = capas.length - 1; i >= 0; i--) {
    const c = capas[i];
    if (!c.empujada || set.has(c.id)) continue;
    capas.splice(i, 1);
    n++;
    try { c.cerrar(); } catch (e) { console.error(e); }
  }
  return n;
}

/** Cierra todas las capas desde la app y retrocede sus entradas; luego ejecuta `despues`. */
export function cerrarTodasLasCapas(despues) {
  const empujadas = capas.filter((c) => c.empujada).length;
  const todas = capas.splice(0, capas.length);
  todas.reverse().forEach((c) => { try { c.cerrar(); } catch (e) { console.error(e); } });
  retroceder(empujadas, despues);
}
