// Doble Bóveda: copias internas automáticas de los últimos 7 días dentro de
// MiImagenDB (almacén "boveda"), independientes del respaldo .json.
//
// · Una copia por día, tomada la primera vez que se abre la app ese día: guarda
//   cómo estaban los datos ANTES de los cambios del día (sirve para deshacer).
// · Incluye perfil, diagnóstico, ajustes, armario, lista Por Comprar e historial.
//   Nunca incluye la API Key.
// · Las fotos se guardan reducidas (320 px) para no saturar el almacenamiento;
//   las que no cambiaron se reutilizan de la copia anterior. Al restaurar, si la
//   foto original sigue en el dispositivo se usa en tamaño completo.
import { store } from './store.js';
import * as idb from './imagedb.js';
import { compressImage } from './image.js';

export const MAX_COPIAS = 7;
const MINI = { maxWidth: 320, quality: 0.6 };
const REF = 'idb:';

/** Fecha local "AAAA-MM-DD". */
export function fechaLocal(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Huella rápida de una foto para saber si cambió (longitud + final del dataURL).
const firma = (v) => `${v.length}:${v.slice(-48)}`;

let enCurso = null;

/**
 * Toma la copia del día si aún no existe.
 * @returns {Promise<'creada'|'existe'|'vacia'|'sin-idb'|'error'>}
 */
export function copiaDiaria({ forzar = false } = {}) {
  if (!store.usaIndexedDB()) return Promise.resolve('sin-idb');
  if (enCurso) return enCurso;
  enCurso = (async () => {
    const clave = fechaLocal();
    const copias = await idb.bovedaLeer();
    if (copias.has(clave) && !forzar) return 'existe';
    if (!store.tieneDatos()) return 'vacia';
    await store.esperarFotos();
    const { data, fotos } = store.copiaParaBoveda();

    // Miniaturas ya calculadas en copias anteriores (por huella de la foto).
    const previas = new Map();
    copias.forEach((c) => Object.values(c.fotos || {}).forEach((f) => { if (f?.firma && f.mini) previas.set(f.firma, f.mini); }));
    const fotosCopia = {};
    for (const [k, v] of fotos) {
      const f = firma(v);
      let mini = previas.get(f);
      if (!mini) {
        try { mini = await compressImage(v, MINI); } catch { continue; }
      }
      fotosCopia[k] = { firma: f, mini };
    }
    const copia = {
      fecha: clave,
      creada: new Date().toISOString(),
      version: self.MIIMAGEN_VERSION || '',
      resumen: {
        prendas: data.armario.length,
        porComprar: data.porComprar.length,
        historial: data.historial.length,
        diagnostico: !!data.diagnostico,
        estacion: data.diagnostico?.data?.colorimetria?.estacion || '',
        fotos: Object.keys(fotosCopia).length,
      },
      data,
      fotos: fotosCopia,
    };
    // Conservamos sólo las 7 copias más recientes.
    const sobran = [...new Set([...copias.keys(), clave])].sort().reverse().slice(MAX_COPIAS);
    await idb.bovedaEscribir([[clave, copia], ...sobran.map((k) => [k, null])]);
    return 'creada';
  })().catch((e) => {
    console.warn('No se pudo crear la copia interna', e);
    return 'error';
  }).finally(() => { enCurso = null; });
  return enCurso;
}

/** Copias disponibles, de la más reciente a la más antigua. */
export async function listarCopias() {
  if (!store.usaIndexedDB()) return [];
  const copias = await idb.bovedaLeer();
  return [...copias.values()]
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
    .map((c) => ({ fecha: c.fecha, creada: c.creada, version: c.version, resumen: c.resumen || {}, tamano: JSON.stringify(c).length }));
}

/**
 * Reemplaza los datos actuales por los de una copia. La API Key se conserva.
 * @returns {Promise<{reducidas:number}>} cuántas fotos se recuperaron en tamaño reducido
 */
export async function restaurarCopia(fecha) {
  const copias = await idb.bovedaLeer();
  const c = copias.get(fecha);
  if (!c) throw new Error('Esa copia interna ya no existe.');
  // Fotos actuales en tamaño completo, por huella.
  const completas = new Map();
  store.fotosActuales().forEach((v) => completas.set(firma(v), v));
  let reducidas = 0;
  const foto = (ref) => {
    if (typeof ref !== 'string' || !ref.startsWith(REF)) return ref;
    const f = c.fotos?.[ref.slice(REF.length)];
    if (!f) return '';
    const completa = completas.get(f.firma);
    if (completa) return completa;
    reducidas++;
    return f.mini;
  };
  const data = JSON.parse(JSON.stringify(c.data));
  data.profile = { ...data.profile, selfie: foto(data.profile?.selfie), cuerpo: foto(data.profile?.cuerpo) };
  data.armario = (data.armario || []).map((it) => ({ ...it, foto: foto(it.foto) }));
  data.porComprar = (data.porComprar || []).map((it) => ({ ...it, foto: foto(it.foto) }));
  data.historial = (data.historial || []).map((h) => (h.thumb ? { ...h, thumb: foto(h.thumb) } : h));
  await store.importar({ data });
  store.marcarActividad(); // hay cambios respecto al último respaldo .json
  return { reducidas };
}
