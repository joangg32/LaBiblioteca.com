// ============================================================================
// MÁQUINA RECREATIVA — MINIJUEGO DE MARCIANITOS
// ============================================================================
// Al pulsar se abre un minijuego tipo "Space Invaders" dibujado en canvas, con
// la paleta de colores de la escena. Controles: ◀ ▶ (o A/D) para mover la nave,
// ESPACIO para disparar. Hay marcador, vidas, oleadas y pantalla de game over.
//
// Todo es autónomo (no necesita assets). El bucle se detiene al cerrar la capa.
//
// Nota: los eventos de teclado del juego se capturan y se detiene su
// propagación para que NO muevan la cámara 3D ni cierren cosas por debajo.

import { openMockup, PALETTE } from './overlay.js';

// Marco (mueble de la recreativa) y zona de pantalla (el juego va dentro).
const FRAME = './assets/arcade.png';
const SCREEN = { x: 0.158, y: 0.250, w: 0.704, h: 0.437 };

// ============================================================================
// SONIDOS 8-BIT DEL MINIJUEGO (sintetizados con Web Audio, sin assets)
// ============================================================================
// Reutilizamos un único AudioContext para todos los efectos del arcade. Cada
// efecto es un tono (o ruido) muy corto con envolvente, al estilo de los
// marcianitos clásicos, para encajar con la estética pixel del resto del sitio.
let arcadeAudioCtx = null;
function actx() {
  arcadeAudioCtx = arcadeAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
  return arcadeAudioCtx;
}

// Tono con envolvente. type: forma de onda; f0->f1: barrido de frecuencia;
// dur: duración (s); vol: volumen pico. Un f1 distinto de f0 hace el "pew".
function beep({ type = 'square', f0 = 440, f1 = f0, dur = 0.12, vol = 0.15 } = {}) {
  try {
    const ctx = actx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur); // se apaga al final.
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  } catch (e) { /* si el navegador bloquea el audio, se ignora. */ }
}

// Ráfaga de ruido blanco con caída de volumen: sirve para las explosiones.
function noise({ dur = 0.2, vol = 0.18 } = {}) {
  try {
    const ctx = actx();
    const t = ctx.currentTime;
    const n = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(gain).connect(ctx.destination);
    src.start(t);
  } catch (e) { /* si el navegador bloquea el audio, se ignora. */ }
}

// Catálogo de efectos del juego.
const SFX = {
  // Disparo de la nave: "pew" agudo que cae rápido.
  shoot:     () => beep({ type: 'square',   f0: 880, f1: 220, dur: 0.12, vol: 0.10 }),
  // Marciano destruido: pequeña explosión de ruido.
  explosion: () => noise({ dur: 0.18, vol: 0.16 }),
  // Te alcanzan: tono grave descendente, más contundente.
  hit:       () => beep({ type: 'sawtooth', f0: 300, f1: 60,  dur: 0.35, vol: 0.18 }),
  // Oleada superada: dos notas ascendentes.
  wave:      () => { beep({ type: 'square', f0: 523, dur: 0.10, vol: 0.14 });
                     setTimeout(() => beep({ type: 'square', f0: 784, dur: 0.14, vol: 0.14 }), 110); },
  // Game over: descenso grave en dos pasos.
  gameover:  () => { beep({ type: 'square', f0: 392, f1: 196, dur: 0.5, vol: 0.16 });
                     setTimeout(() => beep({ type: 'square', f0: 262, f1: 98, dur: 0.7, vol: 0.16 }), 260); },
  // Victoria: arpegio ascendente alegre.
  win:       () => { [523, 659, 784, 1047].forEach((f, i) =>
                       setTimeout(() => beep({ type: 'square', f0: f, dur: 0.16, vol: 0.15 }), i * 130)); },
};

