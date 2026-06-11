// ============================================================================
// ORDENADOR 2 — FUERA DE SERVICIO
// ============================================================================
// Al pulsar muestra una pantalla de terminal averiada: fondo azul tipo
// "pantallazo", líneas de scanline, parpadeo y un mensaje de error retro.
// No necesita ningún asset; todo es CSS + un poco de texto.

// openMockup pinta el marco del monitor y devuelve la zona de pantalla (body)
// donde se coloca el contenido. Ver interactions/overlay.js.
import { openMockup } from './overlay.js';

// Marco (segundo monitor CRT) y zona de pantalla.
// SCREEN: rectángulo de la pantalla dentro del PNG, en coords normalizadas
// (0..1) con origen arriba-izquierda. Define dónde "encaja" el contenido.
const FRAME = './assets/monitor-2.png';
const SCREEN = { x: 0.097, y: 0.154, w: 0.805, h: 0.560 };

// Abre la interacción del segundo ordenador: una pantalla averiada (puro CSS).
export function openOffline() {
  // Se monta el mockup; screenBehind:true hace que el marco quede por
  // encima del contenido, para que la pantalla se vea "tras" el monitor.
  const { body } = openMockup({ frame: FRAME, screen: SCREEN, screenBehind: true });
  // Clase de estilo: fondo azul tipo "pantallazo", scanlines y parpadeo (CSS).
  body.classList.add('iv-offline');

  // Se vuelca el contenido de la pantalla: título glitch, código de error,
  // mensaje y un prompt de DOS con el cursor parpadeante.
  body.innerHTML = `
    <div class="off-screen">
      <div class="off-glitch">FUERA DE SERVICIO</div>
      <p class="off-code">ERROR 0x000B16 — SYSTEM HALTED</p>
      <p class="off-msg">
        El terminal dejó de responder hace mucho tiempo.<br>
        El cursor sigue parpadeando, pero nadie contesta.
      </p>
      <!-- C:\> con el caret (▌) que parpadea vía la clase off-caret -->
      <p class="off-prompt">C:\\&gt; <span class="off-caret">▌</span></p>
    </div>`;
}
