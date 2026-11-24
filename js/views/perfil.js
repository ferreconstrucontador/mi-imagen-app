// Mi Perfil + Diagnóstico integral en 4 Pilares + draping digital.
import { store } from '../store.js';
import { CLIMAS, ESTILOS, nombreClima } from '../constants.js';
import { analizarDiagnostico } from '../gemini.js';
import { $, $$, h, esc, toast, mostrarError, cargando, photoPicker, chipGroup, swatch, lista, fechaCorta, mostrarDialogo } from '../ui.js';

let root;
let pilarActivo = 'colorimetria';

export function mount(el) {
  root = el;
  el.innerHTML = `
    <div id="perfil-hero"></div>
    <details class="card card-form" id="perfil-form">
      <summary><span><span class="step-num">1</span> Mi perfil, fotos y clima</span><span class="summary-hint"></span></summary>
      <div class="form-body">
        <h4 class="sub">Fotografías base</h4>
        <div class="photo-grid">
          <div data-tour="selfie">
            <label class="field-label">Selfie con luz natural <b class="req">obligatoria</b></label>
            <div id="pick-selfie"></div>
          </div>
          <div>
            <label class="field-label">Cuerpo completo <span class="opt">opcional</span></label>
            <div id="pick-cuerpo"></div>
          </div>
        </div>
        <details class="tips">
          <summary>💡 Cómo tomar la foto ideal</summary>
          <ul class="nice-list">
            <li><b>Luz natural</b> de frente, junto a una ventana, sin sol directo ni flash.</li>
            <li>Rostro <b>sin maquillaje</b> (o muy ligero), cabello recogido o detrás de los hombros.</li>
            <li>Fondo liso blanco o gris claro, sin filtros ni modo retrato.</li>
            <li>Ropa de color neutro (blanco o gris) para que no altere tu colorimetría.</li>
            <li>Para cuerpo completo: ropa ajustada, de pie, de frente, brazos ligeramente separados, cámara a la altura de la cintura.</li>
          </ul>
        </details>

        <h4 class="sub">Sobre ti</h4>
        <div class="grid-2">
          <label class="field"><span>Nombre (opcional)</span><input type="text" name="nombre" autocomplete="given-name" placeholder="¿Cómo te llamas?"></label>
          <label class="field"><span>Edad aproximada</span><input type="number" name="edad" min="12" max="100" inputmode="numeric" placeholder="Ej. 35"></label>
          <label class="field"><span>Estatura (cm)</span><input type="number" name="estatura" min="120" max="210" inputmode="numeric" placeholder="Ej. 158"></label>
        </div>
        <label class="field-label">Estilos que te gustan <span class="opt">elige varios</span></label>
        <div id="chips-estilos"></div>

        <h4 class="sub" data-tour="ubicacion">Lugar de residencia y clima</h4>
        <div class="grid-2">
          <label class="field"><span>Ciudad, Estado / País <b class="req">*</b></span><input type="text" name="ciudad" autocomplete="address-level2" placeholder="Ej. Campeche, México"></label>
          <label class="field"><span>Clima predominante <b class="req">*</b></span>
            <select name="clima">
              <option value="">Selecciona…</option>
              ${CLIMAS.map((c) => `<option value="${c.id}">${c.icono} ${c.nombre}</option>`).join('')}
            </select>
          </label>
        </div>
        <p class="hint">La IA usará tu ciudad y clima en <b>todos</b> los análisis: telas, maquillaje de larga duración, cuidado anti-frizz, compras y outfits.</p>
        <label class="field"><span>Notas para tu asesora (opcional)</span>
          <textarea name="notas" rows="2" placeholder="Ej. Trabajo en oficina, no me gustan los escotes profundos, quiero verme más ejecutiva…"></textarea>
        </label>
        <p class="saved-note" id="saved-note" aria-live="polite"></p>
      </div>
    </details>

    <div class="analyze-bar" data-tour="analizar">
      <button class="btn btn-primary btn-lg btn-block" id="btn-analizar">✨ Analizar con Gemini IA</button>
      <p class="hint center" id="analizar-hint"></p>
    </div>

    <div id="diagnostico"></div>
    <p class="app-version">MiImagenApp · v${esc(self.MIIMAGEN_VERSION || '')}</p>
  `;

  const p = store.get().profile;
  const form = $('#perfil-form', el);
  $('#pick-selfie', el).appendChild(photoPicker({
    valor: p.selfie, etiqueta: 'Toca para agregar tu selfie', camara: 'user', aspecto: '3/4',
    ayuda: 'Luz natural, de frente, sin filtros',
    onChange: (v) => guardar({ selfie: v }, 'Selfie guardada ✓'),
  }));
  $('#pick-cuerpo', el).appendChild(photoPicker({
    valor: p.cuerpo, etiqueta: 'Foto de cuerpo completo', camara: 'environment', aspecto: '3/4',
    ayuda: 'De pie, de frente, ropa ajustada',
    onChange: (v) => guardar({ cuerpo: v }, 'Foto guardada ✓'),
  }));
  $('#chips-estilos', el).appendChild(chipGroup({
    opciones: ESTILOS.map((e) => ({ id: e, nombre: e })),
    seleccion: p.estilos, multiple: true,
    onChange: (v) => guardar({ estilos: v }),
  }));

  ['nombre', 'edad', 'estatura', 'ciudad', 'clima', 'notas'].forEach((n) => {
    const inp = form.querySelector(`[name="${n}"]`);
    inp.value = p[n] || '';
    let t;
    inp.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => guardar({ [n]: inp.value.trim() }), 450);
    });
  });

  form.open = !store.get().diagnostico;
  $('#btn-analizar', el).addEventListener('click', analizar);
  render();
}

