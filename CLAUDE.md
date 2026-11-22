# CLAUDE.md — MiImagenApp

PWA en español de asesoría de imagen personal femenina con Google Gemini IA.
Lee también `README.md` para la descripción de funciones y la estructura de archivos.

## Arquitectura (no cambiar sin pedirlo)

- **Sitio 100 % estático**: HTML + CSS + JavaScript con módulos ES nativos. **Sin compilación, sin `npm`, sin frameworks ni dependencias.** Se publica tal cual en GitHub Pages desde `main` / (root).
- **Sin backend propio**: Gemini se llama directamente desde el navegador (`js/gemini.js`).
- **Rutas siempre relativas** (`./`, `js/…`, `icons/…`): la app vive en `https://<usuario>.github.io/mi-imagen-app/`.
- Punto de entrada: `js/app.js`. Cada pantalla es un módulo en `js/views/` que exporta `mount(el)`, y opcionalmente `show(el)` y `onStore(part, visible)`.

## Reglas obligatorias

### 1. Service worker: subir `VERSION` en cada cambio de la app
- Cualquier cambio en archivos que la app sirve (HTML, CSS, JS, iconos, manifest) **debe subir `VERSION` en `sw.js`** (`miimagen-vX.Y.Z`), o las usuarias seguirán viendo la versión en caché.
- Todo archivo nuevo que use la app se agrega a la lista `SHELL` de `sw.js`.
- Nunca cachear llamadas a `generativelanguage.googleapis.com`.

### 2. Nunca perder datos de las usuarias
- **Textos, ajustes, diagnóstico y API Key → `localStorage`** (llaves `miimagen.*`, definidas en `KEYS` de `js/store.js`).
- **Fotos → IndexedDB `MiImagenDB`**, almacén `imagenes` (`js/imagedb.js`). Claves: `perfil:selfie`, `perfil:cuerpo`, `armario:<id>`, `porComprar:<id>`, `historial:<id>`.
- En `localStorage` cada foto se guarda como referencia `idb:<clave>`; en memoria siempre es un dataURL. Las vistas sólo trabajan con dataURL y **nunca acceden a `localStorage` ni a IndexedDB directamente**: todo pasa por `store` (`store.set`, `addArmario`, `updateProfile`, etc.).
- Si cambia la forma de los datos, actualiza `normalize()` en `js/store.js` para que **los datos ya guardados y los respaldos antiguos se sigan leyendo**. No borres ni renombres llaves existentes sin migrarlas.
- La migración de fotos de `localStorage` a IndexedDB (v1.4) se ejecuta en `store.iniciar()`: guarda primero las fotos y sólo después reescribe `localStorage`. Si IndexedDB no está disponible, las fotos se quedan en `localStorage`. Conserva ese orden y ese respaldo.
- **Respaldos `.json`**: `store.exportar()` incluye las fotos como dataURL con el formato `{ app, version, exportado, data }`. `store.importar()` debe aceptar respaldos de **cualquier versión desde la v1.0**. No cambies este formato sin mantener la compatibilidad en ambos sentidos.

### 3. Imágenes: compresión automática
- **Toda imagen nueva se comprime antes de guardarse** con `compressImage()` de `js/image.js`: **máximo 800 px de ancho, JPEG calidad 0.7** (`MAX_WIDTH`, `JPEG_QUALITY`). Las miniaturas del historial usan `thumbnail()` (240 px).
- Para que la usuaria suba o tome fotos, usa `photoPicker()` de `js/ui.js`, que ya comprime. No guardes nunca un `File` ni una imagen sin comprimir.

