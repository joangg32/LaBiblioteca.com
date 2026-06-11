// ============================================================================
// ESPEJO — EFECTO PIN-ART 3D CON p5.js + CÁMARA (WEBGL)
// ============================================================================
// Al pulsar se abre el "espejo": se pide acceso a la webcam y se muestra al
// usuario como un tablero de "pines" en 3D (estilo pin-art). Cada celda de la
// rejilla es una caja cuya PROFUNDIDAD depende del brillo del píxel (claro =
// sobresale, oscuro = hundido) y cuyo COLOR es el de la MISMA paleta de 4 tonos
// del shader de la escena, para mantener la estética.
//
// La cámara se pide con getUserMedia directamente (no con createCapture) para
// poder mostrar en pantalla el ERROR exacto si falla (permiso denegado, cámara
// en uso, contexto no seguro…). Cada frame se dibuja el vídeo, escalado y
// espejado, en un canvas 2D oculto del tamaño de la rejilla: así cada píxel de
// ese canvas es directamente un pin (sin recorrer la imagen a mano).

import { openMockup, loadScript, paletteFromLuminance } from './overlay.js';

const P5_CDN = 'https://unpkg.com/p5@1.9.0/lib/p5.min.js';

// Rejilla de pines y profundidad máxima (px del pin más claro).
const COLS = 36;
const ROWS = 36;
const PIN_DEPTH = 90;

// La webcam suele dar imágenes oscuras y la paleta manda casi todo a negro.
// GAIN multiplica el brillo y GAMMA (<1) levanta los tonos medios/oscuros para
// que la imagen aproveche todo el rango de la paleta. Súbelos si se ve oscuro.
const GAIN = 0.5;
const GAMMA = 0.7; // <1 aclara, ~1 neutro, >1 oscurece. Subir = tonos más oscuros.

// Marco (espejo de madera) y zona de pantalla (el reflejo va dentro).
const FRAME = './assets/espejo.png';
const SCREEN = { x: 0.097, y: 0.099, w: 0.810, h: 0.793 };

