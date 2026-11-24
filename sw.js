// Service Worker de MiImagenApp: funciona sin conexión (excepto el análisis con IA).
//
// Aislamiento: el dominio ferreconstrucontador.github.io comparte el almacenamiento
// de cachés con otras apps (MiFitApp, MiNutriApp…). Por eso este SW sólo crea,
// lee y borra cachés que empiezan con "miimagen-".
importScripts('./js/version.js');

const PREFIJO = 'miimagen-';
const VERSION = PREFIJO + 'v' + self.MIIMAGEN_VERSION; // p. ej. "miimagen-v1.4.1"
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/version.js',
  './js/app.js',
  './js/constants.js',
  './js/store.js',
  './js/imagedb.js',
  './js/boveda.js',
  './js/respaldo.js',
  './js/image.js',
  './js/gemini.js',
  './js/ui.js',
  './js/tour.js',
  './js/historial.js',
  './js/views/perfil.js',
  './js/views/evaluar.js',
  './js/views/comprar.js',
  './js/views/armario.js',
  './js/views/ajustes.js',
  './js/views/ayuda.js',
  './js/views/estilos.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' evita copiar archivos viejos de la caché HTTP del navegador.
  // No llamamos skipWaiting(): la nueva versión espera a que la usuaria toque "Actualizar".
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.tipo === 'ACTUALIZAR') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      // Sólo cachés antiguas de MiImagenApp; nunca las de otras apps del dominio.
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIJO) && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Nunca cachear llamadas a la API de Gemini.
  if (url.hostname.endsWith('googleapis.com') && url.hostname !== 'fonts.googleapis.com') return;

  const esFuente = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !esFuente) return;

  // Red primero para la página (para recibir actualizaciones), caché propia como respaldo.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copia = res.clone(); caches.open(VERSION).then((c) => c.put('./index.html', copia)); }
          return res;
        })
        .catch(() => caches.open(VERSION).then((c) => c.match('./index.html')))
    );
    return;
  }

  // Caché propia y actualización en segundo plano para lo demás.
  e.respondWith(
    caches.open(VERSION).then((cache) => cache.match(req).then((cached) => {
      const red = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || red;
    }))
  );
});
