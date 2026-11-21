// Persistencia total en localStorage. Cada bloque vive en su propia llave
// para que un error de cuota en un bloque no corrompa los demás.
import { APP_NAME, DATA_VERSION, DEFAULT_MODEL, CATEGORIAS, COLORES, OCASIONES } from './constants.js';

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
let state = load();

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function load() {
  const d = defaults();
  let apiKey = '';
  try { apiKey = localStorage.getItem(KEYS.apiKey) || ''; } catch { /* sin acceso */ }
  return normalize({
    profile: readJSON(KEYS.profile, d.profile),
    diagnostico: readJSON(KEYS.diagnostico, null),
    porComprar: readJSON(KEYS.porComprar, []),
    armario: readJSON(KEYS.armario, []),
    historial: readJSON(KEYS.historial, []),
    apiKey,
    settings: readJSON(KEYS.settings, d.settings),
  });
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
    foto: typeof it.foto === 'string' ? it.foto : '',
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
  const diag = src.diagnostico && typeof src.diagnostico === 'object' && src.diagnostico.data ? src.diagnostico : null;
  return {
    profile: p,
    diagnostico: diag,
    porComprar: (Array.isArray(src.porComprar) ? src.porComprar : []).map((x) => normItem(x, 'evaluacion')).filter(Boolean),
    armario: (Array.isArray(src.armario) ? src.armario : []).map((x) => normItem(x, 'inventario')).filter(Boolean),
    historial: (Array.isArray(src.historial) ? src.historial : []).filter((h) => h && h.tipo).slice(0, MAX_HISTORIAL),
    apiKey: typeof src.apiKey === 'string' ? src.apiKey.trim() : '',
    settings: { ...d.settings, ...(src.settings || {}) },
  };
}

export class QuotaError extends Error {
  constructor() {
    super('Tu almacenamiento local está lleno. Elimina algunas fotos o artículos, o exporta un respaldo y limpia el historial.');
    this.name = 'QuotaError';
  }
}

function persist(part) {
  try {
    if (part === 'apiKey') {
      localStorage.setItem(KEYS.apiKey, state.apiKey || '');
    } else {
      localStorage.setItem(KEYS[part], JSON.stringify(state[part]));
    }
  } catch (e) {
    if (e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014)) throw new QuotaError();
    throw e;
  }
}

function emit(part) {
  listeners.forEach((fn) => {
    try { fn(part, state); } catch (e) { console.error(e); }
  });
}

export const store = {
  get: () => state,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  /** Actualiza un bloque. Si no cabe en localStorage, revierte y lanza QuotaError. */
  set(part, value) {
    const previo = state[part];
    state = { ...state, [part]: value };
    try {
      persist(part);
    } catch (e) {
      state = { ...state, [part]: previo };
      throw e;
    }
    emit(part);
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
  exportar({ incluirApiKey = false } = {}) {
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
        apiKey: incluirApiKey ? s.apiKey : '',
      },
    };
  },

  importar(json) {
    if (!json || typeof json !== 'object') throw new Error('El archivo no tiene un formato válido.');
    // Acepta el formato con envoltura { app, version, data } o el contenido directo.
    const data = json.data && typeof json.data === 'object' ? json.data : json;
    const conocidas = ['profile', 'diagnostico', 'porComprar', 'armario', 'historial'];
    if (!conocidas.some((k) => k in data)) throw new Error('Este archivo no parece un respaldo de MiImagenApp.');
    const n = normalize({ ...data, apiKey: data.apiKey || state.apiKey });
    const respaldo = { ...state };
    try {
      ['profile', 'diagnostico', 'porComprar', 'armario', 'historial', 'settings', 'apiKey'].forEach((k) => {
        state = { ...state, [k]: n[k] };
        persist(k);
      });
    } catch (e) {
      state = respaldo;
      ['profile', 'diagnostico', 'porComprar', 'armario', 'historial', 'settings', 'apiKey'].forEach((k) => {
        try { persist(k); } catch { /* mejor esfuerzo */ }
      });
      throw e;
    }
    emit('all');
    return n;
  },

  borrarTodo() {
    Object.values(KEYS).forEach((k) => { try { localStorage.removeItem(k); } catch { /* */ } });
    state = defaults();
    emit('all');
  },

  usoAlmacenamiento() {
    let bytes = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX)) bytes += k.length + (localStorage.getItem(k) || '').length; // caracteres (los navegadores limitan ~5 millones)
      }
    } catch { /* */ }
    return bytes;
  },
};
