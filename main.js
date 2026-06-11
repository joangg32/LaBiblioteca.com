// ============================================================================
// IMPORTACIONES
// ============================================================================
// Three.js:
//  - RGBELoader: cargador para imágenes HDR (.hdr) de alto rango dinámico, solo haría falta si la panorámica fuese .hdr o .exr
//  - RenderPass: dibuja la escena tal cual.
//  - ShaderPass: aplica un shader (GLSL) de pixeles para mantener la estética pixel art.
//  - EffectComposer: encadena las dos capas.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Interacciones de cada elemento de los menús. Cada módulo expone una función
// que abre su capa (o reproduce su efecto). Se enganchan en onMenuElementClick.
import { ringBell } from './interactions/bell.js';
import { openRegister } from './interactions/computer-register.js';
import { openOffline } from './interactions/computer-offline.js';
import { openMirror } from './interactions/mirror.js';
import { openAquarium } from './interactions/aquarium.js';
import { openComic } from './interactions/comic.js';
import { openRadio } from './interactions/radio.js';
import { openArcade } from './interactions/arcade.js';
// Música ambiente de fondo (suena por defecto al entrar; botón para silenciar).
import { startAmbient } from './interactions/ambient.js';

// ============================================================================
// CONSTANTES DE CONFIGURACIÓN
// ============================================================================
// Ruta a la panorámica. Puede ser imagen (.png/.jpg/.hdr) o vídeo (.mp4/.webm).
const ENVIRONMENT_PATH = './assets/panoramica-2.png';
// Tamaño del pixel del shader pixelado.
const PIXEL_SIZE = 6;

// ============================================================================
// ESCENA, CÁMARA Y RENDERER
// ============================================================================
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  60, // fov: campo de visión vertical en grados (60 = visión humana aprox).
  window.innerWidth / window.innerHeight, // aspect: relación ancho/alto de la ventana.
  0.1, // near/far: planos de recorte; nada más cerca de 0.1 ni más lejos de 100
  100
);
// Posición inicial de la cámara
camera.position.set(0, 1, 2);


// antialias suaviza los bordes dentados.
const renderer = new THREE.WebGLRenderer({ antialias: true });
// El canvas ocupa toda la ventana.
renderer.setSize(window.innerWidth, window.innerHeight);
// Tonemapping: convierte colores HDR (con valores >1) a SDR (0-1).
// ACESFilmic es un estándar de cine que da contrastes agradables.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
// Inserta el canvas generado dentro del body del index.
document.body.appendChild(renderer.domElement);

// ============================================================================
// CONTROLES DE CÁMARA: MIRAR ALREDEDOR CON EL RATÓN (DRAG)
// ============================================================================
// Orden de rotación 'YXZ': giro horizontal (Y = yaw),giro vertical (X = pitch)
// Evita el bloqueo de cardan (cuando dos de los tres ejes están en paralelo) haciendo que la escena no se moveria libremente.
camera.rotation.order = 'YXZ';
// Sensibilidad del ratón (radianes por píxel arrastrado).
const LOOK_SPEED = 0.001;
// Límite vertical: casi 90° arriba/abajo, sin llegar al cenit para que no gire.
const PITCH_LIMIT = Math.PI / 2 - 0.01;
// Estado incial.
let dragging = false;
let lastX = 0;
let lastY = 0;

// Al pulsar el botón del ratón, empieza el arrastre y guarda la posición.
renderer.domElement.addEventListener('mousedown', (e) => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
});
// Al soltar el botón del ratón deja de arrastrar.
window.addEventListener('mouseup', () => {
  dragging = false;
  // Volver al cursor que corresponda (puede no haber mousemove tras soltar).
  if (cursorEl) setCursorImage(cursorBase);
});
// Al mover el ratón mientras se arrastra, gira la cámara proporcionalmente.
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  // dx/dy = cuánto se ha movido el ratón desde el último frame.
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  // Yaw (giro horizontal): sumamos para sensación de "arrastre": al mover el
  // ratón a la derecha la escena se va a la derecha (la cámara mira a la izq).
  camera.rotation.y += dx * LOOK_SPEED;
  // Pitch (giro vertical): igual, sumamos para arrastrar. Clamp para no
  // voltear la cámara más allá del cenit/nadir.
  camera.rotation.x = THREE.MathUtils.clamp(
    camera.rotation.x + dy * LOOK_SPEED,
    -PITCH_LIMIT,
    PITCH_LIMIT
  );
});

// ============================================================================
// CURSOR PERSONALIZADO (IMÁGENES DE ASSETS)
// ============================================================================
// Sustituye el cursor por una imagen que sigue al ratón.
// 3 estados: normal, sobre punto interactivo, y "rock" (cuando está inactivo varios segundos, como un guiño).
const cursorEl = document.getElementById('cursor');
const CURSOR_SRC = {
  regular: './assets/mouse-regular.png',
  pointer: './assets/mouse-pointer.png',
  rock: './assets/mouse-rock.png',
  drag: './assets/mouse-drag.png', // mientras se arrastra para mirar alrededor.
};

let cursorBase = 'regular';// cursor que debería mostrarse según el contexto (regular o pointer).
let idleTimer = null;// Tiempo actual con el cursor parado
const IDLE_MS = 2500;// Tiempo parado para mostrar el cursor "rock"

// Cambia la imagen del cursor falso.
function setCursorImage(name) {
  cursorEl.src = CURSOR_SRC[name];
}

// Mostrar el cursor falso y moverlo a la posición del ratón.
function onCursorActivity(e) {
  cursorEl.style.display = 'block';
  cursorEl.style.left = `${e.clientX}px`;
  cursorEl.style.top = `${e.clientY}px`;
  // Si se está arrastrando para mirar alrededor, prevalece el cursor "drag".
  setCursorImage(dragging ? 'drag' : cursorBase);
  clearTimeout(idleTimer);
  // si no hay actividad durante IDLE_MS se muestra mostrar "rock" (no al arrastrar).
  idleTimer = setTimeout(() => {
    if (!dragging && cursorBase === 'regular') setCursorImage('rock');
  }, IDLE_MS);
}
// Eventos que resetean la cuenta (mover y clicar)
window.addEventListener('mousemove', onCursorActivity);
window.addEventListener('mousedown', onCursorActivity);
// Si el ratón sale de la página, se oculta el cursor falso.
document.addEventListener('mouseleave', () => {
  cursorEl.style.display = 'none';
  clearTimeout(idleTimer);
});

