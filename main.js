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

// ============================================================================
// CONSTANTES DE CONFIGURACIÓN
// ============================================================================
// Ruta a la imagen panorámica .png.
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
  setCursorImage(cursorBase);
  clearTimeout(idleTimer);
  // si no hay actividad durante IDLE_MS se muestra mostrar "rock".
  idleTimer = setTimeout(() => {
    if (cursorBase === 'regular') setCursorImage('rock');
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
const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
};
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
const MIN_FOV = 30;  // máximo zoom in
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

// Carga la textura panorámica. Detecta automáticamente si es HDR.
function loadEnvironment(path) {
  // Si el archivo es .hdr o .exr, usar RGBELoader; si no, TextureLoader normal.
  const isHDR = /\.(hdr|exr)$/i.test(path);
  const loader = isHDR ? new RGBELoader() : new THREE.TextureLoader();

  loader.load(path, (texture) => {
    // Para PNG/JPG hay que indicar el espacio de color sRGB para que se vea
    // con los colores correctos. HDR ya viene en espacio lineal.
    if (!isHDR) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    // Se gira horizontalmente la textura (repeat.x = -1)
    // offset de 1 para que quede bien orientada
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.x = -1;
    texture.offset.x = 1;
    roomMaterial.map = texture; // poner textura
    roomMaterial.needsUpdate = true; //avisar de que se ha cambiado algo y hay que recompilar el shader

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
const HOTSPOTS = [
  {
    name: 'Ordenadores', image: './assets/menu-pc.png', yawDeg: -15, pitchDeg: -12,
    elements: [
      { name: 'Campana', x: 0.40, y: 0.65, w: 0.05, h: 0.15 },
      { name: 'Monitor 1', x: 0.17, y: 0.45, w: 0.18, h: 0.32 },
      { name: 'Monitor 2', x: 0.49, y: 0.4, w: 0.22, h: 0.35 },
    ],
  },
  {
    name: 'Espejo', image: './assets/menu-mirror.png', yawDeg: 75, pitchDeg: 0,
    elements: [
      { name: 'Espejo', x: 0.2, y: 0.25, w: 0.23, h: 0.45 },
      { name: 'Acuario', x: 0.45, y: 0.58, w: 0.1, h: 0.18 },
    ],
  },
  {
    name: 'Radio', image: './assets/menu-table.png', yawDeg: 160, pitchDeg: -30,
    elements: [
      { name: 'Radio', x: 0.54, y: 0.28, w: 0.28, h: 0.42 },
      { name: 'Cómic', x: 0.3, y: 0.52, w: 0.32, h: 0.35 },
    ],
  },
  {
    name: 'Arcade', image: './assets/menu-arcade.png', yawDeg: -180, pitchDeg: 15,
    elements: [
      { name: 'Máquina recreativa', x: 0.57, y: 0.4, w: 0.19, h: 0.5 }
    ],
  },
];

// Distancia de los hotspots al orde de la esfera.
const HOTSPOT_DISTANCE = ROOM_RADIUS - 4;

// Contenedor en el DOM donde se irán insertando los botones de hotspot.
const hotspotsEl = document.getElementById('hotspots');

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
    tip.textContent = `▶   Ver ${spot.name}`;
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
  // Clic: abrir el menú correspondiente (con fundido).
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
}

// ============================================================================
// ZONAS INTERACTIVAS DENTRO DE UN MENÚ 2D
// ============================================================================
// Las zonas se definen en coordenadas normalizadas de la imagen (ver HOTSPOTS).
// Aquí las convertimos en <button> sobre la imagen, las colocamos en píxeles y
// las resaltamos con un cuadrado amarillo al hacer hover (estilo en styles.css).

// Lista de zonas del menú abierto: { def, el } (def = datos, el = <button>).
let currentMenuElements = [];

// Acción al clicar una zona. De momento solo informa por consola; aquí es donde
// engancharías abrir algo, reproducir un sonido, navegar, etc.
function onMenuElementClick(spot, def) {
  console.log(`Click en "${def.name}" (menú ${spot.name})`);
}

// Borra las zonas del menú anterior.
function clearMenuElements() {
  menuElementsEl.innerHTML = '';
  currentMenuElements = [];
}

// Crea un <button> por cada zona del menú y le engancha hover/click.
function buildMenuElements(spot) {
  clearMenuElements();
  for (const def of spot.elements || []) {
    const el = document.createElement('button');
    el.className = 'menu-element';
    el.setAttribute('aria-label', def.name);

    // Hover: cursor pointer + cuadrado amarillo (CSS) + tooltip con el nombre.
    el.addEventListener('mouseenter', () => {
      cursorBase = 'pointer';
      setCursorImage('pointer');
      tip.textContent = def.name;
      tip.classList.add('visible');
    });
    el.addEventListener('mousemove', (e) => {
      tip.style.left = `${e.clientX}px`;
      tip.style.top = `${e.clientY}px`;
    });
    el.addEventListener('mouseleave', () => {
      cursorBase = 'regular';
      tip.classList.remove('visible');
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
      vec3 c1 = vec3(34.0, 82.0, 227.0) / 255.0;
      vec3 c2 = vec3(153.0, 211.0, 151.0) / 255.0;
      vec3 c3 = vec3(251.0, 255.0, 190.0) / 255.0;

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
});

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
