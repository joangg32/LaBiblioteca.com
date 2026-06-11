// ============================================================================
// OVERLAY COMPARTIDO
// ============================================================================
// Helper común para todas las interacciones. Crea una capa por encima del menú
// (un "marco" retro centrado o a pantalla completa) con su cabecera, su botón
// de cerrar y su zona de contenido. Devuelve referencias para que cada
// interacción pinte lo suyo dentro de `body`.
//
// Detalles importantes:
//  - La capa se cierra con la X, con ESC o (opcional) clicando el fondo.
//  - El ESC se captura en fase de captura y se detiene la propagación, así NO
//    llega al listener de main.js que cerraría el menú de debajo: primero se
//    cierra la interacción, el menú sigue abierto.
//  - `onClose` permite a cada módulo limpiar recursos (cámara, audio, bucles).

// Paleta de los 4 colores del shader (negro, azul, verde, crema) + acentos UI.
// Se reutiliza para que las interacciones combinen con la estética pixel.
export const PALETTE = {
  black: '#000000',
  blue: '#1d46c1',
  darkBlue: '#0b166b',
  green: '#82b380',
  cream: '#d5d9a2',
  yellow: '#ffe600',
};

// Abre una capa de interacción. El contenido flota sobre el fondo oscuro
// (sin marco): el tamaño lo da el propio contenido y la X cuelga de la esquina,
// como en el mockup.
//   onClose        -> callback de limpieza al cerrar.
//   closeOnBackdrop-> si true, clicar el fondo oscuro cierra la capa.
//   showClose      -> muestra/oculta el botón X.
// Devuelve { backdrop, panel, body, close }.
export function openOverlay({
  onClose = null,
  closeOnBackdrop = true,
  showClose = true,
} = {}) {
  // Fondo oscuro a pantalla completa que atenúa la escena de debajo.
  const backdrop = document.createElement('div');
  backdrop.className = 'iv-backdrop';

  // Panel sin chrome: transparente, sin borde ni tamaño fijo (para el comic).
  const panel = document.createElement('div');
  panel.className = 'iv-panel';

  // Botón de cerrar (X): cuelga del fondo (esquina), como en el mockup.
  let closeBtn = null;
  if (showClose) {
    closeBtn = document.createElement('button');
    closeBtn.className = 'iv-close iv-mockup-close';
    closeBtn.setAttribute('aria-label', 'Cerrar');
    closeBtn.textContent = 'X';
    closeBtn.addEventListener('click', () => close());
  }

  // Zona de contenido: cada interacción mete aquí su HTML/canvas.
  const body = document.createElement('div');
  body.className = 'iv-body';
  panel.appendChild(body);

  backdrop.appendChild(panel);
  if (closeBtn) backdrop.appendChild(closeBtn);

  // ---- Cierre (con guardia para no ejecutarlo dos veces) ----
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKey, true);
    backdrop.classList.remove('visible');
    // Espera al fundido de salida antes de quitarlo del DOM.
    setTimeout(() => backdrop.remove(), 220);
    if (onClose) onClose();
  }

  // ESC cierra ESTA capa y corta la propagación (no cierra el menú de detrás).
  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      close();
    }
  };
  window.addEventListener('keydown', onKey, true);

  // Clic en el fondo (no en el marco) cierra, si está habilitado.
  if (closeOnBackdrop) {
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) close();
    });
  }

  document.body.appendChild(backdrop);
  // Fundido de entrada en el siguiente frame (para que la transición CSS corra).
  requestAnimationFrame(() => backdrop.classList.add('visible'));

  return { backdrop, panel, body, close };
}

// Procesa una imagen replicando el shader de la escena: 1) PIXELADO (se dibuja
// a baja resolución por bloques) y 2) PALETA (cada píxel se mezcla con su color
// de la paleta de 4 tonos según su luminancia, con la misma "fuerza" 0.45 que
// el GLSL). Devuelve un <canvas> que se rellena al cargar la imagen; mantiene la
// transparencia del PNG y el tamaño original (para no descuadrar el mockup).
//   blocks   -> nº de bloques a lo ancho (menos = píxeles más grandes).
//   strength -> 0..1, cuánto se tiñe hacia la paleta (igual que el shader).
// Núcleo del efecto: aplica pixelado + paleta a una FUENTE ya disponible
// (HTMLImageElement cargado o HTMLCanvasElement) y devuelve un <canvas> nuevo
// del mismo tamaño. Síncrono. Útil para procesar placeholders dibujados a mano
// (p. ej. las páginas del cómic) además de imágenes.
export function pixelPalette(source, { blocks = 150, strength = 0.45 } = {}) {
  const W = source.naturalWidth || source.width;
  const H = source.naturalHeight || source.height;
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const octx = out.getContext('2d');

  // 1) PIXELADO: dibujar la fuente a una versión pequeña (bloques).
  const lowW = Math.max(1, Math.min(blocks, W));
  const lowH = Math.max(1, Math.round(lowW * (H / W)));
  const low = document.createElement('canvas');
  low.width = lowW; low.height = lowH;
  const lctx = low.getContext('2d');
  lctx.drawImage(source, 0, 0, lowW, lowH);

  // 2) PALETA: mezclar cada píxel con su color de paleta (conserva alpha).
  const id = lctx.getImageData(0, 0, lowW, lowH);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const [pr, pg, pb] = paletteFromLuminance(lum);
    d[i]     = r + (pr - r) * strength;
    d[i + 1] = g + (pg - g) * strength;
    d[i + 2] = b + (pb - b) * strength;
  }
  lctx.putImageData(id, 0, 0);

  // 3) Reescalar la versión baja al tamaño original SIN suavizado (bloques duros).
  octx.imageSmoothingEnabled = false;
  octx.drawImage(low, 0, 0, lowW, lowH, 0, 0, W, H);
  return out;
}

