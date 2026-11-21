// Almacén de fotografías en IndexedDB ("MiImagenDB").
// Cada foto se guarda como dataURL bajo una clave que indica su ubicación:
//   perfil:selfie · perfil:cuerpo · armario:<id> · porComprar:<id> · historial:<id>
// Los textos, ajustes, diagnóstico y API Key siguen en localStorage.

const NOMBRE_DB = 'MiImagenDB';
const VERSION_DB = 1;
const ALMACEN = 'imagenes';

let abriendo = null;

export function disponible() {
  try { return typeof indexedDB !== 'undefined' && !!indexedDB; } catch { return false; }
}

export function abrir() {
  if (abriendo) return abriendo;
  abriendo = new Promise((resolve, reject) => {
    if (!disponible()) { reject(new Error('IndexedDB no está disponible en este navegador.')); return; }
    let req;
    try { req = indexedDB.open(NOMBRE_DB, VERSION_DB); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ALMACEN)) db.createObjectStore(ALMACEN);
    };
    req.onsuccess = () => {
      const db = req.result;
      // Si otra pestaña actualiza la base, cerramos para no bloquearla.
      db.onversionchange = () => { db.close(); abriendo = null; };
      resolve(db);
    };
    req.onerror = () => reject(req.error || new Error('No se pudo abrir MiImagenDB.'));
    req.onblocked = () => reject(new Error('MiImagenDB está bloqueada por otra pestaña abierta.'));
  });
  abriendo.catch(() => { abriendo = null; });
  return abriendo;
}

function transaccion(modo, fn) {
  return abrir().then((db) => new Promise((resolve, reject) => {
    let tx;
    try { tx = db.transaction(ALMACEN, modo); } catch (e) { reject(e); return; }
    const almacen = tx.objectStore(ALMACEN);
    let resultado;
    const salida = fn(almacen, (r) => { resultado = r; });
    tx.oncomplete = () => resolve(resultado !== undefined ? resultado : salida);
    tx.onerror = () => reject(tx.error || new Error('Error al guardar en MiImagenDB.'));
    tx.onabort = () => reject(tx.error || new Error('Se canceló el guardado en MiImagenDB (¿espacio lleno?).'));
  }));
}

/** Lee todas las fotos: Map<clave, dataURL>. */
export function leerTodas() {
  return transaccion('readonly', (almacen, listo) => {
    const mapa = new Map();
    const cursor = almacen.openCursor();
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (c) { mapa.set(String(c.key), c.value); c.continue(); } else listo(mapa);
    };
    return mapa;
  });
}

/**
 * Aplica cambios en una sola transacción (todo o nada).
 * @param {Array<[string, string|null]>} cambios  valor null = borrar
 */
export function escribir(cambios) {
  if (!cambios.length) return Promise.resolve();
  return transaccion('readwrite', (almacen) => {
    cambios.forEach(([clave, valor]) => {
      if (valor === null || valor === undefined) almacen.delete(clave);
      else almacen.put(valor, clave);
    });
  });
}

export function vaciar() {
  return transaccion('readwrite', (almacen) => { almacen.clear(); });
}
