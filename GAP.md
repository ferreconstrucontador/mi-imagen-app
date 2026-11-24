# GAP.md — Reglas del ecosistema Aplicaciones GAP en MiImagenApp

MiImagenApp convive con otras apps del ecosistema (MiFitApp, MiNutriApp…) en el
mismo dominio `ferreconstrucontador.github.io`. Comparten **origen**, así que
comparten el almacenamiento de cachés, `localStorage` e IndexedDB del navegador.
Estas reglas evitan que una app pise los datos de otra y dan a todas el mismo
comportamiento. Estado: **v1.4.1**.

## 1. Identidad y aislamiento

| Recurso | Nombre en MiImagenApp | Regla |
|---|---|---|
| Ruta publicada | `/mi-imagen-app/` | Todas las rutas son relativas (`./`). |
| Service worker | `sw.js`, `scope: './'` | Sólo controla `/mi-imagen-app/`. |
| Cachés | prefijo `miimagen-` (`miimagen-v1.4.1`) | Sólo se crean, leen y borran cachés con este prefijo. |
| `localStorage` | prefijo `miimagen.` | Nunca leer ni borrar llaves de otras apps. |
| IndexedDB | base `MiImagenDB` | Base propia; otras apps usan la suya. |

- Al activarse, `sw.js` borra **únicamente** cachés que empiezan con `miimagen-` y no son la versión actual. Nunca `caches.keys()` sin filtrar por prefijo.
- Las respuestas se buscan en la caché propia (`caches.open(VERSION)`), nunca con `caches.match()` global, que busca en las cachés de todas las apps.
- Nunca se cachean llamadas a APIs externas (`generativelanguage.googleapis.com`).
- Las llaves existentes no se renombran: el prefijo de `localStorage` es `miimagen.` (con punto) desde la v1.0 y cambiarlo perdería los datos de las usuarias.

## 2. Versión única y actualizaciones

- La versión vive en **un solo lugar**: `js/version.js` (`self.MIIMAGEN_VERSION = '1.4.1'`).
  - `sw.js` la carga con `importScripts('./js/version.js')` y nombra su caché `miimagen-v<versión>`.
  - La página la importa (`import './version.js'`) y la muestra en el pie de **Perfil** y de **Ajustes**.
- Cualquier cambio publicado de la app sube ese número (semver: parche para correcciones, menor para funciones).
- El SW se registra con `updateViaCache: 'none'`: el navegador revisa `sw.js` y `js/version.js` sin usar su caché HTTP.
- Al volver a la app (`visibilitychange`, como máximo una vez por minuto) se busca una actualización.
- La versión nueva **no se activa sola** (sin `skipWaiting()` automático). Se muestra el aviso discreto **"Hay una versión nueva · Actualizar"** y la app sólo recarga cuando la usuaria lo toca (`postMessage({ tipo: 'ACTUALIZAR' })` → `skipWaiting` → `controllerchange` → recarga).
- La instalación del SW descarga los archivos con `cache: 'reload'` para no copiar versiones viejas de la caché HTTP.

## 3. Diálogos propios (sin `confirm()` ni `alert()`)

- Está prohibido usar `window.confirm`, `window.alert` y `window.prompt`: muestran el encabezado del navegador ("ferreconstrucontador.github.io dice").
- Se usa `mostrarDialogo({ titulo = 'MiImagenApp', mensaje, textoConfirmar = 'Aceptar', textoCancelar = 'Cancelar', esAlerta = false, peligro = false })` de `js/ui.js`, que devuelve una `Promise<boolean>`.
- El diálogo es una **capa del historial**: Atrás, `Esc` o tocar fuera lo cierran **cancelando** la acción, sin salir de la app.
- En acciones destructivas (`peligro: true`) el foco y el estilo resaltado quedan en **Cancelar**, y el mensaje dice **exactamente qué** se borra o reemplaza (nombres y cantidades).
- Los estilos del diálogo usan sólo variables de `:root`, para seguir el tema de la app.

## 4. Datos: Doble Bóveda y respaldos

**Bóveda 1: respaldo `.json` (fuera del dispositivo)**
- Nombre: `miimagen-respaldo-AAAA-MM-DD.json`. Formato `{ app, version, exportado, data }`, compatible desde la v1.0.
- **Nunca incluye la API Key** de Gemini. Al importar se conserva la clave del dispositivo.
- **Recordatorio inteligente**: aviso discreto con botón "Exportar", **como máximo cada 24 h** y **sólo si hubo actividad** (cambios en perfil, diagnóstico, armario, lista o historial) desde el último respaldo. Metadatos: `miimagen.ultimaActividad`, `miimagen.ultimoRespaldo`, `miimagen.ultimoAvisoRespaldo`.

**Bóveda 2: copias internas (dentro del dispositivo)**
- Almacén aislado `boveda` dentro de `MiImagenDB` (desde la versión 2 de la base), clave `AAAA-MM-DD`.
- Una copia por día, tomada la primera vez que se abre la app ese día: guarda el estado **antes** de los cambios del día. Se conservan las **7 más recientes**.
- Incluye perfil, diagnóstico, ajustes, armario, lista Por Comprar e historial. **No incluye la API Key.**
- Las fotos se guardan reducidas (320 px, JPEG 0.6); las que no cambiaron se reutilizan de la copia anterior. Al restaurar, si la foto original sigue en el dispositivo se usa en tamaño completo.
- Se restaura desde **Ajustes → Copias internas**, con confirmación `mostrarDialogo` (`peligro: true`).
- "Borrar todos mis datos" también vacía la bóveda (y lo dice en el diálogo).

**Espacio y protección**
- Medidor en Ajustes con `navigator.storage.estimate()` (usado y disponible en MB/GB), con respaldo visual si el navegador no reporta cuota.
- Botón **"🛡️ Proteger mis datos en este dispositivo"** (`navigator.storage.persist()`), que muestra si ya están protegidos.

## 5. Navegación tipo app nativa

- La app abre en la última pestaña visitada.
- El botón/gesto Atrás cierra primero diálogos y modales, luego regresa de las vistas secundarias a su pantalla de origen y, desde cualquier pestaña, vuelve a la principal antes de salir.
- Las pantallas se cambian con `irA()`; los modales con `abrirModal()`, y cualquier otra capa se registra con `abrirCapa()`.

## 6. Cambios de esquema sin perder datos

- `normalize()` debe leer cualquier dato o respaldo anterior.
- Las bases IndexedDB sólo **agregan** almacenes al subir de versión, nunca borran los existentes.
- Si la base no se puede abrir (por ejemplo, bloqueada por otra pestaña), las referencias a fotos se conservan para no perderlas al guardar.

## Lista de verificación antes de publicar

- [ ] Subí `self.MIIMAGEN_VERSION` en `js/version.js`.
- [ ] Agregué los archivos nuevos a `SHELL` en `sw.js`.
- [ ] Sin `confirm(`, `alert(` ni `prompt(` del navegador: `grep -rnE "window\.(confirm|alert|prompt)" js`.
- [ ] Los datos de una versión anterior (`localStorage` y `MiImagenDB`) se conservan tras actualizar.
- [ ] Las cachés que no empiezan con `miimagen-` siguen intactas tras activar el SW.
