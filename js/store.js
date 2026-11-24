// Persistencia de MiImagenApp.
//
// · Textos, ajustes, diagnóstico y API Key → localStorage (una llave por bloque).
// · Fotografías (selfie, cuerpo, armario, por comprar, miniaturas del historial)
//   → IndexedDB "MiImagenDB" (ver imagedb.js).
//
// En memoria cada foto sigue siendo un dataURL, así las vistas no cambian. Al
// guardar, la foto se reemplaza en localStorage por una referencia "idb:<clave>"
// y el dataURL se escribe en IndexedDB. Al iniciar se reconstruye el estado.
// Si IndexedDB no está disponible, las fotos se quedan en localStorage como antes.
import { APP_NAME, DATA_VERSION, DEFAULT_MODEL, CATEGORIAS, COLORES, OCASIONES } from './constants.js';
import * as idb from './imagedb.js';

const PREFIX = 'miimagen.';
const KEYS = {
  profile: PREFIX + 'perfil',
  diagnostico: PREFIX + 'diagnostico',
  porComprar: PREFIX + 'porComprar',
  armario: PREFIX + 'armario',
  historial: PREFIX + 'historial',
  apiKey: PREFIX + 'apiKey',
  settings: PREFIX + 'ajustes',
};
const PARTES = ['profile', 'diagnostico', 'porComprar', 'armario', 'historial', 'settings', 'apiKey'];
// Bloques con datos de la usuaria (sus cambios cuentan como "actividad" para el aviso de respaldo).
const PARTES_DATOS = ['profile', 'diagnostico', 'porComprar', 'armario', 'historial'];
// Metadatos del recordatorio de respaldo (fechas ISO).
const META = {
  actividad: PREFIX + 'ultimaActividad',
  respaldo: PREFIX + 'ultimoRespaldo',
  aviso: PREFIX + 'ultimoAvisoRespaldo',
};

// Bloques que contienen fotos y prefijo de sus claves en IndexedDB.
const PARTES_FOTOS = { profile: 'perfil', armario: 'armario', porComprar: 'porComprar', historial: 'historial' };
const REF = 'idb:';

const MAX_HISTORIAL = 40;

export const defaults = () => ({
  profile: {
    nombre: '',
    selfie: '',
    cuerpo: '',
    estatura: '',
    edad: '',
    estilos: [],
    ciudad: '',
    clima: '',
    notas: '',
    actualizado: null,
  },
  diagnostico: null, // { fecha, modelo, data }
  porComprar: [],
  armario: [],
  historial: [],
  apiKey: '',
  settings: { modelo: DEFAULT_MODEL, tourVisto: false, apiKeyValidada: false },
});

const listeners = new Set();

const esFoto = (v) => typeof v === 'string' && v.startsWith('data:image');
const fotoValida = (v) => (esFoto(v) ? v : '');

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

const validIds = (lista) => new Set(lista.map((x) => x.id));
const CAT_IDS = validIds(CATEGORIAS);
const COLOR_IDS = validIds(COLORES);
const OCA_IDS = validIds(OCASIONES);

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function normItem(it, origen) {
  if (!it || typeof it !== 'object') return null;
  return {
    id: String(it.id || uid()),
    foto: fotoValida(it.foto),
    nombre: String(it.nombre || 'Artículo sin nombre'),
    descripcion: String(it.descripcion || ''),
    categoria: CAT_IDS.has(it.categoria) ? it.categoria : 'joyeria',
    color: COLOR_IDS.has(it.color) ? it.color : 'multicolor',
    ocasiones: Array.isArray(it.ocasiones) ? it.ocasiones.filter((o) => OCA_IDS.has(o)) : [],
    url: String(it.url || ''),
    precio: it.precio === 0 || it.precio ? String(it.precio) : '',
    puntuacion: Number.isFinite(+it.puntuacion) && it.puntuacion !== '' && it.puntuacion !== null ? +it.puntuacion : null,
    veredicto: it.veredicto && typeof it.veredicto === 'object' ? it.veredicto : null,
    origen: it.origen || origen,
    fecha: it.fecha || new Date().toISOString(),
    fechaCompra: it.fechaCompra || null,
  };
}