// Acción al tocar el espejo: carga p5.js, pide la cámara y pinta el reflejo
// como tablero de pines 3D. Es async porque espera a que p5 cargue del CDN.
export async function openMirror() {
  let sketch = null;        // instancia p5 (para destruirla al cerrar).
  let mediaStream = null;   // stream de la cámara (para apagarla al cerrar).

  const { body } = openMockup({
    frame: FRAME,
    screen: SCREEN,
    onClose: () => {
      if (sketch) sketch.remove();            // detiene el bucle de dibujo.
      // Apaga la cámara (la luz del portátil) parando todas las pistas.
      if (mediaStream) mediaStream.getTracks().forEach((t) => t.stop());
    },
  });
  body.classList.add('iv-mirror');
  const msg = document.createElement('p');
  msg.className = 'mirror-msg';
  msg.textContent = 'Activando el espejo… permite el acceso a la cámara.';
  body.appendChild(msg);

  // <video> que recibe el stream de la webcam. Va en el DOM pero oculto (1px,
  // opacidad 0): NO usamos display:none porque algunos navegadores dejan de
  // decodificar fotogramas de un vídeo oculto así → drawImage saldría negro.
  const video = document.createElement('video');
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.setAttribute('playsinline', ''); // evita pantalla completa en móvil.
  video.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;';
  body.appendChild(video);

  // Pide la cámara y, según el resultado, arranca el vídeo o muestra el error.
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    msg.textContent = 'La cámara no está disponible aquí. Abre la página en http://localhost (no como archivo file://).';
  } else {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        mediaStream = stream;
        video.srcObject = stream;
        video.play();
        // El aviso se quita en draw() en cuanto hay frame (readyState>=2), así
        // evitamos depender del evento 'loadeddata' (que puede dispararse antes
        // de añadir el listener y dejar el vídeo "listo pero sin pintar").
      })
      .catch((err) => {
        // NotAllowedError = permiso denegado; NotFoundError = sin cámara;
        // NotReadableError = otra app la está usando.
        msg.textContent = `No se pudo abrir la cámara (${err.name}). Acepta el permiso del navegador y abre la página en http://localhost.`;
      });
  }

  // Carga p5 si aún no está, y monta el sketch.
  try {
    await loadScript(P5_CDN);
  } catch {
    msg.textContent = 'No se pudo cargar p5.js (¿sin conexión?).';
    return;
  }

  const host = document.createElement('div');
  host.className = 'mirror-canvas';
  // Montamos el contenedor en el DOM ANTES de crear el sketch, para que el
  // canvas WEBGL se cree ya conectado (un canvas desconectado puede no pintar).
  body.appendChild(host);

  // Canvas 2D oculto del tamaño de la rejilla: dibujamos el vídeo aquí (pequeño
  // y espejado) y leemos sus píxeles. Cada píxel = un pin. willReadFrequently
  // optimiza las lecturas repetidas con getImageData.
  const sampler = document.createElement('canvas');
  sampler.width = COLS;
  sampler.height = ROWS;
  const sctx = sampler.getContext('2d', { willReadFrequently: true });

  sketch = new window.p5((p) => {
    // Lienzo cuadrado (la pantalla del marco es casi 1:1). El "campo" de pines
    // ocupa solo una parte del lienzo para dejar aire alrededor y que el tablero
    // no se salga al inclinarlo en 3D.
    const W = 600, H = 600; // lienzo más grande → reflejo +30% en el marco.
    const fieldW = W * 0.93; // tablero al 93% del lienzo.
    const fieldH = H * 0.93;
    const cellW = fieldW / COLS;
    const cellH = fieldH / ROWS;
    const boxSize = Math.min(cellW, cellH) * 0.9; // hueco entre pines.

    p.setup = () => {
      const c = p.createCanvas(W, H, p.WEBGL);
      c.parent(host);
      p.pixelDensity(1);
      p.noStroke();
    };

    p.draw = () => {
      p.background(0);
      // Sin frame de vídeo todavía (sin permiso o aún cargando): no pintamos.
      // readyState>=2 (HAVE_CURRENT_DATA) garantiza que hay imagen que muestrear.
      if (!mediaStream || video.readyState < 2) return;
      if (msg.parentNode) msg.remove(); // ya hay imagen: fuera el aviso.

      // Dibuja el vídeo en el canvas-rejilla, escalado a COLS x ROWS y espejado
      // en horizontal (efecto selfie). El espejo: trasladamos y escalamos -1 en X.
      sctx.save();
      sctx.translate(COLS, 0);
      sctx.scale(-1, 1);
      sctx.drawImage(video, 0, 0, COLS, ROWS);
      sctx.restore();
      const data = sctx.getImageData(0, 0, COLS, ROWS).data;

      // Arrastrar con el ratón gira el tablero.
      p.orbitControl(1, 1, 0.1);
      // Luz: ambiente alta para que el color SIEMPRE se vea (si no, los pines
      // salen casi negros), + direccional/puntual para dar volumen a los pines.
      p.ambientLight(120);
      p.directionalLight(90, 90, 90, 0.4, 0.5, -1);
      p.pointLight(90, 90, 90, p.mouseX - W / 2, p.mouseY - H / 2, 300);

      // Ligera inclinación base para ver la profundidad de los pines.
      p.rotateX(p.radians(-8));

      for (let gy = 0; gy < ROWS; gy++) {
        for (let gx = 0; gx < COLS; gx++) {
          const idx = 4 * (gy * COLS + gx);
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // Luminancia perceptual (mismos pesos que el shader), realzada con
          // ganancia + gamma para que una webcam oscura no salga toda negra.
          let lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          lum = Math.pow(Math.min(1, lum * GAIN), GAMMA);
          // Color de la paleta del sitio según la luminancia.
          const [pr, pg, pb] = paletteFromLuminance(lum);
          // Profundidad: claro (1) sobresale, oscuro (0) casi plano.
          const d = p.map(lum, 0, 1, 4, PIN_DEPTH);

          p.push();
            // Posición de la celda centrada en el campo de pines.
            const posx = (gx - (COLS - 1) / 2) * cellW;
            const posy = (gy - (ROWS - 1) / 2) * cellH;
            // Empuja el pin hacia el espectador desde un plano de fondo común.
            p.translate(posx, posy, d / 2);
            // fill() = color difuso: reacciona a las luces (caras frontales más
            // claras, laterales sombreados) → volumen real y color visible.
            p.fill(pr, pg, pb);
            p.box(boxSize, boxSize, d); // ancho, alto, profundidad variable.
          p.pop();
        }
      }
    };
  }, host);
}
