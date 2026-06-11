// ============================================================================
// ACUARIO — VÍDEO DENTRO DE UN MARCO (MOCKUP)
// ============================================================================
// Se muestra la urna acuario.png como marco (mockup, igual que monitores/espejo)
// y DENTRO, en su pantalla, se reproduce el vídeo ./assets/acuario.mp4 tal cual
// (SIN el shader de pixel/paleta: el vídeo se ve con su color y nitidez reales).
// El marco PNG sí mantiene el efecto pixel/paleta (lo aplica openMockup).

import { openMockup } from './overlay.js';

const FRAME = './assets/acuario.png';
const VIDEO_SRC = './assets/acuario.mp4';
// Zona de pantalla del marco (coords normalizadas 0..1). `h` = alto del vídeo.
const SCREEN = { x: 0.165, y: 0.130, w: 0.7, h: 0.6 };

// Acción al tocar el acuario: abre el mockup y reproduce el vídeo en bucle.
export function openAquarium() {
  let video = null;

  const { body } = openMockup({
    frame: FRAME,
    screen: SCREEN,
    screenBehind: true, // el vídeo va DETRÁS del PNG (se ve a través del marco).
    onClose: () => {
      if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
    },
  });
  body.classList.add('iv-aquarium');

  // Vídeo reproducido directamente (sin procesar): llena la pantalla del marco.
  video = document.createElement('video');
  video.className = 'aquarium-video';
  video.src = VIDEO_SRC;
  video.loop = true;
  video.muted = true;        // necesario para autoplay.
  video.playsInline = true;
  video.autoplay = true;
  body.appendChild(video);
  video.play().catch(() => {});
}