// ============================================================================
// TECLADO: ESTADO DE LAS TECLAS DE MOVIMIENTO
// ============================================================================
// Se guarda qué teclas están pulsadas AHORA mismo (se crea bucle para hcer movimiento más suave)
// No se escriben a mano: se leen de los data-key de los botones del HTML (#move-controls),
// así el HTML es la única fuente de verdad y no hay que mantener la lista en dos sitios.
const keys = {};
for (const btn of document.querySelectorAll('#move-controls .move-btn')) {
  keys[btn.dataset.key] = false; // p. ej. data-key="w" -> keys.w = false
}
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase(); // definimos la tecla pulsada (para que se active tanto en mayus como en minus)
  if (k in keys) keys[k] = true; // si la tecla que pulso está dentro de keys cambiar su estado a true
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = false;
});

// ============================================================================
// ZOOM CON RUEDA DEL RATÓN (modifica el FOV)
// ============================================================================
const MIN_FOV = 50;  // máximo zoom in
const MAX_FOV = 80;  // máximo zoom out
renderer.domElement.addEventListener('wheel', (event) => {
  // Para que la página haga scroll mientras se hace zoom en el canvas.
  event.preventDefault();
  // deltaY positivo para que rueda hacia abajo = alejar (más FOV).
  camera.fov = THREE.MathUtils.clamp(
    camera.fov + event.deltaY * 0.05,
    MIN_FOV,
    MAX_FOV
  );
  // Cuando se cambia el el fov hay que recalcular la proyección.
  camera.updateProjectionMatrix();
}, { passive: false }); // passive:false permite usar preventDefault().

// ============================================================================
// ESFERA DE LA SALA (skybox esférico)
// ============================================================================
// Se usa una esfera grande con una panorámica mapeada por DENTRO.
// side: BackSide hace que se vean las caras interiores en vez de las exteriores.
const ROOM_RADIUS = 25;
const roomGeometry = new THREE.SphereGeometry(ROOM_RADIUS, 64, 64); // 64 segmentos = esfera suave.
const roomMaterial = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
const roomMesh = new THREE.Mesh(roomGeometry, roomMaterial);
scene.add(roomMesh);

// Aplica los ajustes comunes a la textura del entorno y la pone en la esfera.
// `isHDR` indica si viene en espacio lineal (HDR) o sRGB (PNG/JPG/vídeo).
function applyEnvironmentTexture(texture, isHDR) {
  // Para PNG/JPG/vídeo hay que indicar el espacio de color sRGB para que se
  // vea con los colores correctos. HDR ya viene en espacio lineal.
  if (!isHDR) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  // Se gira horizontalmente la textura (repeat.x = -1)
  // offset de 1 para que quede bien orientada
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.x = -1;
  texture.offset.x = 1;
  roomMaterial.map = texture; // poner textura
  roomMaterial.needsUpdate = true; // avisar de que hay que recompilar el shader
}

// Carga la panorámica. Detecta si es vídeo (.mp4/.webm), HDR (.hdr/.exr) o
// imagen normal y crea la textura adecuada.
function loadEnvironment(path) {
  const isVideo = /\.(mp4|webm|ogg)$/i.test(path);

  // --- VÍDEO: se crea un <video> en bucle y se envuelve en VideoTexture, que
  // se refresca solo en cada frame. muted + playsInline permiten autoplay. ---
  if (isVideo) {
    const video = document.createElement('video');
    video.src = path;
    video.loop = true;       // se repite sin fin.
    video.muted = true;      // necesario para que el navegador permita autoplay.
    video.playsInline = true; // evita pantalla completa en móvil.
    video.autoplay = true;
    video.crossOrigin = 'anonymous';
    // Intenta arrancar; si el navegador lo bloquea, se reintenta al primer clic.
    const tryPlay = () => video.play().catch(() => {});
    tryPlay();
    window.addEventListener('pointerdown', tryPlay, { once: true });

    const texture = new THREE.VideoTexture(video);
    applyEnvironmentTexture(texture, false);
    return;
  }

  // --- IMAGEN: RGBELoader para HDR/EXR; TextureLoader para PNG/JPG. ---
  const isHDR = /\.(hdr|exr)$/i.test(path);
  const loader = isHDR ? new RGBELoader() : new THREE.TextureLoader();

  loader.load(path, (texture) => {
    applyEnvironmentTexture(texture, isHDR);

    // // IBL Image-Based Lighting: Simular como se refleja e ilumina el entorno (para objetos metálicos en la escena)
    // const envTexture = texture.clone(); // se clona para que los cambios no afecten a la principal
    // envTexture.mapping = THREE.EquirectangularReflectionMapping; //Indica que es una textura equirectangular.
    // envTexture.repeat.set(1, 1); // Resetea el flip horizontal del original ya que al hacer los reflejos en equirectangular la imagen se orienta correctamente.
    // envTexture.offset.set(0, 0);
    // envTexture.needsUpdate = true; //avisar de que se ha cambiado algo y hay que recompilar el shader
    // scene.environment = envTexture;
  });
}

loadEnvironment(ENVIRONMENT_PATH);

