// ============================================================================
// MÚSICA AMBIENTE — sonido de fondo por defecto
// ============================================================================
// Reproduce ./assets/videoplayback.m4a en bucle como música ambiente del sitio.
// Arranca en cuanto el usuario entra (el navegador bloquea el autoplay sin un
// gesto previo, por eso se llama desde el botón ENTRAR del onboarding).
// Un botón flotante (misma estética que el de la radio) permite silenciar y
// reactivar la música en cualquier momento.

const AMBIENT_SRC = './assets/videoplayback.m4a';

// Estado del reproductor (singleton: persiste durante toda la experiencia).
const ambient = {
  audioEl: null,   // elemento <audio> reutilizado.
  badge: null,     // botón flotante "MÚSICA".
  playing: false,  // si suena ahora mismo.
  started: false,  // si ya se arrancó alguna vez.
};

// Crea (una vez) el <audio> en bucle a volumen suave de fondo.
function ensureAudio() {
  if (ambient.audioEl) return ambient.audioEl;
  const a = new Audio(AMBIENT_SRC);
  a.loop = true;       // se repite sin fin.
  a.volume = 0.35;     // bajo, para que no tape los demás sonidos.
  ambient.audioEl = a;
  return a;
}

// Crea (una vez) el botón flotante "MÚSICA" para silenciar/reactivar.
function ensureBadge() {
  if (ambient.badge) return;
  const b = document.createElement('button');
  b.id = 'ambient-badge';
  // Mismo ecualizador animado que el badge de la radio.
  b.innerHTML = '<span class="radio-eq"><i></i><i></i><i></i><i></i></span> MÚSICA';
  b.addEventListener('click', toggle); // clic = silenciar / reanudar.
  document.body.appendChild(b);
  ambient.badge = b;
}

// Refleja el estado (sonando/silenciado) en el botón.
function updateBadge() {
  if (!ambient.badge) return;
  ambient.badge.classList.toggle('muted', !ambient.playing);
  ambient.badge.title = ambient.playing
    ? 'Música ambiente — clic para silenciar'
    : 'Música silenciada — clic para reanudar';
}

function play() {
  const a = ensureAudio();
  a.play().then(() => { ambient.playing = true; updateBadge(); }).catch(() => {});
}

function pause() {
  if (ambient.audioEl) ambient.audioEl.pause();
  ambient.playing = false;
  updateBadge();
}

// Silencia si suena; reanuda si está parada.
function toggle() {
  if (ambient.playing) pause();
  else play();
}

// Arranca la música ambiente. Debe llamarse tras un gesto del usuario
// (p. ej. el botón ENTRAR), si no el navegador bloquea el autoplay.
export function startAmbient() {
  ensureBadge();
  ambient.badge.classList.add('visible');
  if (ambient.started) return; // no reiniciar si ya estaba en marcha.
  ambient.started = true;
  play();
}