export function show() { render(); }

export function onStore(part, visible) {
  if (!root) return;
  if (part === 'all') {
    // Tras importar o borrar datos reconstruimos toda la vista.
    mount(root);
    return;
  }
  if (visible && (part === 'diagnostico' || part === 'profile')) render();
}

function guardar(patch, msg) {
  try {
    store.updateProfile(patch);
    const n = $('#saved-note', root);
    if (n) {
      n.textContent = msg || 'Cambios guardados ✓';
      n.classList.add('show');
      clearTimeout(n._t);
      n._t = setTimeout(() => n.classList.remove('show'), 1800);
    }
  } catch (e) { mostrarError(e); }
}

function render() {
  const { profile: p, diagnostico } = store.get();
  // Héroe
  const hero = $('#perfil-hero', root);
  if (diagnostico?.data) {
    const c = diagnostico.data.colorimetria || {};
    const acentos = (c.paleta?.acentos || []).slice(0, 6);
    hero.innerHTML = `
      <div class="hero hero-diag">
        ${p.selfie ? `<img class="hero-avatar" src="${p.selfie}" alt="Tu selfie">` : ''}
        <div>
          <p class="eyebrow">${p.nombre ? `Hola, ${esc(p.nombre)}` : 'Tu diagnóstico de imagen'}</p>
          <h2 class="display">${esc(c.estacion || 'Tu estación')}</h2>
          <div class="mini-palette">${acentos.map((x) => `<span style="background:${esc(x.hex)}" title="${esc(x.nombre)}"></span>`).join('')}</div>
          <p class="muted small">📍 ${esc(p.ciudad || 'Sin ciudad')} · ${esc(nombreClima(p.clima) || 'Sin clima')}</p>
        </div>
      </div>`;
  } else {
    hero.innerHTML = `
      <div class="hero">
        <p class="eyebrow">${p.nombre ? `Hola, ${esc(p.nombre)} ✨` : 'Asesoría de imagen integral'}</p>
        <h2 class="display">Descubre tu mejor versión</h2>
        <p class="lead">Con una selfie y tu ciudad, Gemini IA crea tu diagnóstico en <b>4 Pilares</b>: colorimetría, visagismo y maquillaje, morfología y estilismo, y cuidado personal.</p>
        <ol class="steps">
          <li><span>1</span>Configura tu API Key gratuita en <a href="#ajustes">Ajustes</a> ${store.get().apiKey ? '✅' : ''}</li>
          <li><span>2</span>Agrega tu selfie, ciudad y clima ${p.selfie && p.ciudad && p.clima ? '✅' : ''}</li>
          <li><span>3</span>Presiona <b>Analizar con Gemini IA</b></li>
        </ol>
      </div>`;
  }

  const hint = $('#analizar-hint', root);
  const faltan = [];
  if (!p.selfie) faltan.push('tu selfie');
  if (!p.ciudad) faltan.push('tu ciudad');
  if (!p.clima) faltan.push('tu clima');
  hint.textContent = faltan.length ? `Falta: ${faltan.join(', ')}.` : diagnostico ? `Último análisis: ${fechaCorta(diagnostico.fecha)}. Puedes volver a analizar si cambias de fotos, look o ciudad.` : '¡Todo listo para tu análisis!';
  $('#btn-analizar', root).textContent = diagnostico ? '🔄 Volver a analizar con Gemini IA' : '✨ Analizar con Gemini IA';
  const sh = $('#perfil-form .summary-hint', root);
  sh.textContent = faltan.length ? `Falta ${faltan.length}` : 'Completo ✓';
  sh.classList.toggle('ok', !faltan.length);

  renderDiagnostico();
}

