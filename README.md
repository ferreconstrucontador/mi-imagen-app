# MiImagenApp 💄✨

Progressive Web App en español de **asesoría de imagen personal femenina integral** con Google Gemini IA.
Es un sitio 100 % estático (HTML + CSS + JavaScript con módulos ES, sin compilar), listo para GitHub Pages y sin backend propio.

## Funciones

- **Diagnóstico en 4 Pilares** (Gemini con visión): colorimetría de 12 estaciones con *draping* digital interactivo, visagismo/maquillaje/cabello, morfología/ropa/accesorios, y cuidado personal/presencia. Todo se adapta a la **ciudad y el clima** de la usuaria.
- **Evaluador "¿Me queda bien?"**: foto y/o enlace de tienda, 7 ocasiones, puntuación de 1 a 10, combinaciones con el armario y botón **Agregar a Por Comprar**.
- **Lista Por Comprar** → **Marcar como Comprado** mueve el artículo al Armario Virtual.
- **Mi Armario**: carga rápida de inventario 1 a 1 con detección por IA, 9 categorías, filtros por color y ocasión, y **Generador de 3 outfits**.
- **Estilizador Versátil (Explorar Estilos)**: toma una prenda del armario o una foto nueva y muestra cómo llevarla en los 7 Estilos Universales (Natural, Clásico, Elegante, Romántico, Seductor, Creativo y Dramático), con prendas sugeridas libremente, calzado, accesorios, peinado y maquillaje. Cada sugerencia se puede mandar a Por Comprar.
- **Ajustes**: API Key (campo de contraseña con botón mostrar/ocultar y validación), modelo, exportar/importar `.json`, uso del almacenamiento e instalación.
- **? Manual**: tour guiado de 8 pasos, más una sección de Ayuda con preguntas frecuentes y 6 ejemplos prácticos.
- Fotos comprimidas automáticamente con Canvas (máx. 800 px de ancho, JPEG 0.7). Todo se guarda en `localStorage`.
- PWA instalable en Android y iOS (manifest, iconos, service worker, uso sin conexión).

## Estructura

```
index.html          Estructura de la app y metaetiquetas PWA
manifest.json       Manifiesto de la PWA
sw.js               Service worker (caché sin conexión; nunca guarda llamadas a Gemini)
css/styles.css      Estilos (crema, rosa empolvado, terracota, carbón y dorado)
js/app.js           Enrutador, cabecera e instalación
js/store.js         Persistencia en localStorage, normalización, respaldos
js/gemini.js        Cliente REST de Gemini y prompts
js/image.js         Compresión de imágenes con Canvas
js/ui.js            Componentes de interfaz (modales, toasts, selector de fotos, chips)
js/tour.js          Tour guiado de 8 pasos
js/views/*.js       Perfil, Evaluar, Por Comprar, Armario, Estilizador, Ajustes y Ayuda
icons/              Iconos de la PWA
```

## Uso local

```bash
python3 -m http.server 8080
# abre http://localhost:8080
```
(Los módulos ES y el service worker necesitan servirse por HTTP; abrir el archivo directamente no funciona.)

## Publicar en GitHub Pages

En el repositorio: **Settings → Pages → Deploy from a branch**, elige la rama y la carpeta `/ (root)`. Todas las rutas son relativas, así que funciona dentro de `https://usuario.github.io/mi-imagen-app/`.

Al publicar cambios, sube `VERSION` en `sw.js` para que las usuarias reciban la nueva versión.

## API Key de Gemini

1. Entra a <https://aistudio.google.com/apikey> con una cuenta de Google.
2. Elige **Create API key** y cópiala.
3. Pégala en **Ajustes → Guardar y validar**.

La clave se guarda solo en el `localStorage` del dispositivo y se envía únicamente a `generativelanguage.googleapis.com`. El modelo predeterminado es `gemini-2.5-flash`; se puede cambiar en Ajustes.

## Formato del respaldo

```json
{ "app": "MiImagenApp", "version": 1, "exportado": "ISO-8601",
  "data": { "profile": {}, "diagnostico": {}, "porComprar": [], "armario": [], "historial": [], "settings": {}, "apiKey": "" } }
```
Al importar, `store.normalize()` rellena los campos que falten, así que los respaldos antiguos o parciales siguen funcionando.