// ============================================================================
// PUNTOS DE INTERACCIÓN (HOTSPOTS)
// ============================================================================
// Cada punto se coloca con un ángulo (yaw) y elevación (pitch) en grados.
// yaw = 0 mira al frente, valores negativos a la izquierda.
// pitch = 0 a la altura de los ojos, negativo hacia abajo (mesas).
// `elements` define las ZONAS INTERACTIVAS de cada menú 2D. Cada zona es un
// rectángulo en COORDENADAS NORMALIZADAS de la imagen (0..1), con origen en la
// esquina superior izquierda:
//   x, y = esquina superior izquierda;  w, h = ancho y alto.
// Estas coordenadas son estimaciones a ojo: ajústalas mirando la imagen.
// `name` se usa para el tooltip y para identificar el elemento al clicar.
// Cada elemento puede llevar `description`: el texto que se escribe (efecto
// máquina de escribir) en el panel inferior al pasar el ratón por la zona.
const HOTSPOTS = [
  {
    name: 'Ordenadores', image: './assets/menu-pc.png', yawDeg: -15, pitchDeg: -12,
    elements: [
      { name: 'Campana', x: 0.40, y: 0.65, w: 0.05, h: 0.15,
        description: 'Una campana de recepción. Llámala y quizá alguien acuda... o quizá solo despiertes al silencio.' },
      { name: 'Monitor 1', x: 0.17, y: 0.45, w: 0.18, h: 0.32,
        description: 'Un viejo ordenador de tubo. En su pantalla aparece un registro de visitas.' },
      { name: 'Monitor 2', x: 0.49, y: 0.4, w: 0.22, h: 0.35,
        description: 'Monitor encendido. El sistema dió error y sigue esperando a que lo reinicien.' },
    ],
  },
  {
    name: 'Espejo', image: './assets/menu-mirror.png', yawDeg: 75, pitchDeg: 0, descSide: 'right',
    elements: [
      { name: 'Espejo', x: 0.2, y: 0.25, w: 0.23, h: 0.45,
        description: 'Un espejo antiguo. El reflejo tiene alma propia y reacciona a tu presencia.' },
      { name: 'Acuario', x: 0.45, y: 0.58, w: 0.1, h: 0.18,
        description: 'Un pequeño acuario. Los peces dan vueltas como si buscaran la salida.' },
    ],
  },
  {
    name: 'Radio', image: './assets/menu-table.png', yawDeg: 160, pitchDeg: -30, descSide: 'left',
    elements: [
      { name: 'Radio', x: 0.54, y: 0.26, w: 0.27, h: 0.44,
        description: 'Una radio de los noventa. Entre estática se cuela una canción que creías olvidada.' },
      { name: 'Cómic', x: 0.31, y: 0.52, w: 0.32, h: 0.31,
        description: 'Un cómic abierto por la mitad. Alguien marcó esta página con el dedo y no volvió.' },
    ],
  },
  {
    name: 'Habitación secreta', image: './assets/menu-arcade.png', yawDeg: -180, pitchDeg: 15, descSide: 'left',
    elements: [
      { name: 'Arcade', x: 0.57, y: 0.4, w: 0.19, h: 0.5,
        description: 'Una máquina arcade escondida en una habitación de laBiblioteca. La pantalla de space invaders parece estar aun encendida.' }
    ],
  },
];

// Distancia de los hotspots al orde de la esfera.
const HOTSPOT_DISTANCE = ROOM_RADIUS - 4;

// Contenedor en el DOM donde se irán insertando los botones de hotspot.
const hotspotsEl = document.getElementById('hotspots');

// ----------------------------------------------------------------------------
// SONIDO DE CLIC (en cualquier clic: hotspots, elementos de menús, botones...)
// Se sintetiza un "blip" 8-bit con la Web Audio API (sin asset): dos tonos de
// onda cuadrada que suben → suena retro, acorde a la estética pixel-art.
// ----------------------------------------------------------------------------
let audioCtx = null;
function playClickSound(e) {
  // No suena al arrastrar para mirar: esos clics caen sobre el <canvas>, que
  // no es un elemento interactivo. Solo suena en hotspots, menús, botones...
  if (e && e.target && e.target.tagName === 'CANVAS') return;
  try {
    // El AudioContext se crea al primer clic (el navegador exige interacción).
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';                       // onda cuadrada = timbre 8-bit.
    osc.frequency.setValueAtTime(523, t);       // primer tono (do).
    osc.frequency.setValueAtTime(784, t + 0.07); // sube de tono (sol): "blip-bloop".
    // Envolvente: arranca audible y se apaga rápido para que sea un "tic" corto.
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.18);
  } catch (e) { /* si el navegador bloquea el audio, se ignora. */ }
}

// Listener global en fase de captura: suena en CUALQUIER clic, aunque algún
// handler detenga la propagación (la captura va antes que la fase de burbujeo).
document.addEventListener('click', playClickSound, true);

// SONIDO DE HOVER (al pasar el cursor sobre un elemento de menú). Distinto del
// clic: un único tono agudo y muy corto, más flojo, tipo "tic" de selección.
function playHoverSound() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';                 // onda cuadrada = timbre 8-bit.
    osc.frequency.setValueAtTime(988, t); // tono agudo (si) → "tic" de hover.
    // Envolvente corta y suave para que no moleste al recorrer varios elementos.
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
  } catch (e) { /* si el navegador bloquea el audio, se ignora. */ }
}

// SONIDO DE TECLEO (al escribir el texto letra a letra: onboarding y
// descripciones de objetos). Un "clic" seco, gravísimo y muy corto, tipo
// pulsación de tecla de máquina de escribir. Muy flojo para que no canse.
function playTypeSound() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, t); // tono grave = "toc" de tecla.
    gain.gain.setValueAtTime(0.05, t);     // volumen bajo (se repite mucho).
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03); // muy corto.
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.03);
  } catch (e) { /* si el navegador bloquea el audio, se ignora. */ }
}

// Listener global delegado: suena el "tic" al entrar el cursor en CUALQUIER
// <button> (hotspots, elementos de menú, movimiento, música, arcade...).
// Usamos mouseover (que sí burbujea) y comparamos el botón actual con el
// anterior para reproducir el sonido una sola vez por botón, no en cada píxel.
let lastHoverBtn = null;
document.addEventListener('mouseover', (e) => {
  const btn = e.target.closest && e.target.closest('button');
  if (btn && btn !== lastHoverBtn) {
    lastHoverBtn = btn;
    playHoverSound();
  } else if (!btn) {
    lastHoverBtn = null;
  }
});