async function analizar() {
  const { profile: p, diagnostico } = store.get();
  const form = $('#perfil-form', root);
  if (!p.selfie) {
    form.open = true;
    toast('Agrega tu selfie con luz natural para poder analizarte.', 'warn');
    $('#pick-selfie', root).scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (!p.ciudad || !p.clima) {
    form.open = true;
    toast('Indica tu ciudad y clima: la IA los usa en todas las recomendaciones.', 'warn');
    form.querySelector(p.ciudad ? '[name=clima]' : '[name=ciudad]').focus();
    return;
  }
  if (diagnostico) {
    const est = diagnostico.data?.colorimetria?.estacion;
    const ok = await mostrarDialogo({
      mensaje: `Se reemplazará tu diagnóstico de 4 Pilares del ${fechaCorta(diagnostico.fecha)}${est ? ` (${est})` : ''} por uno nuevo, hecho con tus fotos y datos actuales.\n\nSi después quieres el anterior, puedes recuperarlo desde Ajustes → Copias internas.`,
      textoConfirmar: 'Sí, analizar de nuevo',
      peligro: true,
    });
    if (!ok) return;
  }

  const fin = cargando([
    'Observando tu subtono de piel…',
    'Midiendo tu nivel de contraste…',
    'Buscando tu estación entre las 12…',
    'Analizando la forma de tu rostro…',
    'Eligiendo tu maquillaje ideal para el clima…',
    'Estudiando tus proporciones…',
    'Preparando tu rutina de cuidado…',
  ]);
  try {
    const data = await analizarDiagnostico();
    if (!data || !data.colorimetria) throw new Error('La respuesta de la IA no tiene el formato esperado. Inténtalo de nuevo.');
    store.set('diagnostico', { fecha: new Date().toISOString(), modelo: store.get().settings.modelo, data });
    store.addHistorial({ tipo: 'diagnostico', titulo: 'Diagnóstico 4 Pilares', resumen: `${data.colorimetria.estacion || ''} · ${data.visagismo?.formaRostro || ''} · ${data.morfologia?.silueta || ''}` });
    pilarActivo = 'colorimetria';
    $('#perfil-form', root).open = false;
    toast('¡Tu diagnóstico está listo! 💖', 'ok');
    setTimeout(() => $('#diagnostico', root)?.scrollIntoView({ behavior: 'smooth' }), 200);
  } catch (e) {
    mostrarError(e, 'diagnóstico');
  } finally {
    fin();
  }
}

// ------------------------------------------------------------------
// Diagnóstico
// ------------------------------------------------------------------
const PILARES = [
  { id: 'colorimetria', nombre: 'Colorimetría', icono: '🎨' },
  { id: 'visagismo', nombre: 'Visagismo y Maquillaje', icono: '💄' },
  { id: 'morfologia', nombre: 'Morfología y Estilismo', icono: '👗' },
  { id: 'cuidado', nombre: 'Cuidado y Presencia', icono: '🌿' },
];

function renderDiagnostico() {
  const cont = $('#diagnostico', root);
  const diag = store.get().diagnostico;
  if (!diag?.data) {
    cont.innerHTML = `
      <div class="card pillars-preview">
        <h3 class="section-title">Tus 4 Pilares</h3>
        <div class="pillar-grid">
          ${PILARES.map((p, i) => `<div class="pillar-tile"><span class="pillar-ico">${p.icono}</span><b>${i + 1}. ${p.nombre}</b></div>`).join('')}
        </div>
        <p class="muted small center">Aparecerán aquí después de tu primer análisis.</p>
      </div>`;
    return;
  }
  const d = diag.data;
  cont.innerHTML = `
    <div class="card diag-card">
      ${d.resumen ? `<blockquote class="diag-resumen">${esc(d.resumen)}</blockquote>` : ''}
      <div class="pillar-tabs" role="tablist">
        ${PILARES.map((p, i) => `<button role="tab" class="pillar-tab" data-p="${p.id}" aria-selected="${p.id === pilarActivo}"><span>${p.icono}</span><small>Pilar ${i + 1}</small>${p.nombre}</button>`).join('')}
      </div>
      <div class="pillar-panel" id="pillar-panel"></div>
      <p class="muted small center">Diagnóstico del ${fechaCorta(diag.fecha)} · ${esc(diag.modelo || '')}</p>
    </div>`;
  $$('.pillar-tab', cont).forEach((b) => b.addEventListener('click', () => {
    pilarActivo = b.dataset.p;
    $$('.pillar-tab', cont).forEach((x) => x.setAttribute('aria-selected', x === b));
    pintarPilar(d);
    b.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }));
  pintarPilar(d);
}

function pintarPilar(d) {
  const panel = $('#pillar-panel', root);
  const fn = { colorimetria: pilarColor, visagismo: pilarVisagismo, morfologia: pilarMorfologia, cuidado: pilarCuidado }[pilarActivo];
  panel.innerHTML = '';
  panel.appendChild(fn(d[pilarActivo] || {}));
}

const tile = (label, valor, ico = '') => valor ? `<div class="stat-tile">${ico ? `<span class="stat-ico">${ico}</span>` : ''}<small>${esc(label)}</small><b>${esc(valor)}</b></div>` : '';
const bloque = (titulo, texto, ico = '') => texto ? `<div class="info-block"><h5>${ico} ${esc(titulo)}</h5><p>${esc(texto)}</p></div>` : '';
const sw = (arr, extra = '') => (Array.isArray(arr) ? arr : []).map((c) => swatch(c.hex, c.nombre, extra)).join('');

function separarExplicacion(txt) {
  // "Cálido (explicación…)" -> ["Cálido", "explicación…"]
  const s = String(txt || '');
  const m = /^([^(:\-–—.]+)[(:\-–—.]\s*(.*)$/.exec(s);
  if (m && m[1].length < 28) return [m[1].trim(), m[2].replace(/\)$/, '').trim()];
  return [s, ''];
}

function pilarColor(c) {
  const [subtono, subExp] = separarExplicacion(c.subtono);
  const [contraste, conExp] = separarExplicacion(c.contraste);
  const el = h(`<div class="pilar">
    <div class="stat-row">
      ${tile('Estación', c.estacion, '🌸')}
      ${tile('Subtono', subtono, '🫧')}
      ${tile('Contraste', contraste, '◐')}
    </div>
    ${c.descripcionEstacion ? `<p>${esc(c.descripcionEstacion)}</p>` : ''}
    ${subExp || conExp ? `<p class="muted small">${esc([subExp, conExp].filter(Boolean).join(' · '))}</p>` : ''}

    <h4 class="sub">🪞 Draping digital</h4>
    <div id="draping"></div>

    <h4 class="sub">Tu paleta</h4>
    <div class="palette-group"><h5>Básicos</h5><div class="swatches">${sw(c.paleta?.basicos)}</div></div>
    <div class="palette-group"><h5>Acentos</h5><div class="swatches">${sw(c.paleta?.acentos)}</div></div>
    <div class="palette-group"><h5>Nudes para tu piel</h5><div class="swatches">${sw(c.paleta?.nudesPiel)}</div></div>
    <div class="palette-group"><h5>Nudes de calzado</h5><div class="swatches">${sw(c.paleta?.nudesCalzado)}</div></div>
    <div class="palette-group avoid"><h5>Colores a evitar cerca del rostro</h5>
      <div class="swatches">${(c.evitar || []).map((x) => swatch(x.hex, x.nombre, 'swatch-avoid')).join('')}</div>
      ${lista((c.evitar || []).filter((x) => x.motivo).map((x) => `${x.nombre}: ${x.motivo}`))}
    </div>

    ${c.metales ? `<h4 class="sub">Metales ideales</h4>
    <div class="metal-row">
      ${METALES.map(([nombre, cls, re]) => {
        const ideal = re.test(norm(c.metales.ideal));
        const alt = !ideal && re.test(norm(c.metales.alternativo));
        return `<div class="metal ${ideal ? 'is-ideal' : alt ? 'is-alt' : 'is-no'}"><span class="metal-dot ${cls}"></span><b>${nombre}</b><small>${ideal ? 'Ideal' : alt ? 'Alternativo' : 'Menos favorecedor'}</small></div>`;
      }).join('')}
    </div>
    ${c.metales.explicacion ? `<p class="muted small">${esc(c.metales.explicacion)}</p>` : ''}` : ''}

    ${c.consejos?.length ? `<h4 class="sub">Consejos de color</h4>${lista(c.consejos)}` : ''}
  </div>`);
  $('#draping', el).appendChild(draping(c));
  return el;
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const METALES = [
  ['Oro amarillo', 'gold', /amarillo|dorado/],
  ['Oro blanco / Plata', 'silver', /plata|blanco|plateado|platino/],
  ['Oro rosa', 'rose', /rosa|rose/],
];

function pilarVisagismo(v) {
  const m = v.maquillaje || {};
  const cab = v.cabello || {};
  return h(`<div class="pilar">
    <div class="stat-row">${tile('Forma de rostro', v.formaRostro, '🙂')}</div>
    ${v.facciones ? `<p>${esc(v.facciones)}</p>` : ''}
    <h4 class="sub">Maquillaje ideal</h4>
    <div class="info-grid">
      ${bloque('Base', m.base, '🧴')}
      ${bloque('Corrector', m.corrector, '✨')}
      ${bloque('Rubor', m.rubor, '🌸')}
      ${bloque('Sombras', m.sombras, '👁️')}
      ${bloque('Delineador', m.delineador, '🖋️')}
      ${bloque('Cejas', v.cejas, '〰️')}
    </div>
    <div class="grid-2">
      <div class="palette-group"><h5>💋 Labiales de día</h5><div class="swatches">${sw(m.labialesDia, 'swatch-lip')}</div></div>
      <div class="palette-group"><h5>💋 Labiales de noche</h5><div class="swatches">${sw(m.labialesNoche, 'swatch-lip')}</div></div>
    </div>
    ${m.tipClima ? `<div class="callout">🌦️ <b>Para tu clima:</b> ${esc(m.tipClima)}</div>` : ''}
    <h4 class="sub">Cabello</h4>
    <div class="info-grid">
      <div class="info-block"><h5>✂️ Cortes ideales</h5>${lista(cab.cortes)}</div>
      <div class="info-block"><h5>💁‍♀️ Peinados</h5>${lista(cab.peinados)}</div>
      ${bloque('Flequillo', cab.flequillo, '〽️')}
      ${bloque('Coloración', cab.coloracion, '🎨')}
    </div>
    ${cab.cuidadoClima ? `<div class="callout">💧 <b>Cabello y clima:</b> ${esc(cab.cuidadoClima)}</div>` : ''}
    ${v.notas ? `<p class="muted small">📝 ${esc(v.notas)}</p>` : ''}
  </div>`);
}

const ACC = [
  ['aretes', 'Aretes', '💎'], ['collares', 'Collares', '📿'], ['lentesOftalmicos', 'Lentes oftálmicos', '👓'],
  ['lentesSol', 'Lentes de sol', '🕶️'], ['bolsos', 'Bolsos', '👜'], ['cinturones', 'Cinturones', '➰'],
  ['panuelosSombreros', 'Pañuelos y sombreros', '👒'], ['relojesPulseras', 'Relojes y pulseras', '⌚'], ['calzado', 'Calzado', '👠'],
];
const PRENDAS = [
  ['tops', 'Blusas y tops', '👚'], ['escotes', 'Escotes', '🔻'], ['pantalones', 'Pantalones', '👖'],
  ['faldas', 'Faldas', '🩱'], ['vestidos', 'Vestidos', '👗'], ['largos', 'Largos ideales', '📏'],
  ['telas', 'Telas para tu clima', '🧵'], ['estampados', 'Estampados', '🌺'],
];

function pilarMorfologia(m) {
  const pr = m.prendas || {};
  const ac = m.accesorios || {};
  return h(`<div class="pilar">
    <div class="stat-row">${tile('Silueta', m.silueta, '⏳')}${store.get().profile.estatura ? tile('Estatura', store.get().profile.estatura + ' cm', '📐') : ''}</div>
    ${m.proporciones ? `<p>${esc(m.proporciones)}</p>` : ''}
    ${m.objetivo ? `<div class="callout">🎯 <b>Tu objetivo de estilismo:</b> ${esc(m.objetivo)}</div>` : ''}
    <h4 class="sub">Ropa que te favorece</h4>
    <div class="info-grid">${PRENDAS.map(([k, t, i]) => bloque(t, pr[k], i)).join('')}</div>
    ${pr.evitar?.length ? `<div class="info-block avoid"><h5>⚠️ Úsalo con moderación</h5>${lista(pr.evitar)}</div>` : ''}
    <h4 class="sub">Accesorios y complementos</h4>
    <div class="info-grid">${ACC.map(([k, t, i]) => bloque(t, ac[k], i)).join('')}</div>
    ${m.notas ? `<p class="muted small">📝 ${esc(m.notas)}</p>` : ''}
  </div>`);
}

function pilarCuidado(c) {
  const p = store.get().profile;
  return h(`<div class="pilar">
    <p class="muted">Rutinas pensadas para el clima <b>${esc(nombreClima(p.clima).toLowerCase())}</b> de ${esc(p.ciudad || 'tu ciudad')}.</p>
    <div class="info-grid">
      <div class="info-block"><h5>☀️ Skincare de mañana</h5>${lista(c.skincareManana)}</div>
      <div class="info-block"><h5>🌙 Skincare de noche</h5>${lista(c.skincareNoche)}</div>
      <div class="info-block"><h5>🗓️ Cuidados semanales</h5>${lista(c.semanal)}</div>
      <div class="info-block"><h5>💆‍♀️ Cuidado capilar</h5>${lista(c.capilar)}</div>
      <div class="info-block"><h5>🧍‍♀️ Postura</h5>${lista(c.postura)}</div>
      <div class="info-block"><h5>👑 Presencia y proyección</h5>${lista(c.proyeccion)}</div>
    </div>
  </div>`);
}

// ------------------------------------------------------------------
// Draping digital interactivo
// ------------------------------------------------------------------
function draping(c) {
  const selfie = store.get().profile.selfie;
  const grupos = [
    ['Básicos', c.paleta?.basicos, ''],
    ['Acentos', c.paleta?.acentos, ''],
    ['Nudes', c.paleta?.nudesPiel, ''],
    ['Evitar', c.evitar, 'avoid'],
  ].filter(([, arr]) => Array.isArray(arr) && arr.length);
  const todos = grupos.flatMap(([g, arr, t]) => arr.map((x) => ({ ...x, grupo: g, tipo: t })));
  const valido = (x) => /^#[0-9a-fA-F]{3,8}$/.test(x?.hex || '');
  const ideales = todos.filter((x) => x.tipo !== 'avoid' && valido(x));
  const evitar = todos.filter((x) => x.tipo === 'avoid' && valido(x));
  const estado = {
    a: ideales[0] || { nombre: 'Marfil', hex: '#F4EBDD' },
    b: evitar[0] || ideales[1] || { nombre: 'Gris', hex: '#888888' },
    comparar: false, capa: true, slot: 'a', timer: null,
  };

  if (!selfie) return h('<p class="muted">Agrega tu selfie para usar el draping digital.</p>');

  const el = h(`<div class="drape">
    <p class="muted small">Toca un color para “ponértelo” alrededor del rostro y observa cómo cambia tu piel: los colores ideales iluminan, emparejan el tono y suavizan ojeras.</p>
    <div class="drape-stages">
      ${['a', 'b'].map((s) => `<figure class="drape-stage" data-slot="${s}" ${s === 'b' ? 'hidden' : ''}>
        <div class="drape-photo"><img src="${selfie}" alt="Tu selfie con draping"></div>
        <div class="drape-cape"></div>
        <figcaption></figcaption>
      </figure>`).join('')}
    </div>
    <div class="drape-controls">
      <label class="switch"><input type="checkbox" data-c="comparar"><span></span> Comparar lado a lado</label>
      <label class="switch"><input type="checkbox" data-c="capa" checked><span></span> Capa de tela</label>
      <button class="btn btn-sm btn-soft" data-c="play">▶ Recorrer paleta</button>
    </div>
    <p class="drape-slot-hint small muted" hidden>Elige qué lado cambiar: toca la foto izquierda o derecha y después un color.</p>
    <div class="drape-swatches">
      ${grupos.map(([g, arr, t]) => `<div class="drape-group ${t}"><h6>${esc(g)}${t === 'avoid' ? ' ✕' : ''}</h6><div>${arr.filter(valido).map((x) => `<button type="button" class="drape-sw" style="--c:${esc(x.hex)}" data-hex="${esc(x.hex)}" data-nombre="${esc(x.nombre)}" data-tipo="${t}" title="${esc(x.nombre)}"></button>`).join('')}</div></div>`).join('')}
    </div>
  </div>`);

  const pintar = () => {
    ['a', 'b'].forEach((s) => {
      const st = $(`.drape-stage[data-slot="${s}"]`, el);
      const col = estado[s];
      st.style.setProperty('--drape', col.hex);
      st.classList.toggle('sin-capa', !estado.capa);
      st.classList.toggle('activo', estado.comparar && estado.slot === s);
      const avoid = col.tipo === 'avoid' || evitar.some((e) => e.hex === col.hex);
      $('figcaption', st).innerHTML = `<b>${esc(col.nombre)}</b> <code>${esc(col.hex.toUpperCase())}</code> ${avoid ? '<span class="tag tag-no">Evitar</span>' : '<span class="tag tag-ok">Favorece</span>'}`;
    });
    $('.drape-stage[data-slot="b"]', el).hidden = !estado.comparar;
    $('.drape-stages', el).classList.toggle('dual', estado.comparar);
    $('.drape-slot-hint', el).hidden = !estado.comparar;
    $$('.drape-sw', el).forEach((b) => b.classList.toggle('sel', b.dataset.hex === estado[estado.slot].hex));
  };

  const parar = () => {
    clearInterval(estado.timer);
    estado.timer = null;
    $('[data-c="play"]', el).textContent = '▶ Recorrer paleta';
  };

  $$('.drape-sw', el).forEach((b) => b.addEventListener('click', () => {
    parar();
    estado[estado.slot] = { nombre: b.dataset.nombre, hex: b.dataset.hex, tipo: b.dataset.tipo };
    pintar();
  }));
  $$('.drape-stage', el).forEach((st) => st.addEventListener('click', () => {
    if (!estado.comparar) return;
    estado.slot = st.dataset.slot;
    pintar();
  }));
  $('[data-c="comparar"]', el).addEventListener('change', (e) => {
    estado.comparar = e.target.checked;
    estado.slot = estado.comparar ? 'b' : 'a';
    pintar();
  });
  $('[data-c="capa"]', el).addEventListener('change', (e) => { estado.capa = e.target.checked; pintar(); });
  $('[data-c="play"]', el).addEventListener('click', (e) => {
    if (estado.timer) return parar();
    const seq = [...ideales, ...evitar];
    let i = 0;
    e.target.textContent = '⏸ Pausar';
    estado.timer = setInterval(() => {
      if (!el.isConnected) return parar();
      estado[estado.slot] = seq[i % seq.length];
      i++;
      pintar();
    }, 1400);
  });
  pintar();
  return el;
}