/** Normaliza cualquier estructura (local o importada) a la forma vigente. */
export function normalize(raw) {
  const d = defaults();
  const src = raw && typeof raw === 'object' ? raw : {};
  const p = { ...d.profile, ...(src.profile || {}) };
  p.estilos = Array.isArray(p.estilos) ? p.estilos.map(String) : [];
  p.selfie = fotoValida(p.selfie);
  p.cuerpo = fotoValida(p.cuerpo);
  const diag = src.diagnostico && typeof src.diagnostico === 'object' && src.diagnostico.data ? src.diagnostico : null;
  // Las IDs repetidas compartirían foto en IndexedDB: les damos una nueva.
  const unicos = (lista) => {
    const vistos = new Set();
    return lista.map((x) => {
      if (vistos.has(x.id)) x = { ...x, id: uid() };
      vistos.add(x.id);
      return x;
    });
  };
  return {
    profile: p,
    diagnostico: diag,
    porComprar: unicos((Array.isArray(src.porComprar) ? src.porComprar : []).map((x) => normItem(x, 'evaluacion')).filter(Boolean)),
    armario: unicos((Array.isArray(src.armario) ? src.armario : []).map((x) => normItem(x, 'inventario')).filter(Boolean)),
    historial: unicos((Array.isArray(src.historial) ? src.historial : [])
      .filter((h) => h && typeof h === 'object' && h.tipo)
      .map((h) => ({ ...h, id: String(h.id || uid()), thumb: fotoValida(h.thumb) })))
      .slice(0, MAX_HISTORIAL),
    apiKey: typeof src.apiKey === 'string' ? src.apiKey.trim() : '',
    settings: { ...d.settings, ...(src.settings || {}) },
  };
}

// ------------------------------------------------------------------
// Fotos: separar (memoria → localStorage + IndexedDB) e hidratar (al revés)
// ------------------------------------------------------------------

/** Devuelve { copia, fotos } donde copia lleva referencias y fotos es Map<clave, dataURL>. */
function separar(part, valor) {
  const fotos = new Map();
  const pre = PARTES_FOTOS[part];
  const ref = (clave, v) => {
    if (!esFoto(v)) return v && String(v).startsWith(REF) ? '' : v; // referencias huérfanas fuera
    fotos.set(clave, v);
    return REF + clave;
  };
  let copia = valor;
  if (part === 'profile') {
    copia = { ...valor, selfie: ref(`${pre}:selfie`, valor.selfie), cuerpo: ref(`${pre}:cuerpo`, valor.cuerpo) };
  } else if (part === 'armario' || part === 'porComprar') {
    copia = valor.map((it) => ({ ...it, foto: ref(`${pre}:${it.id}`, it.foto) }));
  } else if (part === 'historial') {
    copia = valor.map((h) => (h.thumb ? { ...h, thumb: ref(`${pre}:${h.id}`, h.thumb) } : h));
  }
  return { copia, fotos };
}

/** Reemplaza referencias "idb:<clave>" por el dataURL guardado. Devuelve cuántas faltaron. */
function hidratar(part, valor, mapa) {
  let faltan = 0;
  const v = (x) => {
    if (typeof x !== 'string' || !x.startsWith(REF)) return x;
    const dato = mapa.get(x.slice(REF.length));
    if (!dato) faltan++;
    return dato || '';
  };
  if (!valor || typeof valor !== 'object') return { valor, faltan };
  if (part === 'profile') return { valor: { ...valor, selfie: v(valor.selfie), cuerpo: v(valor.cuerpo) }, faltan };
  if (!Array.isArray(valor)) return { valor, faltan };
  if (part === 'historial') return { valor: valor.map((h) => (h && h.thumb ? { ...h, thumb: v(h.thumb) } : h)), faltan };
  return { valor: valor.map((it) => (it && it.foto ? { ...it, foto: v(it.foto) } : it)), faltan };
}