### 4. Gemini IA
- **API Keys**: se aceptan las de Google AI Studio con prefijo **`AQ.`** (nuevas) y **`AIza`** (anteriores), o cualquier clave de 20 o más caracteres ASCII sin espacios. La validación real la hace Google (`validarApiKey()` en `js/gemini.js`). No vuelvas a exigir un prefijo concreto. Una clave `AIza` inválida responde 400 y una `AQ.` inválida responde 401: ambas deben mostrar el mensaje de clave inválida.
- La clave se envía en el encabezado `x-goog-api-key` y sólo se guarda en `localStorage`.
- **Modelo configurable en Ajustes** (`settings.modelo`), **`gemini-2.5-flash` por defecto** (`DEFAULT_MODEL` en `js/constants.js`). No fijes el nombre del modelo en otro lugar.
- **Todos los prompts deben incluir la ciudad y el clima de residencia del perfil**: usa `contextoPerfil()` y menciona `profile.ciudad` y `nombreClima(profile.clima)` en las indicaciones (telas, maquillaje resistente al clima, cuidado capilar, compras y outfits).
- Las respuestas se piden en JSON y se **sanean** antes de usarlas: IDs de armario que existan, categorías, colores y ocasiones válidos de `js/constants.js`, colores HEX válidos.
- Errores para la usuaria: usa `GeminiError` y `mostrarError()`, con mensajes claros en español.

### 5. Navegación y botón "Atrás"
- Para cambiar de pantalla usa **`irA(nombre)`** (`window.MiImagen.irA` desde las vistas). **No asignes `location.hash`**; los enlaces `<a href="#vista">` ya los intercepta el enrutador.
- Pestañas de la barra inferior: `perfil`, `evaluar`, `comprar`, `armario`, `ajustes`. Las vistas secundarias (`estilos`, `ayuda`) se apilan sobre la pantalla de origen.
- Todo modal se abre con `abrirModal()` de `js/ui.js` (u otra capa registrada con `abrirCapa()` de `js/historial.js`) para que el botón Atrás lo cierre primero.
- La última pestaña visitada se guarda en `miimagen.ultimaPestana`.

### 6. Idioma y público
- **Todo en español natural (México, neutro)**: interfaz, mensajes, comentarios del código, textos de commits y prompts para Gemini.
- La app está dirigida **100 % a mujeres**: háblale a la usuaria de "tú" y en femenino, con tono cálido y positivo (nunca comentarios negativos sobre su cuerpo o rostro).

### 7. Estética visual
- Mantén el estilo **femenino, elegante y editorial**: tonos crema/marfil, rosa empolvado/terracota suave, carbón para textos y acentos dorados.
- Usa siempre las variables de `:root` en `css/styles.css` (`--crema`, `--marfil`, `--arena`, `--rosa`, `--rosa-suave`, `--terracota`, `--carbon`, `--texto`, `--muted`, `--dorado`, `--dorado-claro`…) en lugar de colores sueltos.
- Tipografías: `--serif` (Cormorant Garamond) para títulos y `--sans` (Jost) para el texto.
- Reutiliza los componentes existentes: `.card`, `.btn` (`btn-primary`, `btn-gold`, `btn-soft`, `btn-ghost`), `.chip`, `.info-block`, `.callout`, `.empty`.
- **Diseño móvil primero**: debe verse bien a 390 px de ancho, con la barra de navegación inferior fija y botones táctiles de al menos 36–44 px.

## Cómo probar

```bash
python3 -m http.server 8765    # desde la raíz del repo; abre http://localhost:8765/
```
- Los módulos ES y el service worker necesitan HTTP; abrir `index.html` como archivo no funciona.
- Verifica la sintaxis de los módulos: `for f in js/*.js js/views/*.js; do node --input-type=module --check < "$f"; done`
- Pruebas en navegador con Playwright (Chromium), a 390×844:
  - Simula Gemini con `page.route('https://generativelanguage.googleapis.com/**', …)` para no gastar cuota.
  - Precarga datos en `localStorage` (por ejemplo, desde un respaldo `.json`) y **abre una página nueva** después; `reload()` conserva el historial de navegación anterior.
  - Comprueba que no haya errores en consola, que los datos guardados se conserven y que el botón Atrás (`page.goBack()`) siga funcionando.

## Flujo de trabajo con Git
- Commits en español con mensaje descriptivo.
- Los cambios llegan a `main` mediante pull request.