// Por cada hotspot se crea un <button> en el HTML y se guarda su posición 3D.
// La estética y la animación de hover viven en styles.css.
for (const spot of HOTSPOTS) {
  // Grados a radianes (Three.js usa radianes).
  const yaw = THREE.MathUtils.degToRad(spot.yawDeg); // giro horizontal
  const pitch = THREE.MathUtils.degToRad(spot.pitchDeg); // giro vertical
  // Coordenadas esféricas (2 puntos) a cartesianas (3 puntos)
  spot.worldPos = new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch), // cuanto a los lados
    Math.sin(pitch), // cuanto arriba y abajo
    -Math.cos(yaw) * Math.cos(pitch)// cuanto delante y detrás
  ).multiplyScalar(HOTSPOT_DISTANCE); // distancia a la que se tiene que multiplicar las coordenadas de los hotspots

  const el = document.createElement('button');
  el.className = 'hotspot';
  el.setAttribute('aria-label', spot.name);
  
  // Hover: cambiar cursor a pointer y mostrar el tooltip.
  el.addEventListener('mouseenter', () => {
    cursorBase = 'pointer';
    setCursorImage('pointer');
    tip.textContent = `Ver ${spot.name}`;
    tip.classList.add('visible');
  });
  el.addEventListener('mousemove', (e) => {
    // El tip está junto al ratón mientras está sobre el hotspot.
    tip.style.left = `${e.clientX}px`;
    tip.style.top = `${e.clientY}px`;
  });
  el.addEventListener('mouseleave', () => {
    cursorBase = 'regular';
    tip.classList.remove('visible');
  });
  // Clic: abrir el menú correspondiente (con fundido). El sonido lo dispara el
  // listener global de clic, así que aquí no hace falta llamarlo.
  el.addEventListener('click', () => {
    if (transitioning || menuOpen) return;
    tip.classList.remove('visible');
    withFade(() => openMenu(spot));
  });
  hotspotsEl.appendChild(el);
  spot.el = el;
}

// ============================================================================
// OVERLAY DEL MENÚ
// ============================================================================
// Referencias a los elementos del HTML que vamos a manipular.
const menuOverlay = document.getElementById('menu-overlay');
const menuElementsEl = document.getElementById('menu-elements');
const menuSpotlightEl = document.getElementById('menu-spotlight');
const menuDescEl = document.getElementById('menu-desc');
const menuClose = document.getElementById('menu-close');
const tip = document.getElementById('hotspot-tip');
const fadeEl = document.getElementById('fade');
const moveControls = document.getElementById('move-controls');

// Botones W/A/S/D en pantalla: al pulsarlos, marcan keys[key]=true como si
// se hubiera pulsado la tecla, así reutilizamos toda la lógica de teclado.
const moveButtons = {};
for (const btn of moveControls.querySelectorAll('.move-btn')) {
  const key = btn.dataset.key; // dataset.key viene del atributo data-key="..."
  moveButtons[key] = btn; // todas las key se trataran como un boton dentro de movebuttons (animación)

  const press = (e) => {
    e.preventDefault(); // cancela el comportamiento por defecto del navegador
    keys[key] = true; // cuando cada usa se pulsa, cambia el estado a verdadero y se activa la clase
    btn.classList.add('pressed');
  };
  const release = () => {
    keys[key] = false;
    btn.classList.remove('pressed');
  };
  // pointerdown/up cubre ratón Y dedo en móvil con un solo evento.
  btn.addEventListener('pointerdown', press);
  btn.addEventListener('pointerup', release);
  // pointerleave/cancel evitan que se quede "atascado" pulsado.
  btn.addEventListener('pointerleave', release);
  btn.addEventListener('pointercancel', release);
}

// Sincronización a la inversa: al pulsar la tecla física, también se "ilumina" el botón.
window.addEventListener('keydown', (e) => {
  const btn = moveButtons[e.key.toLowerCase()];
  if (btn) btn.classList.add('pressed');
});
window.addEventListener('keyup', (e) => {
  const btn = moveButtons[e.key.toLowerCase()];
  if (btn) btn.classList.remove('pressed');
});

// ----------------------------------------------------------------------------
// Transición con fundido a negro al abrir/cerrar menús.
// ----------------------------------------------------------------------------
let transitioning = false;
function withFade(action) {
  if (transitioning) return; // evitar encadenar transiciones.
  transitioning = true;
  fadeEl.classList.add('on'); // 260ms a negro (definido en el CSS).
  setTimeout(() => {
    action();
    fadeEl.classList.remove('on');
    setTimeout(() => { transitioning = false; }, 260); // 260ms volviendo.
  }, 260);
}

// ============================================================================
// LÓGICA DE APERTURA / CIERRE DE MENÚS
// ============================================================================
let menuOpen = false;
const textureLoader = new THREE.TextureLoader();

function openMenu(spot) {
  // Se carga la imagen del menú y la asigna al plano de la escena del menú.
  // El callback ajusta el plano al aspecto cuando termina la descarga.
  const tex = textureLoader.load(spot.image, () => fitMenuPlane());
  tex.colorSpace = THREE.SRGBColorSpace;
  menuMaterial.map = tex;
  menuMaterial.needsUpdate = true;
  buildMenuElements(spot); // crea las zonas interactivas de este menú.
  fitMenuPlane();
  // Posición de la descripción según el menú: 'left', 'right' o centrada
  // (por defecto si el hotspot no define descSide).
  menuDescEl.classList.remove('desc-left', 'desc-right');
  if (spot.descSide === 'left') menuDescEl.classList.add('desc-left');
  else if (spot.descSide === 'right') menuDescEl.classList.add('desc-right');
  menuOpen = true;
  menuOverlay.classList.add('visible'); // muestra el botón cerrar (×).
  moveControls.classList.add('hidden'); // oculta los W/A/S/D.
}
function closeMenu() {
  menuOpen = false;
  menuOverlay.classList.remove('visible');
  moveControls.classList.remove('hidden');
  clearMenuElements(); // quita las zonas y oculta el tooltip.
  tip.classList.remove('visible');
  menuDescEl.classList.remove('desc-left', 'desc-right'); // vuelve a centrada.
}