// ------------------------------------------------------------------
// Estado y persistencia
// ------------------------------------------------------------------
let state = defaults(); // se llena en store.iniciar()
let usarIDB = false;
const enIDB = new Map(); // clave → dataURL que ya está (o va a estar) en IndexedDB
let cola = Promise.resolve(); // escrituras en IndexedDB, en orden

export class QuotaError extends Error {
  constructor() {
    super('Tu almacenamiento está lleno. Elimina algunas fotos o artículos, o exporta un respaldo y limpia el historial.');
    this.name = 'QuotaError';
  }
}

const esCuota = (e) => e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);

function escribirLocal(part, valor) {
  try {
    if (part === 'apiKey') localStorage.setItem(KEYS.apiKey, valor || '');
    else localStorage.setItem(KEYS[part], JSON.stringify(valor));
  } catch (e) {
    if (esCuota(e)) throw new QuotaError();
    throw e;
  }
}

/** Diferencias entre las fotos actuales de un bloque y lo que hay en IndexedDB. */
function diferencias(part, fotos) {
  const pre = PARTES_FOTOS[part] + ':';
  const poner = [];
  const borrar = [];
  fotos.forEach((v, k) => { if (enIDB.get(k) !== v) poner.push([k, v]); });
  enIDB.forEach((_, k) => { if (k.startsWith(pre) && !fotos.has(k)) borrar.push([k, null]); });
  return { poner, borrar };
}

function encolar(cambios) {
  if (!cambios.length) return cola;
  cambios.forEach(([k, v]) => (v === null ? enIDB.delete(k) : enIDB.set(k, v)));
  cola = cola.then(() => idb.escribir(cambios)).catch((e) => falloIDB(e));
  return cola;
}

/**
 * Si IndexedDB falla al guardar, volvemos a guardar las fotos dentro de
 * localStorage (como en versiones anteriores) para no perder ninguna.
 */
function falloIDB(e) {
  console.error('MiImagenDB', e);
  if (!usarIDB) return;
  usarIDB = false;
  let aviso = 'No se pudieron guardar las fotos en la base de datos del navegador; se guardaron en el almacenamiento básico.';
  for (const part of Object.keys(PARTES_FOTOS)) {
    try { escribirLocal(part, conservarRefs(part, state[part])); } catch (err) {
      aviso = 'No hay espacio suficiente para guardar tus fotos. Exporta un respaldo y elimina algunas fotos.';
    }
  }
  document.dispatchEvent(new CustomEvent('mia:aviso-almacenamiento', { detail: aviso }));
}

/**
 * Referencias "idb:<clave>" que no se pudieron cargar porque MiImagenDB no abrió
 * (p. ej. bloqueada). Se conservan al guardar para no perder esas fotos: siguen
 * en IndexedDB y volverán a verse cuando la base abra.
 */
const refsSinCargar = new Set();

function conservarRefs(part, valor) {
  if (!refsSinCargar.size || !PARTES_FOTOS[part]) return valor;
  const pre = PARTES_FOTOS[part];
  const r = (clave, v) => (!v && refsSinCargar.has(clave) ? REF + clave : v);
  if (part === 'profile') return { ...valor, selfie: r(`${pre}:selfie`, valor.selfie), cuerpo: r(`${pre}:cuerpo`, valor.cuerpo) };
  if (part === 'historial') return valor.map((h) => ({ ...h, thumb: r(`${pre}:${h.id}`, h.thumb) }));
  return valor.map((it) => ({ ...it, foto: r(`${pre}:${it.id}`, it.foto) }));
}

/** Guardado normal (síncrono para el texto, fotos en segundo plano). */
function persist(part) {
  if (usarIDB && PARTES_FOTOS[part]) {
    const { copia, fotos } = separar(part, state[part]);
    escribirLocal(part, copia);
    const { poner, borrar } = diferencias(part, fotos);
    encolar([...poner, ...borrar]);
  } else {
    escribirLocal(part, conservarRefs(part, state[part]));
  }
}

function leerMeta(nombre) {
  try { return localStorage.getItem(META[nombre]) || null; } catch { return null; }
}
function escribirMeta(nombre, valor) {
  try {
    if (valor) localStorage.setItem(META[nombre], valor);
    else localStorage.removeItem(META[nombre]);
  } catch { /* metadatos opcionales */ }
}