// Acción al tocar la recreativa: abre el mockup y arranca el minijuego.
export function openArcade() {
  let raf = null;

  const { body } = openMockup({
    frame: FRAME,
    screen: SCREEN,
    screenBehind: true, // el juego va DETRÁS del PNG (se ve por el hueco del mueble).
    onClose: cleanup,
  });
  body.classList.add('iv-arcade');

  const W = 460, H = 520;
  // Contenedor relativo: el canvas del juego + el panel de marcador encima.
  const wrap = document.createElement('div');
  wrap.className = 'arcade-wrap';
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  canvas.className = 'arcade-canvas';
  wrap.appendChild(canvas);
  // Panel de fin de partida / marcador (oculto durante el juego).
  const endPanel = document.createElement('div');
  endPanel.className = 'arcade-gameover';
  wrap.appendChild(endPanel);
  body.appendChild(wrap);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // ---- Estado del juego ----
  const player = { x: W / 2, y: H - 40, w: 28, h: 14, speed: 4 };
  let bullets = [];      // disparos de la nave.
  let bombs = [];        // disparos de los marcianos.
  let invaders = [];
  let dir = 1;           // dirección horizontal del enjambre.
  let invSpeed = 0.5;
  let score = 0;
  let lives = 3;
  let wave = 1;
  let state = 'play';    // 'play' | 'over' | 'win'
  let endShown = false;  // true cuando ya se mostró el panel de marcador.
  let shootCooldown = 0;
  const keys = {};

  // Crea una oleada de marcianos en rejilla.
  function spawnWave() {
    invaders = [];
    const cols = 8, rows = 4;
    const gx = 40, gy = 50, sx = 46, sy = 38;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        invaders.push({ x: gx + c * sx, y: gy + r * sy, w: 26, h: 18, alive: true, row: r });
      }
    }
    dir = 1;
    invSpeed = 0.35 + wave * 0.1;
  }
  spawnWave();

  // ---- Entrada de teclado (capturada para no afectar a la escena) ----
  function onKeyDown(e) {
    const k = e.key.toLowerCase();
    if ([' ', 'arrowleft', 'arrowright', 'a', 'd'].includes(k)) {
      e.preventDefault();
      e.stopPropagation();
    }
    keys[k] = true;
  }
  function onKeyUp(e) {
    keys[e.key.toLowerCase()] = false;
  }
  // Capturamos en window (fase de captura) para ganarle al listener de la escena.
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);

  function restart() {
    score = 0; lives = 3; wave = 1; state = 'play';
    bullets = []; bombs = [];
    player.x = W / 2;
    endShown = false;
    endPanel.classList.remove('visible');
    endPanel.innerHTML = '';
    spawnWave();
  }

  // ---- Panel de fin de partida: muestra la puntuación y permite volver a jugar ----
  function showEndPanel() {
    endShown = true;
    endPanel.classList.add('visible');
    const won = state === 'win';
    if (won) SFX.win(); else SFX.gameover(); // jingle final (suena una vez).

    endPanel.innerHTML = `
      <h3 class="ag-title ${won ? 'ag-win' : ''}">${won ? '¡GANASTE!' : 'GAME OVER'}</h3>
      <p class="ag-score">TU PUNTUACIÓN: ${score}</p>
      <button type="button" class="ag-btn" data-action="replay">JUGAR DE NUEVO</button>`;

    endPanel.querySelector('[data-action="replay"]').addEventListener('click', restart);
  }

  // ---- Dibujo de sprites pixelados ----
  function drawShip(x, y) {
    ctx.fillStyle = PALETTE.green;
    ctx.fillRect(x - 14, y + 4, 28, 8);   // base.
    ctx.fillRect(x - 6, y - 4, 12, 8);    // torreta.
    ctx.fillRect(x - 2, y - 10, 4, 6);    // cañón.
  }
  function drawInvader(inv, t) {
    const wobble = Math.floor(t / 300) % 2 === 0 ? 1 : -1; // animación 2 frames.
    ctx.fillStyle = inv.row === 0 ? PALETTE.yellow : (inv.row < 2 ? PALETTE.cream : PALETTE.blue);
    const { x, y, w, h } = inv;
    ctx.fillRect(x, y + 4, w, h - 8);          // cuerpo.
    ctx.fillRect(x + 4, y, w - 8, 6);          // cabeza.
    ctx.fillRect(x - 4, y + 6, 4, 6);          // brazo izq.
    ctx.fillRect(x + w, y + 6, 4, 6);          // brazo der.
    // patitas alternando (wobble).
    ctx.fillRect(x + 2, y + h - 4, 4, 4 * (wobble > 0 ? 1 : 1));
    ctx.fillRect(x + w - 6, y + h - 4, 4, 4);
    // ojos.
    ctx.fillStyle = PALETTE.black;
    ctx.fillRect(x + 6, y + 6, 4, 4);
    ctx.fillRect(x + w - 10, y + 6, 4, 4);
  }

  // ---- Bucle principal ----
  function frame(t) {
    // Fondo + estrellas fijas.
    ctx.fillStyle = PALETTE.black;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(251,255,190,0.25)';
    for (let i = 0; i < 30; i++) {
      const sx = (i * 53) % W, sy = (i * 97 + (t * 0.02)) % H;
      ctx.fillRect(sx, sy, 2, 2);
    }

    if (state === 'play') {
      update(t);
    }

    // Marcianos.
    for (const inv of invaders) if (inv.alive) drawInvader(inv, t);
    // Disparos.
    ctx.fillStyle = PALETTE.cream;
    for (const b of bullets) ctx.fillRect(b.x - 2, b.y, 4, 10);
    ctx.fillStyle = PALETTE.yellow;
    for (const b of bombs) ctx.fillRect(b.x - 2, b.y, 4, 10);
    // Nave.
    if (state !== 'over') drawShip(player.x, player.y);

    // HUD.
    ctx.fillStyle = PALETTE.cream;
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${score}`, 12, 24);
    ctx.textAlign = 'right';
    ctx.fillText(`VIDAS ${lives}`, W - 12, 24);
    ctx.textAlign = 'center';
    ctx.fillText(`OLEADA ${wave}`, W / 2, 24);

    // Fin de partida: tinte de fondo en el canvas y, una sola vez, se abre el
    // panel DOM con el registro de puntuaciones (encima del canvas).
    if (state === 'over' || state === 'win') {
      ctx.fillStyle = 'rgba(11,22,107,0.78)';
      ctx.fillRect(0, 0, W, H);
      if (!endShown) showEndPanel();
    }

    raf = requestAnimationFrame(frame);
  }

  // ---- Lógica por frame ----
  function update(t) {
    // Movimiento de la nave.
    if (keys['arrowleft'] || keys['a']) player.x -= player.speed;
    if (keys['arrowright'] || keys['d']) player.x += player.speed;
    player.x = Math.max(20, Math.min(W - 20, player.x));

    // Disparo (con enfriamiento).
    if (shootCooldown > 0) shootCooldown--;
    if (keys[' '] && shootCooldown === 0) {
      bullets.push({ x: player.x, y: player.y - 12 });
      shootCooldown = 18;
      SFX.shoot();
    }

    // Disparos de la nave.
    bullets.forEach((b) => (b.y -= 7));
    bullets = bullets.filter((b) => b.y > -10);

    // Movimiento del enjambre: rebota en los bordes y baja.
    let minX = Infinity, maxX = -Infinity, descend = false;
    for (const inv of invaders) {
      if (!inv.alive) continue;
      inv.x += dir * invSpeed;
      minX = Math.min(minX, inv.x);
      maxX = Math.max(maxX, inv.x + inv.w);
    }
    if (minX < 16 || maxX > W - 16) { dir *= -1; descend = true; }
    if (descend) for (const inv of invaders) if (inv.alive) inv.y += 16;

    // Marcianos disparan al azar desde abajo.
    if (Math.random() < 0.02 + wave * 0.004) {
      const alive = invaders.filter((i) => i.alive);
      if (alive.length) {
        const shooter = alive[Math.floor(Math.random() * alive.length)];
        bombs.push({ x: shooter.x + shooter.w / 2, y: shooter.y + shooter.h });
      }
    }
    bombs.forEach((b) => (b.y += 2.6));
    bombs = bombs.filter((b) => b.y < H + 10);

    // Colisión disparo -> marciano.
    for (const b of bullets) {
      for (const inv of invaders) {
        if (inv.alive && hit(b.x, b.y, inv)) {
          inv.alive = false;
          b.y = -100; // marca el disparo para borrarlo.
          score += (4 - inv.row) * 10;
          SFX.explosion();
        }
      }
    }
    bullets = bullets.filter((b) => b.y > -10);

    // Colisión bomba -> nave.
    for (const b of bombs) {
      if (Math.abs(b.x - player.x) < 16 && Math.abs(b.y - player.y) < 12) {
        b.y = H + 100;
        SFX.hit();
        loseLife();
      }
    }
    bombs = bombs.filter((b) => b.y < H + 10);

    // ¿Marcianos llegan abajo? -> derrota.
    for (const inv of invaders) {
      if (inv.alive && inv.y + inv.h >= player.y - 6) { state = 'over'; }
    }

    // ¿Oleada eliminada? -> siguiente oleada.
    if (invaders.every((i) => !i.alive)) {
      wave++;
      if (wave > 5) state = 'win';
      else { spawnWave(); SFX.wave(); }
    }
  }

  function hit(x, y, inv) {
    return x > inv.x - 4 && x < inv.x + inv.w + 4 && y > inv.y && y < inv.y + inv.h;
  }
  function loseLife() {
    lives--;
    if (lives <= 0) state = 'over';
  }

  function cleanup() {
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keyup', onKeyUp, true);
  }

  raf = requestAnimationFrame(frame);
}