// ============================================================================
// ZONAS INTERACTIVAS DENTRO DE UN MENÚ 2D
// ============================================================================
// Las zonas se definen en coordenadas normalizadas de la imagen (ver HOTSPOTS).
// Aquí las convertimos en <button> sobre la imagen, las colocamos en píxeles y
// las resaltamos con un cuadrado amarillo al hacer hover (estilo en styles.css).

// Lista de zonas del menú abierto: { def, el } (def = datos, el = <button>).
let currentMenuElements = [];

// Mapa nombre de zona -> función que ejecuta su interacción. El nombre debe
// coincidir EXACTAMENTE con el `name` definido en HOTSPOTS.elements.
const MENU_ELEMENT_ACTIONS = {
  'Campana': ringBell,                 // suena una campanilla (sin overlay).
  'Monitor 1': openRegister,           // formulario + lista de registro.
  'Monitor 2': openOffline,            // pantalla "fuera de servicio".
  'Espejo': openMirror,                // pixel-cam con p5.js.
  'Acuario': openAquarium,             // vídeo/pecera 8-bit.
  'Radio': openRadio,                  // música que sigue al cerrar el menú.
  'Cómic': openComic,                  // pasar páginas con animación.
  'Arcade': openArcade,                // minijuego de marcianitos.
};

// Acción al clicar una zona: busca su interacción en el mapa y la ejecuta.
function onMenuElementClick(spot, def) {
  const action = MENU_ELEMENT_ACTIONS[def.name];
  if (action) {
    console.log(`▶ Ejecutando interacción de "${def.name}"`); // (log temporal de depuración)
    action(def, spot);
  } else {
    console.log(`Sin interacción para "${def.name}" (menú ${spot.name})`);
  }
}

// Borra las zonas del menú anterior.
function clearMenuElements() {
  menuElementsEl.innerHTML = '';
  currentMenuElements = [];
  hideElementDescription(); // por si quedaba una descripción visible.
  hideSpotlight(); // por si quedaba el foco azul activo.
}

// Escribe `text` dentro de `el` letra a letra, con un cursor parpadeante al
// final (mismo efecto que el onboarding). Devuelve una función para CANCELAR
// la escritura en curso (útil al cambiar de objeto rápidamente).
function typeInto(el, text, speed = 28) {
  let i = 0;
  let timer = null;
  const caret = document.createElement('span');
  caret.className = 'caret';
  caret.textContent = '▌';
  function step() {
    el.textContent = text.slice(0, i); // texto escrito hasta ahora.
    el.appendChild(caret);             // cursor parpadeante al final.
    if (i < text.length) {
      if (text[i] !== ' ') playTypeSound(); // "toc" de tecla (no en espacios).
      i++;
      timer = setTimeout(step, speed);
    }
  }
  step();
  return () => clearTimeout(timer);
}

// ----------------------------------------------------------------------------
// FOCO: tiñe de azul todo menos el producto sobre el que está el ratón.
// Coloca el div #menu-spotlight sobre el mismo rectángulo que la zona y lo
// hace visible; su box-shadow (CSS) oscurece el resto de la pantalla.
// ----------------------------------------------------------------------------
function showSpotlight(el) {
  // Copia la posición/tamaño del producto (mismas coordenadas: ambos están
  // posicionados respecto al overlay a pantalla completa).
  menuSpotlightEl.style.left = el.style.left;
  menuSpotlightEl.style.top = el.style.top;
  menuSpotlightEl.style.width = el.style.width;
  menuSpotlightEl.style.height = el.style.height;
  menuSpotlightEl.classList.add('visible');
}
function hideSpotlight() {
  menuSpotlightEl.classList.remove('visible');
}

// Guarda la función para cancelar la descripción que se está escribiendo.
let cancelDescType = null;

// Muestra y escribe la descripción del objeto sobre el que está el ratón.
function showElementDescription(def) {
  if (cancelDescType) cancelDescType(); // corta la descripción anterior.
  if (!def.description) { hideElementDescription(); return; }
  menuDescEl.classList.add('visible');
  cancelDescType = typeInto(menuDescEl, def.description);
}

// Oculta el panel de descripción y detiene cualquier escritura en curso.
function hideElementDescription() {
  if (cancelDescType) { cancelDescType(); cancelDescType = null; }
  menuDescEl.classList.remove('visible');
  menuDescEl.textContent = '';
}

// Crea un <button> por cada zona del menú y le engancha hover/click.
function buildMenuElements(spot) {
  clearMenuElements();
  for (const def of spot.elements || []) {
    const el = document.createElement('button');
    el.className = 'menu-element';
    el.setAttribute('aria-label', def.name);

    // Hover: cursor pointer + cuadrado amarillo (CSS) + tooltip con el nombre
    // + descripción escrita con efecto máquina de escribir en el panel inferior.
    el.addEventListener('mouseenter', () => {
      cursorBase = 'pointer';
      setCursorImage('pointer');
      tip.textContent = def.name;
      tip.classList.add('visible');
      showElementDescription(def);
      showSpotlight(el); // destaca el producto tiñendo de azul el resto.
    });
    el.addEventListener('mousemove', (e) => {
      tip.style.left = `${e.clientX}px`;
      tip.style.top = `${e.clientY}px`;
    });
    el.addEventListener('mouseleave', () => {
      cursorBase = 'regular';
      tip.classList.remove('visible');
      hideElementDescription();
      hideSpotlight(); // quita el tinte azul al salir del producto.
    });
    // Clic: ejecuta la acción asociada a la zona.
    el.addEventListener('click', () => onMenuElementClick(spot, def));

    menuElementsEl.appendChild(el);
    currentMenuElements.push({ def, el });
  }
}