/**
 * Guardado seguro: primero las fotos en IndexedDB y, sólo cuando quedaron
 * guardadas, el texto con referencias en localStorage. Se usa al migrar e importar.
 */
async function persistSeguro(part) {
  if (!(usarIDB && PARTES_FOTOS[part])) { escribirLocal(part, conservarRefs(part, state[part])); return 0; }
  const { copia, fotos } = separar(part, state[part]);
  const { poner, borrar } = diferencias(part, fotos);
  await cola;
  await idb.escribir(poner); // si falla, lanza y localStorage queda como estaba
  poner.forEach(([k, v]) => enIDB.set(k, v));
  escribirLocal(part, copia);
  if (borrar.length) await encolar(borrar);
  return poner.length;
}

function emit(part) {
  listeners.forEach((fn) => {
    try { fn(part, state); } catch (e) { console.error(e); }
  });
}

export const store = {
  get: () => state,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  usaIndexedDB: () => usarIDB,

  /**
   * Carga el estado. La primera vez tras la actualización mueve a IndexedDB las
   * fotos que estaban dentro de localStorage. Devuelve { migradas, faltantes }.
   */
  async iniciar() {
    let mapa = new Map();
    try {
      await idb.abrir();
      mapa = await idb.leerTodas();
      usarIDB = true;
    } catch (e) {
      console.warn('IndexedDB no disponible; las fotos se quedan en localStorage.', e);
      usarIDB = false;
    }
    const d = defaults();
    const crudo = {
      profile: readJSON(KEYS.profile, d.profile),
      diagnostico: readJSON(KEYS.diagnostico, null),
      porComprar: readJSON(KEYS.porComprar, []),
      armario: readJSON(KEYS.armario, []),
      historial: readJSON(KEYS.historial, []),
      settings: readJSON(KEYS.settings, d.settings),
      apiKey: '',
    };
    try { crudo.apiKey = localStorage.getItem(KEYS.apiKey) || ''; } catch { /* sin acceso */ }
    let faltantes = 0;
    refsSinCargar.clear();
    Object.keys(PARTES_FOTOS).forEach((part) => {
      if (!usarIDB) {
        // La base no abrió: recordamos sus referencias para no borrarlas al guardar.
        for (const m of JSON.stringify(crudo[part] ?? '').matchAll(/"idb:([^"]+)"/g)) refsSinCargar.add(m[1]);
      }
      const r = hidratar(part, crudo[part], mapa);
      crudo[part] = r.valor;
      faltantes += r.faltan;
    });
    const fotosNoDisponibles = refsSinCargar.size;
    if (fotosNoDisponibles) faltantes = 0; // no faltan: están en MiImagenDB, que no se pudo abrir
    state = normalize(crudo);
    mapa.forEach((v, k) => enIDB.set(k, v));

    let migradas = 0;
    if (usarIDB) {
      for (const part of Object.keys(PARTES_FOTOS)) {
        let texto = '';
        try { texto = localStorage.getItem(KEYS[part]) || ''; } catch { /* */ }
        // Migración: el bloque todavía guarda fotos dentro de localStorage.
        if (texto.includes('"data:image')) {
          try {
            migradas += await persistSeguro(part);
          } catch (e) {
            console.error('No se pudo migrar', part, e);
            usarIDB = false; // seguimos como antes, sin perder nada
            break;
          }
        }
      }
      // Limpieza de fotos huérfanas (de artículos que ya no existen).
      if (usarIDB) {
        const vivas = new Set();
        Object.keys(PARTES_FOTOS).forEach((part) => separar(part, state[part]).fotos.forEach((_, k) => vivas.add(k)));
        const huerfanas = [...enIDB.keys()].filter((k) => !vivas.has(k)).map((k) => [k, null]);
        encolar(huerfanas);
      }
    }
    return { migradas, faltantes, fotosNoDisponibles };
  },

  /** Espera a que terminen de guardarse las fotos pendientes. */
  esperarFotos: () => cola,

  /** Actualiza un bloque. Si no cabe, revierte y lanza QuotaError. */
  set(part, value) {
    const previo = state[part];
    state = { ...state, [part]: value };
    try {
      persist(part);
    } catch (e) {
      state = { ...state, [part]: previo };
      throw e;
    }
    if (PARTES_DATOS.includes(part)) this.marcarActividad();
    emit(part);
  },

  // ---------- Recordatorio de respaldo ----------
  /** Fechas ISO (o null) de la última actividad, el último respaldo .json y el último aviso. */
  meta: () => ({ actividad: leerMeta('actividad'), respaldo: leerMeta('respaldo'), aviso: leerMeta('aviso') }),
  marcarActividad() { escribirMeta('actividad', new Date().toISOString()); },
  marcarRespaldo() { escribirMeta('respaldo', new Date().toISOString()); },
  marcarAviso() { escribirMeta('aviso', new Date().toISOString()); },

  /** ¿Hay algo que valga la pena respaldar? */
  tieneDatos() {
    const s = state;
    return !!(s.profile.selfie || s.profile.ciudad || s.profile.nombre || s.diagnostico || s.armario.length || s.porComprar.length || s.historial.length);
  },

  // ---------- Doble Bóveda ----------
  /**
   * Copia de los datos para la bóveda: textos con referencias "idb:<clave>" y,
   * aparte, las fotos actuales (Map<clave, dataURL>) para que la bóveda las reduzca.
   */
  copiaParaBoveda() {
    const data = {};
    const fotos = new Map();
    ['profile', 'diagnostico', 'porComprar', 'armario', 'historial', 'settings'].forEach((part) => {
      if (PARTES_FOTOS[part]) {
        const r = separar(part, state[part]);
        data[part] = r.copia;
        r.fotos.forEach((v, k) => fotos.set(k, v));
      } else {
        data[part] = state[part];
      }
    });
    return { data: JSON.parse(JSON.stringify(data)), fotos };
  },

  /** Fotos actuales en tamaño completo: Map<clave, dataURL>. */
  fotosActuales() {
    const fotos = new Map();
    Object.keys(PARTES_FOTOS).forEach((part) => separar(part, state[part]).fotos.forEach((v, k) => fotos.set(k, v)));
    return fotos;
  },

  updateProfile(patch) {
    this.set('profile', { ...state.profile, ...patch, actualizado: new Date().toISOString() });
  },
  updateSettings(patch) {
    this.set('settings', { ...state.settings, ...patch });
  },

  addHistorial(entry) {
    const h = [{ id: uid(), fecha: new Date().toISOString(), ...entry }, ...state.historial].slice(0, MAX_HISTORIAL);
    try {
      this.set('historial', h);
    } catch (e) {
      // Si no cabe, recortamos el historial más antiguo antes de rendirnos.
      try { this.set('historial', h.slice(0, 10)); } catch { /* historial opcional */ }
    }
  },

  addArmario(item) {
    const it = normItem(item, 'inventario');
    this.set('armario', [it, ...state.armario]);
    return it;
  },
  updateArmario(id, patch) {
    this.set('armario', state.armario.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  },
  removeArmario(id) {
    this.set('armario', state.armario.filter((x) => x.id !== id));
  },

  addPorComprar(item) {
    const it = normItem(item, 'evaluacion');
    this.set('porComprar', [it, ...state.porComprar]);
    return it;
  },
  updatePorComprar(id, patch) {
    this.set('porComprar', state.porComprar.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  },
  removePorComprar(id) {
    this.set('porComprar', state.porComprar.filter((x) => x.id !== id));
  },
  /** Mueve un artículo de "Por Comprar" al Armario Virtual. */
  marcarComprado(id) {
    const it = state.porComprar.find((x) => x.id === id);
    if (!it) return null;
    const nuevo = { ...it, origen: 'compra', fechaCompra: new Date().toISOString() };
    this.set('armario', [nuevo, ...state.armario]);
    try {
      this.set('porComprar', state.porComprar.filter((x) => x.id !== id));
    } catch (e) {
      this.set('armario', state.armario.filter((x) => x.id !== id));
      throw e;
    }
    return nuevo;
  },

  // ---------- Respaldos ----------
  /**
   * Las fotos viajan dentro del .json como dataURL (mismo formato que v1.0–v1.3),
   * así un respaldo nuevo también se puede abrir en versiones anteriores.
   * Por seguridad la API Key de Gemini NUNCA se incluye (se queda sólo en el dispositivo).
   */
  exportar() {
    const s = state;
    return {
      app: APP_NAME,
      version: DATA_VERSION,
      exportado: new Date().toISOString(),
      data: {
        profile: s.profile,
        diagnostico: s.diagnostico,
        porComprar: s.porComprar,
        armario: s.armario,
        historial: s.historial,
        settings: s.settings,
        apiKey: '',
      },
    };
  },

  /** Importa un respaldo (de cualquier versión). Primero guarda las fotos y luego el texto. */
  async importar(json) {
    if (!json || typeof json !== 'object') throw new Error('El archivo no tiene un formato válido.');
    // Acepta el formato con envoltura { app, version, data } o el contenido directo.
    const data = json.data && typeof json.data === 'object' ? json.data : json;
    const conocidas = ['profile', 'diagnostico', 'porComprar', 'armario', 'historial'];
    if (!conocidas.some((k) => k in data)) throw new Error('Este archivo no parece un respaldo de MiImagenApp.');
    // La API Key configurada en el dispositivo se conserva; la del archivo sólo se usa si no hay ninguna.
    const n = normalize({ ...data, apiKey: state.apiKey || data.apiKey });
    const respaldo = { ...state };
    refsSinCargar.clear(); // los datos importados mandan
    try {
      state = { ...state, ...Object.fromEntries(PARTES.map((k) => [k, n[k]])) };
      for (const k of PARTES) await persistSeguro(k);
    } catch (e) {
      state = respaldo;
      for (const k of PARTES) { try { await persistSeguro(k); } catch { /* mejor esfuerzo */ } }
      if (esCuota(e) || e?.name === 'AbortError') throw new QuotaError();
      throw e;
    }
    emit('all');
    return n;
  },

  /** Borra fotos, datos, copias internas (bóveda) y API Key de este dispositivo. */
  async borrarTodo() {
    [...Object.values(KEYS), ...Object.values(META)].forEach((k) => { try { localStorage.removeItem(k); } catch { /* */ } });
    state = defaults();
    enIDB.clear();
    refsSinCargar.clear();
    if (usarIDB) {
      cola = cola.then(() => idb.vaciar()).then(() => idb.bovedaVaciar()).catch((e) => console.error(e));
    }
    emit('all');
    await cola;
  },

  /**
   * Información de almacenamiento para Ajustes.
   * usado/cuota vienen de navigator.storage.estimate() (null si el navegador no lo reporta).
   */
  async infoAlmacenamiento() {
    await cola; // que el cálculo incluya las fotos recién guardadas
    let texto = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX)) texto += (k.length + (localStorage.getItem(k) || '').length) * 2; // UTF-16
      }
    } catch { /* */ }
    let fotos = 0;
    let nFotos = 0;
    Object.keys(PARTES_FOTOS).forEach((part) => separar(part, state[part]).fotos.forEach((v) => { nFotos++; fotos += v.length; }));
    let usado = null;
    let cuota = null;
    let persistente = null;
    try {
      if (navigator.storage?.estimate) {
        const est = await navigator.storage.estimate();
        if (Number.isFinite(est.usage)) usado = est.usage;
        if (Number.isFinite(est.quota) && est.quota > 0) cuota = est.quota;
      }
      if (navigator.storage?.persisted) persistente = await navigator.storage.persisted();
    } catch { /* el navegador no lo permite */ }
    return { usado, cuota, persistente, texto, fotos, nFotos, indexedDB: usarIDB };
  },

  /** Pide al navegador no borrar los datos automáticamente cuando falte espacio. */
  async protegerAlmacenamiento() {
    try { return navigator.storage?.persist ? await navigator.storage.persist() : false; } catch { return false; }
  },
};
