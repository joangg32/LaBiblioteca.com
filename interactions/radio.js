// ============================================================================
// RADIOCASSETE — MÚSICA QUE SIGUE SONANDO
// ============================================================================
// Al tocar el radiocassete empieza la música DIRECTAMENTE (sin menú). CLAVE: si
// cierras el menú la música SIGUE SONANDO, porque el reproductor vive a nivel
// global (un singleton) y no depende de ninguna capa. Para PARARLA se usa el
// botón "RADIO" que aparece en la esquina mientras suena.
//
// Audio: reproduce ./assets/music.mp3. Si no se pudiera cargar, cae a una
// melodía chiptune sintetizada con la Web Audio API como respaldo.

const RADIO_SRC = './assets/music.mp3'; // canción que suena al encender la radio.

// ---- Singleton del reproductor (persiste entre aperturas/cierres) ----
const radio = {
  playing: false,
  mode: null,        // 'file' | 'synth'
  audioEl: null,     // <audio> si se usa archivo.
  ctx: null,         // AudioContext si se usa el sintetizador.
  synthTimer: null,  // temporizador del secuenciador chiptune.
  badge: null,       // botón "ahora suena" (clic para parar).
};

// Melodía chiptune de respaldo (notas en Hz, en bucle).
const MELODY = [
  392, 392, 440, 392, 523, 494, 0, 392,
  392, 440, 392, 587, 523, 0, 392, 392,
  784, 659, 523, 494, 440, 0, 698, 698,
  659, 523, 587, 523, 0, 0, 0, 0,
];
const NOTE_MS = 200;

function startSynth() {
  const AC = window.AudioContext || window.webkitAudioContext;
  radio.ctx = new AC();
  const ctx = radio.ctx;
  let step = 0;

  // Secuenciador simple: cada NOTE_MS dispara una nota cuadrada (8-bit).
  radio.synthTimer = setInterval(() => {
    const f = MELODY[step % MELODY.length];
    step++;
    if (!f) return; // silencio.
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square'; // onda cuadrada = sonido de chip clásico.
    osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + NOTE_MS / 1000);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + NOTE_MS / 1000);
  }, NOTE_MS);
  radio.mode = 'synth';
}

function startFile() {
  const a = new Audio(RADIO_SRC);
  a.loop = true;
  a.volume = 0.6;
  radio.audioEl = a;
  radio.mode = 'file';
  return a.play();
}

// Crea (una vez) el botón flotante "RADIO" que aparece mientras suena. Es el
// único control para PARAR la música.
function ensureBadge() {
  if (radio.badge) return;
  const b = document.createElement('button');
  b.id = 'radio-badge';
  b.title = 'Radio sonando — clic para parar';
  b.innerHTML = '<span class="radio-eq"><i></i><i></i><i></i><i></i></span> RADIO';
  b.addEventListener('click', stop); // clic en el badge apaga la radio.
  document.body.appendChild(b);
  radio.badge = b;
}

function play() {
  if (radio.playing) return; // ya está sonando: no hacemos nada.
  radio.playing = true;
  ensureBadge();
  radio.badge.classList.add('visible');
  // Intenta el archivo; si falla (no existe), cae al sintetizador.
  startFile().catch(() => {
    radio.audioEl = null;
    startSynth();
  });
}

function stop() {
  if (!radio.playing) return;
  radio.playing = false;
  if (radio.mode === 'file' && radio.audioEl) {
    radio.audioEl.pause();
    radio.audioEl.currentTime = 0;
  }
  if (radio.mode === 'synth') {
    clearInterval(radio.synthTimer);
    radio.synthTimer = null;
    if (radio.ctx) { radio.ctx.close(); radio.ctx = null; }
  }
  if (radio.badge) radio.badge.classList.remove('visible');
}

// Acción al tocar el radiocassete: arranca la música directamente.
export function openRadio() {
  play();
}
