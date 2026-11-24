// Versión única de MiImagenApp.
// La leen la página (import './version.js') y el service worker (importScripts).
// Al publicar cualquier cambio de la app, sube este número: renombra la caché
// del service worker y se muestra en el pie de Perfil y Ajustes.
// No uses import/export aquí: el service worker lo carga como script clásico.
self.MIIMAGEN_VERSION = '1.4.1';