// Coloca cada zona en píxeles replicando la lógica "cover" de fitMenuPlane:
// la imagen llena la pantalla y se recorta el sobrante por igual a ambos lados.
function layoutMenuElements() {
  const tex = menuMaterial.map;
  if (!tex || !tex.image || currentMenuElements.length === 0) return;

  const W = window.innerWidth;
  const H = window.innerHeight;
  const screenAspect = W / H;
  const imgAspect = tex.image.width / tex.image.height;

  // sx/sy = cuánto se "agranda" la imagen respecto a la pantalla en cada eje
  // (igual que menuPlane.scale en fitMenuPlane). El sobrante se centra.
  let sx = 1, sy = 1;
  if (imgAspect > screenAspect) sx = imgAspect / screenAspect;
  else sy = screenAspect / imgAspect;

  // Borde izquierdo/superior de la imagen en píxeles de pantalla.
  const imgLeft = W * (1 - sx) / 2;
  const imgTop = H * (1 - sy) / 2;
  const imgW = W * sx;
  const imgH = H * sy;

  for (const { def, el } of currentMenuElements) {
    el.style.left = `${imgLeft + def.x * imgW}px`;
    el.style.top = `${imgTop + def.y * imgH}px`;
    el.style.width = `${def.w * imgW}px`;
    el.style.height = `${def.h * imgH}px`;
  }
}
// 2 formas de cerrar el menú:
menuClose.addEventListener('click', () => withFade(closeMenu)); // botón ×
window.addEventListener('keydown', (e) => { // ESC
  if (e.key === 'Escape' && menuOpen) withFade(closeMenu);
});

// ============================================================================
// SHADER DE PIXELADO + PALETA DE 4 COLORES
// ============================================================================
// Shader GLSL personalizado:
//   1) Reduce la resolución muestreando bloques de PIXEL_SIZE x PIXEL_SIZE (efecto pixel-art).
//   2) Reasigna los colores a una paleta de 4 tonos según la luz.

