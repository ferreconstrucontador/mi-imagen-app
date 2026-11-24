// Base de datos IndexedDB "MiImagenDB".
//
// · Almacén "imagenes": cada foto como dataURL bajo una clave que indica su ubicación:
//     perfil:selfie · perfil:cuerpo · armario:<id> · porComprar:<id> · historial:<id>
// · Almacén "boveda" (desde la v2): copias internas diarias (Doble Bóveda), clave "AAAA-MM-DD".
//
// Los textos, ajustes, diagnóstico y API Key siguen en localStorage.

const NOMBRE_DB = 'MiImagenDB';
const VERSION_DB = 2;
const ALMACEN = 'imagenes';
const BOVEDA = 'boveda';
const ESPERA_BLOQUEO_MS = 8000;

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
    let espera = null;
    req.onupgradeneeded = () => {
      // Sólo se crean almacenes nuevos: "imagenes" y sus fotos se conservan tal cual.
      const db = req.result;
      if (!db.objectStoreNames.contains(ALMACEN)) db.createObjectStore(ALMACEN);
      if (!db.objectStoreNames.contains(BOVEDA)) db.createObjectStore(BOVEDA);
    };
    req.onsuccess = () => {
      clearTimeout(espera);
      const db = req.result;
      // Si otra pestaña actualiza la base, cerramos para no bloquearla.
      db.onversionchange = () => { db.close(); abriendo = null; };
      resolve(db);
    };
    req.onerror = () => { clearTimeout(espera); reject(req.error || new Error('No se pudo abrir MiImagenDB.')); };
    // Otra pestaña con una versión anterior sigue abierta: normalmente la cierra sola
    // (onversionchange). Esperamos un poco antes de darnos por vencidas.
    req.onblocked = () => {
      espera = setTimeout(() => reject(new Error('MiImagenDB está bloqueada por otra pestaña de MiImagenApp. Ciérrala y vuelve a abrir la app.')), ESPERA_BLOQUEO_MS);
    };
  });
  abriendo.catch(() => { abriendo = null; });
  return abriendo;
}

function transaccion(almacenNombre, modo, fn) {
  return abrir().then((db) => new Promise((resolve, reject) => {
    let tx;
    try { tx = db.transaction(almacenNombre, modo); } catch (e) { reject(e); return; }
    const almacen = tx.objectStore(almacenNombre);
    let resultado;
    const salida = fn(almacen, (r) => { resultado = r; });
    tx.oncomplete = () => resolve(resultado !== undefined ? resultado : salida);
    tx.onerror = () => reject(tx.error || new Error('Error al guardar en MiImagenDB.'));
    tx.onabort = () => reject(tx.error || new Error('Se canceló el guardado en MiImagenDB (¿espacio lleno?).'));
  }));
}

function leerMapa(almacenNombre) {
  return transaccion(almacenNombre, 'readonly', (almacen, listo) => {
    const mapa = new Map();
    const cursor = almacen.openCursor();
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (c) { mapa.set(String(c.key), c.value); c.continue(); } else listo(mapa);
    };
    return mapa;
  });
}

function aplicar(almacenNombre, cambios) {
  if (!cambios.length) return Promise.resolve();
  return transaccion(almacenNombre, 'readwrite', (almacen) => {
    cambios.forEach(([clave, valor]) => {
      if (valor === null || valor === undefined) almacen.delete(clave);
      else almacen.put(valor, clave);
    });
  });
}

// ---------- Fotos ----------
/** Lee todas las fotos: Map<clave, dataURL>. */
export const leerTodas = () => leerMapa(ALMACEN);

/**
 * Aplica cambios en una sola transacción (todo o nada).
 * @param {Array<[string, string|null]>} cambios  valor null = borrar
 */
export const escribir = (cambios) => aplicar(ALMACEN, cambios);

export const vaciar = () => transaccion(ALMACEN, 'readwrite', (almacen) => { almacen.clear(); });

// ---------- Doble Bóveda ----------
/** Todas las copias internas: Map<"AAAA-MM-DD", copia>. */
export const bovedaLeer = () => leerMapa(BOVEDA);
export const bovedaEscribir = (cambios) => aplicar(BOVEDA, cambios);
export const bovedaVaciar = () => transaccion(BOVEDA, 'readwrite', (almacen) => { almacen.clear(); });
