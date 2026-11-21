// Catálogos compartidos de MiImagenApp

export const APP_NAME = 'MiImagenApp';
export const DATA_VERSION = 1;

export const DEFAULT_MODEL = 'gemini-2.5-flash';
export const MODELOS_SUGERIDOS = [
  { id: 'gemini-2.5-flash', nombre: 'Gemini 2.5 Flash (recomendado, rápido y con visión)' },
  { id: 'gemini-2.5-flash-lite', nombre: 'Gemini 2.5 Flash-Lite (más ligero, más cuota gratis)' },
  { id: 'gemini-2.5-pro', nombre: 'Gemini 2.5 Pro (más detallado, más lento)' },
];

export const CLIMAS = [
  { id: 'calido-humedo', nombre: 'Cálido húmedo', icono: '🌴' },
  { id: 'calido-seco', nombre: 'Cálido seco', icono: '🌵' },
  { id: 'templado', nombre: 'Templado', icono: '🌤️' },
  { id: 'frio', nombre: 'Frío', icono: '❄️' },
  { id: 'variable', nombre: 'Variable', icono: '🌦️' },
];

export const ESTILOS = [
  'Clásico', 'Elegante', 'Romántico', 'Natural / Relajado', 'Minimalista',
  'Creativo / Bohemio', 'Moderno / Dramático', 'Sensual', 'Deportivo',
];

export const OCASIONES = [
  { id: 'casual', nombre: 'Casual / Diario', corto: 'Casual', icono: '☕' },
  { id: 'oficina', nombre: 'Oficina / Ejecutivo', corto: 'Oficina', icono: '💼' },
  { id: 'capsula', nombre: 'Minimalista / Cápsula', corto: 'Cápsula', icono: '🤍' },
  { id: 'coctel', nombre: 'Evento de Día / Cóctel', corto: 'Cóctel', icono: '🥂' },
  { id: 'noche', nombre: 'Noche / Fiesta / Gala', corto: 'Noche', icono: '✨' },
  { id: 'playa', nombre: 'Clima Cálido / Vacaciones / Playa', corto: 'Playa', icono: '🏖️' },
  { id: 'deportivo', nombre: 'Deportivo / Athleisure', corto: 'Athleisure', icono: '🧘‍♀️' },
];

export const CATEGORIAS = [
  { id: 'tops', nombre: 'Blusas / Tops', icono: '👚' },
  { id: 'pantalones', nombre: 'Pantalones / Jeans', icono: '👖' },
  { id: 'faldas', nombre: 'Faldas / Shorts', icono: '🩳' },
  { id: 'vestidos', nombre: 'Vestidos / Enterizos', icono: '👗' },
  { id: 'sacos', nombre: 'Sacos / Abrigos', icono: '🧥' },
  { id: 'calzado', nombre: 'Calzado', icono: '👠' },
  { id: 'bolsos', nombre: 'Bolsos', icono: '👜' },
  { id: 'joyeria', nombre: 'Joyería / Accesorios', icono: '💍' },
  { id: 'maquillaje', nombre: 'Maquillaje', icono: '💄' },
];

export const COLORES = [
  { id: 'blanco', nombre: 'Blanco', css: '#FFFFFF' },
  { id: 'negro', nombre: 'Negro', css: '#1E1E1E' },
  { id: 'gris', nombre: 'Gris', css: '#9A9A9E' },
  { id: 'beige', nombre: 'Beige / Nude', css: '#DCC3A8' },
  { id: 'cafe', nombre: 'Café / Camel', css: '#9A6A44' },
  { id: 'marino', nombre: 'Azul marino', css: '#1F2C4C' },
  { id: 'azul', nombre: 'Azul', css: '#4A7BC0' },
  { id: 'mezclilla', nombre: 'Mezclilla', css: 'linear-gradient(135deg,#5B7DA6 0%,#3E5D85 50%,#7F9CC0 100%)' },
  { id: 'rojo', nombre: 'Rojo', css: '#C0272D' },
  { id: 'vino', nombre: 'Vino / Borgoña', css: '#6E1F35' },
  { id: 'rosa', nombre: 'Rosa', css: '#E8A2B4' },
  { id: 'morado', nombre: 'Morado / Lila', css: '#8E6BB5' },
  { id: 'verde', nombre: 'Verde', css: '#4E8B5B' },
  { id: 'amarillo', nombre: 'Amarillo / Mostaza', css: '#D9A93A' },
  { id: 'naranja', nombre: 'Naranja / Coral', css: '#EE7F5E' },
  { id: 'metalico', nombre: 'Dorado / Plateado', css: 'linear-gradient(135deg,#E9D08C 0%,#B8955A 45%,#D9D9DE 55%,#A9A9B0 100%)' },
  { id: 'estampado', nombre: 'Estampado', css: 'conic-gradient(#C27C67 0 25%,#F2E3D5 0 50%,#2B2B2E 0 75%,#D8A7A0 0)' },
  { id: 'multicolor', nombre: 'Multicolor', css: 'conic-gradient(#E85D5D,#F2B33D,#5DBB63,#4A90D9,#A066C9,#E85D5D)' },
];

export const byId = (lista, id) => lista.find((x) => x.id === id);
export const nombreOcasion = (id) => byId(OCASIONES, id)?.nombre || id || '';
export const nombreCategoria = (id) => byId(CATEGORIAS, id)?.nombre || id || '';
export const nombreColor = (id) => byId(COLORES, id)?.nombre || id || '';
export const nombreClima = (id) => byId(CLIMAS, id)?.nombre || id || '';
