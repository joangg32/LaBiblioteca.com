// ============================================================================
// CAMPANA
// ============================================================================
// Al tocarla suena la campanilla de recepción reproduciendo ./assets/campana.mp3.
// Se reutiliza un único elemento de audio y se reinicia en cada clic, así suena
// bien aunque la toques varias veces seguidas.

const BELL_SRC = './assets/campana.mp3';

let bellAudio = null;

// Acción al tocar la campana: reinicia y reproduce el sonido de recepción.
export function ringBell() {
  if (!bellAudio) {
    bellAudio = new Audio(BELL_SRC);
    bellAudio.volume = 0.8;
  }
  bellAudio.currentTime = 0;       // reinicia por si ya estaba sonando.
  bellAudio.play().catch(() => {}); // ignora el bloqueo de autoplay si lo hubiera.
}
