// Compresión automática con Canvas HTML5: máx. 800 px de ancho, JPEG calidad 0.7.

export const MAX_WIDTH = 800;
export const JPEG_QUALITY = 0.7;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer la imagen. Prueba con otra foto (JPG o PNG).'));
    img.src = src;
  });
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('No se pudo abrir el archivo.'));
    r.readAsDataURL(file);
  });
}

async function toImage(fileOrDataUrl) {
  if (typeof fileOrDataUrl === 'string') return loadImage(fileOrDataUrl);
  const file = fileOrDataUrl;
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('El archivo seleccionado no es una imagen.');
  }
  // createImageBitmap respeta la orientación EXIF de las fotos del celular.
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch { /* algunos formatos (HEIC) requieren el camino tradicional */ }
  }
  const url = URL.createObjectURL(file);
  try {
    return await loadImage(url);
  } catch {
    return loadImage(await readAsDataURL(file));
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

/**
 * Comprime una imagen (File o dataURL) y devuelve un dataURL JPEG.
 * @param {File|string} input
 * @param {{maxWidth?:number, quality?:number}} opts
 */
export async function compressImage(input, { maxWidth = MAX_WIDTH, quality = JPEG_QUALITY } = {}) {
  const img = await toImage(input);
  const w0 = img.width || img.naturalWidth;
  const h0 = img.height || img.naturalHeight;
  if (!w0 || !h0) throw new Error('La imagen parece estar vacía.');
  const scale = Math.min(1, maxWidth / w0);
  const w = Math.round(w0 * scale);
  const h = Math.round(h0 * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  // Fondo blanco para PNG con transparencia (JPEG no la admite).
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  if (img.close) img.close();
  return canvas.toDataURL('image/jpeg', quality);
}

/** Miniatura pequeña para el historial. */
export const thumbnail = (dataUrl) => compressImage(dataUrl, { maxWidth: 240, quality: 0.6 });

/** Separa un dataURL en {mimeType, data} para Gemini. */
export function dataUrlParts(dataUrl) {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl || '');
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}

export const approxKB = (dataUrl) => Math.round(((dataUrl || '').length * 3) / 4 / 1024);