const PixelPaletteShader = {
  // Uniforms = variables que pasamos desde JS al shader cada frame.
  uniforms: {
    tDiffuse: { value: null }, // la imagen ya renderizada por el pase anterior.
    resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    pixelSize: { value: PIXEL_SIZE },
  },
  // Vertex shader pasa las coordenadas UV al fragment shader.
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment shader: se ejecuta para CADA píxel de la imagen final.
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float pixelSize;
    varying vec2 vUv;

    void main() {
      // 1) PIXELADO: "engancha" cada fragmento al centro de un bloque NxN.
      vec2 dxy = pixelSize / resolution;
      vec2 coord = dxy * floor(vUv / dxy) + dxy * 0.5;
      vec3 color = texture2D(tDiffuse, coord).rgb;

      // 2) PALETA: 4 colores predefinidos (negro, azul, verde, amarillo).
      vec3 c0 = vec3(0.0, 0.0, 0.0);
      vec3 c1 = vec3(29.0, 70.0, 193.0) / 255.0;
      vec3 c2 = vec3(130.0, 179.0, 128.0) / 255.0;
      vec3 c3 = vec3(213.0, 217.0, 162.0) / 255.0;

      // Luminancia perceptual (cuánto "brillo" tiene el color original).
      float lum = dot(color, vec3(0.299, 0.587, 0.114));
      // Umbrales para repartir el rango de luminancia entre los 4 colores.
      float t0 = 0.12;
      float t1 = 0.35;
      float t2 = 0.65;

      // Según el brillo, mezclamos entre los pares de colores adyacentes para
      // obtener un gradiente cuantizado pero sin escalones bruscos.
      vec3 palette;
      if (lum < t0) {
        palette = mix(c0, c1, lum / t0);
      } else if (lum < t1) {
        palette = mix(c1, c2, (lum - t0) / (t1 - t0));
      } else if (lum < t2) {
        palette = mix(c2, c3, (lum - t1) / (t2 - t1));
      } else {
        palette = c3;
      }

      // Mezcla del color original con la paleta: 0.4 = 40% paleta, 60% original.
      // Sube este valor para una estética más "retro pura".
      float paletteStrength = 0.45;
      vec3 result = mix(color, palette, paletteStrength);

      gl_FragColor = vec4(result, 1.0);
    }
  `,
};

// EffectComposer que encadena pases en orden.
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera)); // renderiza la escena.
const pixelPass = new ShaderPass(PixelPaletteShader);
composer.addPass(pixelPass); // aplica el shader.

// ============================================================================
// ESCENA APARTE PARA EL MENÚ (con el mismo shader pixel/paleta)
// ============================================================================
// Pintamos el menu en una escena Three.js con cámara ortográfica para poder pasarla por el shader.
const menuScene = new THREE.Scene();
// OrthographicCamera(left, right, top, bottom, near, far) para proyección plana.
// Con (-1,1,1,-1) cubre exactamente un cuadrado de 2x2 (cordenadas de -1 a +1).
const menuCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
menuCamera.position.z = 1;
const menuMaterial = new THREE.MeshBasicMaterial({ transparent: false });
// Plano 2x2 que ocupa toda la cámara ortográfica.
const menuPlane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), menuMaterial);
menuScene.add(menuPlane);

// Pipeline aparte para el menú con el mismo shader que el anterior.
const menuComposer = new EffectComposer(renderer);
menuComposer.addPass(new RenderPass(menuScene, menuCamera));
const menuPixelPass = new ShaderPass(PixelPaletteShader);
menuComposer.addPass(menuPixelPass);

// ----------------------------------------------------------------------------
// Escala el plano para que la imagen cubra toda la pantalla
// ----------------------------------------------------------------------------
function fitMenuPlane() {
  const tex = menuMaterial.map;
  if (!tex || !tex.image) return;
  const screenAspect = window.innerWidth / window.innerHeight;
  const imgAspect = tex.image.width / tex.image.height;
  if (imgAspect > screenAspect) {
    // Si la imagen es más ancha que la pantalla se estira horizontalmente.
    menuPlane.scale.set(imgAspect / screenAspect, 1, 1);
  } else {
    // Si la imagen es más alta que la pantalla se estira verticalmente.
    menuPlane.scale.set(1, screenAspect / imgAspect, 1);
  }
  // Reposiciona las zonas interactivas para que sigan a la imagen.
  layoutMenuElements();
}

// ============================================================================
// REDIMENSIONADO DE LA VENTANA
// ============================================================================
// Cuando cambia el tamaño de la ventana, hay que actualizar todo lo que
// depende de las dimensiones.
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  menuComposer.setSize(window.innerWidth, window.innerHeight);
  // El shader también necesita la nueva resolución para pixelar bien.
  pixelPass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
  menuPixelPass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
  fitMenuPlane();
  updateScreenWarnings(); // revisa si la ventana se ha quedado pequeña.
});

// ============================================================================
// AVISOS: PANTALLA PEQUEÑA (escritorio) Y DISPOSITIVO MÓVIL
// ============================================================================
// La experiencia está pensada para una ventana amplia con ratón y teclado.
//   - En MÓVIL/tablet mostramos un aviso fijo pidiendo entrar desde ordenador.
//   - En ESCRITORIO, si la ventana se hace muy pequeña, mostramos un aviso
//     pidiendo agrandarla; desaparece en cuanto se vuelve a ampliar.
const smallScreenWarningEl = document.getElementById('small-screen-warning');
const mobileWarningEl = document.getElementById('mobile-warning');

// Umbral mínimo (en píxeles) por debajo del cual se considera "pantalla
// pequeña" en escritorio. Si el ancho O el alto bajan de aquí, avisamos.
const MIN_W = 1200;
const MIN_H = 600;

// Detección de móvil/tablet: por user agent y, como respaldo, por puntero
// "grueso" (táctil) sin puntero fino (ratón). Se calcula una sola vez.
const IS_MOBILE = (() => {
  const ua = navigator.userAgent || navigator.vendor || '';
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
  // iPadOS reciente se identifica como Mac: lo detectamos por el táctil.
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const noFinePointer = window.matchMedia && !window.matchMedia('(pointer: fine)').matches;
  return Boolean(coarse && noFinePointer);
})();

// Muestra/oculta el aviso de pantalla pequeña según el tamaño actual.
// El aviso de móvil, una vez mostrado, permanece (no se puede "agrandar").
function updateScreenWarnings() {
  if (IS_MOBILE) return; // en móvil manda el aviso de móvil (ver abajo).
  const tooSmall = window.innerWidth < MIN_W || window.innerHeight < MIN_H;
  smallScreenWarningEl.classList.toggle('visible', tooSmall);
}

// En móvil, mostramos el aviso correspondiente de forma permanente.
if (IS_MOBILE) {
  mobileWarningEl.classList.add('visible');
} else {
  updateScreenWarnings(); // primera comprobación al cargar (por si abre pequeño).
}

// ============================================================================
// MOVIMIENTO DE LA CÁMARA Y BUCLE DE RENDER
// ============================================================================
const MOVE_SPEED = 0.08; // velocidad de WASD.
// Radio máximo del cilindro de movimiento (en el plano horizontal).
const MAX_RADIUS = 2.5;

// setAnimationLoop se llama una vez por frame (60 veces por segundo).
renderer.setAnimationLoop(() => {
  // Si hay un menú abierto, solo se dibuja la escena del menú y se sale.
  if (menuOpen) {
    hotspotsEl.style.display = 'none'; // ocultar los hotspots mientras el menú esté abierto.
    menuComposer.render();
    return;
  }
  // Sin menú: asegurarse de que los hotspots estén visibles.
  hotspotsEl.style.display = '';

  // Vector "adelante" (sin Y para que no suba hacia arriba). normalize lo deja de longitud 1.
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  
  // Vector "derecha" perpendicular a "adelante" en el plano horizontal.
  const right = new THREE.Vector3(-forward.z, 0, forward.x);

  if (keys.w) camera.position.addScaledVector(forward, MOVE_SPEED);
  if (keys.s) camera.position.addScaledVector(forward, -MOVE_SPEED);
  if (keys.a) camera.position.addScaledVector(right, -MOVE_SPEED);
  if (keys.d) camera.position.addScaledVector(right, MOVE_SPEED);

  // Limitar la posición a un círculo de radio MAX_RADIUS (en el plano X/Z) para no salirse
  const horiz = Math.hypot(camera.position.x, camera.position.z); // distancia de la camara al centro
  if (horiz > MAX_RADIUS) {
    const s = MAX_RADIUS / horiz; // factor por el que multipicar a horiz para que dé el límite del círculo
    camera.position.x *= s;
    camera.position.z *= s;
  }

  // Bloquear los hotspots si se está arrastrando, hay menú abierto o
  // transición a negro: durante esos estados no deben recibir hover/click.
  if (dragging || menuOpen || transitioning) {
    hotspotsEl.classList.add('locked');
  } else {
    hotspotsEl.classList.remove('locked');
  }

  // Proyectar la posición 3D de cada hotspot a píxeles de pantalla y mover
  // su <button> ahí. Si queda detrás de la cámara (z>1) lo ocultamos.
  for (const spot of HOTSPOTS) {
    const ndc = spot.worldPos.clone().project(camera);
    if (ndc.z > 1) {
      spot.el.classList.add('hidden');
      continue;
    }
    spot.el.classList.remove('hidden');
    // De NDC (-1..1) a píxeles de pantalla.
    // La Y se invierte porque en pantalla crece hacia abajo.
    const x = (ndc.x + 1) / 2 * window.innerWidth;
    const y = (1 - ndc.y) / 2 * window.innerHeight;
    spot.el.style.left = `${x}px`;
    spot.el.style.top = `${y}px`;
  }

  // Render final: dibuja la escena pasando por el shader de pixel/paleta.
  // Los hotspots viven en el DOM por encima del <canvas>,
  // se muestran nítidos sin pasar por el shader.
  composer.render();
});

// ============================================================================
// ONBOARDING / INTRO (texto a modo de máquina de escribir)
// ============================================================================
// Pantalla negra inicial que explica de qué va el sitio. El texto se escribe
// letra a letra; al terminar aparece el botón ENTRAR. Se puede acelerar
// (clic o pulsando Enter) y cerrar (ENTRAR o pulsando Enter).

// El nombre aparece primero en grande y centrado; luego sube y se escribe
// el resto del texto debajo. Los saltos de línea (Enter) se respetan tal cual
// gracias a white-space: pre-wrap. del CSS
const ONBOARDING_NAME = 'LaBiblioteca.com';

const ONBOARDING_TEXT =
`Has entrado en una sala que no debería existir:
un trozo de los años 90 que alguien dejó encendido.


Muévete con  W A S D  y arrastra con el ratón
para mirar a tu alrededor.


Acércate a los puntos que brillan: cada objeto
esconde algo que explorar.


Toma asiento. La biblioteca te estaba esperando.`;

const TYPE_MS = 35; // milisegundos entre letra y letra (más bajo = más rápido).

const onboardingEl = document.getElementById('onboarding');
const onboardingTitleEl = document.getElementById('onboarding-title');
const onboardingTextEl = document.getElementById('onboarding-text');
const onboardingStartEl = document.getElementById('onboarding-start');

// Tiempo (ms) que el titulo permanece grande y centrado antes de subir.
const NAME_HOLD_MS = 1600;

let nameIndex = 0;       // cuántas letras del titulo llevamos escritas.
let nameDone = false;    // true cuando el titulo está completo.
let nameTimer;           // temporizador del tipeo del nombre / pausa previa.
let typeIndex = 0;       // cuántos caracteres del texto llevamos escritos.
let typingDone = false;  // true cuando el texto está completo.
let bodyStarted = false; // true cuando el nombre ya subió y empezó el texto.

// Añade el cursor parpadeante "caret" al final de un elemento.
function appendCaret(el) {
  const caret = document.createElement('span');
  caret.className = 'caret';
  caret.textContent = '▌';
  el.appendChild(caret);
}

// Pinta el texto escrito hasta ahora + el cursor parpadeante al final.
function renderTyped() {
  onboardingTextEl.textContent = ONBOARDING_TEXT.slice(0, typeIndex);
  appendCaret(onboardingTextEl);
}

// Pinta el titulo escrito hasta ahora + el cursor parpadeante al final.
function renderName() {
  onboardingTitleEl.textContent = ONBOARDING_NAME.slice(0, nameIndex);
  if (!nameDone) appendCaret(onboardingTitleEl);
}

// Escribe una letra del titulo y, al terminar, espera y revela el cuerpo.
function typeNameStep() {
  if (nameIndex >= ONBOARDING_NAME.length) { finishName(); return; }
  if (ONBOARDING_NAME[nameIndex] !== ' ') playTypeSound(); // "toc" de tecla.
  nameIndex++;
  renderName();
  // Tiempo de espera antes de llamar otra vez a la función, "nameTimer"
  // se define para guardar el progreso y volcar el texto completo
  nameTimer = setTimeout(typeNameStep, TYPE_MS);
}

// Completa el titulo de golpe y programa la subida + escritura del cuerpo.
function finishName() {
  if (nameDone) return;
  nameDone = true;
  nameIndex = ONBOARDING_NAME.length;
  renderName();
  clearTimeout(nameTimer);
  nameTimer = setTimeout(revealBody, NAME_HOLD_MS);
}

// Escribe una letra y se vuelve a llamar hasta terminar.
function typeStep() {
  if (typeIndex >= ONBOARDING_TEXT.length) { finishTyping(); return; }
  if (ONBOARDING_TEXT[typeIndex] !== ' ') playTypeSound(); // "toc" de tecla.
  typeIndex++;
  renderTyped();
  setTimeout(typeStep, TYPE_MS);
}

// Muestra el texto completo de golpe y habilita el botón ENTRAR.
function finishTyping() {
  if (typingDone) return;
  typingDone = true;
  typeIndex = ONBOARDING_TEXT.length;
  renderTyped();
  onboardingStartEl.classList.add('ready');
}

// Cierra la intro con un fundido y la quita del DOM al terminar.
function closeOnboarding() {
  onboardingEl.classList.add('hidden');
  setTimeout(() => { onboardingEl.style.display = 'none'; }, 600);
  // Arranca la música ambiente: este clic/tecla es el gesto que el navegador
  // exige para permitir el audio.
  startAmbient();
}

// Sube el nombre, revela el texto y arranca la máquina de escribir.
// Sólo se ejecuta una vez.
function revealBody() {
  if (bodyStarted) return;
  bodyStarted = true;
  clearTimeout(nameTimer);
  onboardingTitleEl.classList.add('up');
  onboardingTextEl.classList.add('reveal');
  typeStep();
}

// Avanza al siguiente paso de la intro según en qué fase estemos:
// 1) nombre escribiéndose -> complétalo; 2) nombre completo -> sube y
// arranca el texto; 3) texto escribiéndose -> complétalo de golpe.
function advanceIntro() {
  if (!nameDone) finishName();
  else if (!bodyStarted) revealBody();
  else if (!typingDone) finishTyping();
}

// Clic en cualquier parte de la intro (menos el botón): avanza la intro.
onboardingEl.addEventListener('click', (e) => {
  if (e.target !== onboardingStartEl) advanceIntro();
});
// Botón ENTRAR: cierra la intro.
onboardingStartEl.addEventListener('click', closeOnboarding);
// Hover sobre el botón: mostrar el cursor personalizado "pointer".
onboardingStartEl.addEventListener('mouseenter', () => {
  cursorBase = 'pointer';
  setCursorImage('pointer');
});
onboardingStartEl.addEventListener('mouseleave', () => {
  cursorBase = 'regular';
  setCursorImage('regular');
});
// Teclado: Enter/Espacio avanza la intro o, si ya terminó, entra.
window.addEventListener('keydown', (e) => {
  if (onboardingEl.classList.contains('hidden')) return; // intro ya cerrada.
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (!typingDone) advanceIntro();
    else closeOnboarding();
  }
});

// Arranca la intro: escribe el nombre a máquina de escribir; al terminar,
// (finishName) espera NAME_HOLD_MS, lo sube y escribe el cuerpo.
typeNameStep();