// Variante para URLs: devuelve un <canvas> que se rellena al cargar la imagen.
export function makePixelPaletteImage(src, opts) {
  const out = document.createElement('canvas');
  const img = new Image();
  img.onload = () => {
    const c = pixelPalette(img, opts);
    out.width = c.width; out.height = c.height;
    out.getContext('2d').drawImage(c, 0, 0);
  };
  img.src = src;
  return out;
}

// Abre una interacción DENTRO de un "marco" (mockup): muestra la foto de un
// dispositivo (monitor, espejo, recreativa…) y coloca el contenido en la zona
// de pantalla del propio marco, para que parezca que pasa en ese aparato.
//   frame   -> ruta de la imagen del marco (con su pantalla en blanco).
//   screen  -> rectángulo de la pantalla en coords normalizadas del marco
//              (0..1): { x, y, w, h }. Origen arriba-izquierda.
//   onClose -> limpieza al cerrar (cámara, audio, bucles…).
// Devuelve { backdrop, stage, body, close } — `body` es la pantalla, donde cada
// módulo pinta lo suyo (mismo rol que el `body` de openOverlay).
//   screenBehind -> si true, el marco (PNG) va POR ENCIMA de la pantalla, así el
//                    contenido (p. ej. el vídeo) se ve a través del marco/cristal.
export function openMockup({
  frame,
  screen,
  onClose = null,
  closeOnBackdrop = true,
  screenBehind = false,
} = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'iv-backdrop';

  // Escenario: se ajusta al tamaño de la imagen del marco; el resto se posiciona
  // en porcentajes sobre él, así todo escala junto al redimensionar.
  const stage = document.createElement('div');
  stage.className = 'iv-mockup';

  // El marco se pinta pasando por el shader (pixel + paleta), como la escena.
  const img = makePixelPaletteImage(frame);
  img.className = 'iv-frame-img';

  // La "pantalla": misma clase iv-body para que los módulos funcionen igual.
  const body = document.createElement('div');
  body.className = 'iv-body iv-screen';
  body.style.left = `${screen.x * 100}%`;
  body.style.top = `${screen.y * 100}%`;
  body.style.width = `${screen.w * 100}%`;
  body.style.height = `${screen.h * 100}%`;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'iv-close iv-mockup-close';
  closeBtn.setAttribute('aria-label', 'Cerrar');
  closeBtn.textContent = 'X';
  closeBtn.addEventListener('click', () => close());

  // Orden de apilado: por defecto la pantalla va sobre el marco (contenido
  // dentro del hueco). Con screenBehind, el marco va encima (el vídeo se ve a
  // través del cristal/PNG). El <img> lleva pointer-events:none, así los clics
  // siguen llegando al contenido aunque quede debajo.
  if (screenBehind) {
    // El marco debe pintar por ENCIMA de la pantalla. Como la pantalla es
    // position:absolute (siempre pinta sobre los estáticos), al marco le damos
    // posición y z-index mayor con la clase iv-frame-front.
    img.classList.add('iv-frame-front');
    stage.appendChild(body);
    stage.appendChild(img);
  } else {
    stage.appendChild(img);
    stage.appendChild(body);
  }
  backdrop.appendChild(stage);
  // El botón cuelga del backdrop (no del marco) para quedar fijo en la esquina
  // superior derecha de la pantalla, igual que el cierre del menú (#menu-close).
  backdrop.appendChild(closeBtn);

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKey, true);
    backdrop.classList.remove('visible');
    setTimeout(() => backdrop.remove(), 220);
    if (onClose) onClose();
  }
  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      close();
    }
  };
  window.addEventListener('keydown', onKey, true);
  if (closeOnBackdrop) {
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) close();
    });
  }

  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('visible'));

  return { backdrop, stage, body, close };
}

// Carga un script externo (CDN) una sola vez y resuelve cuando está listo.
// Se usa, por ejemplo, para traer p5.js en el espejo.
const loadedScripts = {};
export function loadScript(src) {
  if (loadedScripts[src]) return loadedScripts[src];
  loadedScripts[src] = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return loadedScripts[src];
}

// Mapea una luminancia (0..1) a uno de los 4 colores de la paleta, replicando
// los mismos umbrales que el shader GLSL de main.js. Devuelve [r,g,b] 0..255.
// Útil para las interacciones que "pixelan" en canvas (espejo, acuario).
export function paletteFromLuminance(lum) {
  const c0 = [0, 0, 0];
  const c1 = [29, 70, 193];
  const c2 = [130, 179, 128];
  const c3 = [213, 217, 162];
  const mix = (a, b, t) => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
  const t0 = 0.12, t1 = 0.35, t2 = 0.65;
  if (lum < t0) return mix(c0, c1, lum / t0);
  if (lum < t1) return mix(c1, c2, (lum - t0) / (t1 - t0));
  if (lum < t2) return mix(c2, c3, (lum - t1) / (t2 - t1));
  return c3;
}
