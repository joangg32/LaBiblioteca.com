import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const ENVIRONMENT_PATH = './assets/panoramica-2.png';
const PIXEL_SIZE = 6;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 1, 2);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.5;
document.body.appendChild(renderer.domElement);

// Mirar alrededor solo al arrastrar con el ratón (click + mover).
camera.rotation.order = 'YXZ';
const LOOK_SPEED = 0.0025;
const PITCH_LIMIT = Math.PI / 2 - 0.01;
let dragging = false;
let lastX = 0;
let lastY = 0;

renderer.domElement.addEventListener('mousedown', (e) => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  renderer.domElement.style.cursor = 'grabbing';
});
window.addEventListener('mouseup', () => {
  dragging = false;
  renderer.domElement.style.cursor = 'grab';
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  camera.rotation.y -= dx * LOOK_SPEED;
  camera.rotation.x = THREE.MathUtils.clamp(
    camera.rotation.x - dy * LOOK_SPEED,
    -PITCH_LIMIT,
    PITCH_LIMIT
  );
});
renderer.domElement.style.cursor = 'grab';

const keys = { w: false, a: false, s: false, d: false, shift: false, space: false, c: false };
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = true;
  if (e.code === 'Space') keys.space = true;
  if (e.key === 'Shift') keys.shift = true;
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = false;
  if (e.code === 'Space') keys.space = false;
  if (e.key === 'Shift') keys.shift = false;
});

const MIN_FOV = 15;
const MAX_FOV = 90;
renderer.domElement.addEventListener('wheel', (event) => {
  event.preventDefault();
  camera.fov = THREE.MathUtils.clamp(
    camera.fov + event.deltaY * 0.05,
    MIN_FOV,
    MAX_FOV
  );
  camera.updateProjectionMatrix();
}, { passive: false });

const ROOM_RADIUS = 15;
const roomGeometry = new THREE.SphereGeometry(ROOM_RADIUS, 64, 64);
const roomMaterial = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
const roomMesh = new THREE.Mesh(roomGeometry, roomMaterial);
scene.add(roomMesh);

function loadEnvironment(path) {
  const isHDR = /\.(hdr|exr)$/i.test(path);
  const loader = isHDR ? new RGBELoader() : new THREE.TextureLoader();

  loader.load(path, (texture) => {
    if (!isHDR) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.x = -1;
    texture.offset.x = 1;
    roomMaterial.map = texture;
    roomMaterial.needsUpdate = true;

    const envTexture = texture.clone();
    envTexture.mapping = THREE.EquirectangularReflectionMapping;
    envTexture.repeat.set(1, 1);
    envTexture.offset.set(0, 0);
    envTexture.needsUpdate = true;
    scene.environment = envTexture;
  });
}

loadEnvironment(ENVIRONMENT_PATH);

// ---------------------------------------------------------------------------
// Puntos de interacción
// ---------------------------------------------------------------------------
// Cada punto se coloca con un ángulo de orientación (yaw) y elevación (pitch)
// en grados. Ajusta estos valores para situar el punto exactamente sobre el
// elemento correspondiente del panorama.
//   yaw   = 0 mira al frente, valores negativos a la izquierda.
//   pitch = 0 a la altura de los ojos, negativo hacia abajo (mesas).
const HOTSPOTS = [
  { name: 'Arcade', image: './assets/menu-arcade.png',     yawDeg: -180, pitchDeg: 15 }, // mesa de los ordenadores
  { name: 'Ordenadores', image: './assets/menu-pc.png',  yawDeg: -15, pitchDeg: -12 }, // mesa con el radiocassete
  { name: 'Espejo',       image: './assets/menu-mirror.png', yawDeg:  75, pitchDeg:   0 }, // zona del espejo
  { name: 'Radio',       image: './assets/menu-table.png', yawDeg: 160, pitchDeg:  -30 }, // otra parte de la sala
];

const HOTSPOT_DISTANCE = ROOM_RADIUS - 4;

// Textura circular generada por canvas para el marcador.
function makeMarkerTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;
  ctx.beginPath();
  ctx.arc(c, c, c * 0.85, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(251,255,190,0.85)';
  ctx.fill();
  ctx.lineWidth = size * 0.08;
  ctx.strokeStyle = 'rgba(34,82,227,0.95)';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c, c, c * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(34,82,227,0.95)';
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const markerTexture = makeMarkerTexture();
const hotspotSprites = [];

for (const spot of HOTSPOTS) {
  const yaw = THREE.MathUtils.degToRad(spot.yawDeg);
  const pitch = THREE.MathUtils.degToRad(spot.pitchDeg);
  const dir = new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch)
  );

  const material = new THREE.SpriteMaterial({
    map: markerTexture,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(dir.multiplyScalar(HOTSPOT_DISTANCE));
  sprite.scale.set(0.8, 0.8, 0.8);
  sprite.renderOrder = 999;
  sprite.userData.hotspot = spot;
  scene.add(sprite);
  hotspotSprites.push(sprite);
}

// Overlay del menú (solo botón de cierre; la imagen se dibuja en el canvas).
const menuOverlay = document.getElementById('menu-overlay');
const menuClose = document.getElementById('menu-close');
const tip = document.getElementById('hotspot-tip');
const fadeEl = document.getElementById('fade');

// Ejecuta un cambio (abrir/cerrar menú) con un fundido a negro para
// suavizar el salto entre el HDRI y el menú plano.
let transitioning = false;
function withFade(action) {
  if (transitioning) return;
  transitioning = true;
  fadeEl.classList.add('on');
  setTimeout(() => {
    action();
    fadeEl.classList.remove('on');
    setTimeout(() => { transitioning = false; }, 260);
  }, 260);
}

let menuOpen = false;
const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();

function getMenuTexture(path) {
  if (textureCache.has(path)) return textureCache.get(path);
  const tex = textureLoader.load(path, () => fitMenuPlane());
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(path, tex);
  return tex;
}

function openMenu(spot) {
  menuMaterial.map = getMenuTexture(spot.image);
  menuMaterial.needsUpdate = true;
  fitMenuPlane();
  menuOpen = true;
  menuOverlay.classList.add('visible');
}
function closeMenu() {
  menuOpen = false;
  menuOverlay.classList.remove('visible');
}
menuClose.addEventListener('click', () => withFade(closeMenu));
menuOverlay.addEventListener('click', (e) => {
  if (e.target === menuOverlay) withFade(closeMenu);
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menuOpen) withFade(closeMenu);
});

// Raycaster para detectar clics sobre los puntos (diferenciando de arrastrar).
const raycaster = new THREE.Raycaster();
raycaster.params.Sprite = { threshold: 0 };
const pointer = new THREE.Vector2();
let downX = 0;
let downY = 0;
let downTime = 0;

renderer.domElement.addEventListener('mousedown', (e) => {
  downX = e.clientX;
  downY = e.clientY;
  downTime = performance.now();
});

renderer.domElement.addEventListener('mouseup', (e) => {
  const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
  const elapsed = performance.now() - downTime;
  if (moved > 6 || elapsed > 350) return; // fue un arrastre, no un clic

  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(hotspotSprites, false);
  if (hits.length > 0) {
    const spot = hits[0].object.userData.hotspot;
    tip.classList.remove('visible');
    withFade(() => openMenu(spot));
  }
});

// Hover sobre un punto: cambia el cursor y muestra una nota indicando
// que ese punto abre un menú.
renderer.domElement.addEventListener('mousemove', (e) => {
  if (dragging || menuOpen || transitioning) {
    tip.classList.remove('visible');
    return;
  }
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(hotspotSprites, false);
  if (hits.length > 0) {
    const spot = hits[0].object.userData.hotspot;
    renderer.domElement.style.cursor = 'pointer';
    tip.textContent = `▶ ${spot.name} · abrir menú`;
    tip.style.left = `${e.clientX}px`;
    tip.style.top = `${e.clientY}px`;
    tip.classList.add('visible');
  } else {
    renderer.domElement.style.cursor = 'grab';
    tip.classList.remove('visible');
  }
});

const PixelPaletteShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    pixelSize: { value: PIXEL_SIZE },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float pixelSize;
    varying vec2 vUv;

    void main() {
      vec2 dxy = pixelSize / resolution;
      vec2 coord = dxy * floor(vUv / dxy) + dxy * 0.5;
      vec3 color = texture2D(tDiffuse, coord).rgb;

      vec3 c0 = vec3(0.0, 0.0, 0.0);
      vec3 c1 = vec3(34.0, 82.0, 227.0) / 255.0;
      vec3 c2 = vec3(153.0, 211.0, 151.0) / 255.0;
      vec3 c3 = vec3(251.0, 255.0, 190.0) / 255.0;

      float lum = dot(color, vec3(0.299, 0.587, 0.114));
      float t0 = 0.12;
      float t1 = 0.35;
      float t2 = 0.65;

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

      float paletteStrength = 0.4;
      vec3 result = mix(color, palette, paletteStrength);

      gl_FragColor = vec4(result, 1.0);
    }
  `,
};

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const pixelPass = new ShaderPass(PixelPaletteShader);
composer.addPass(pixelPass);

// Escena aparte para mostrar la imagen del menú a pantalla completa,
// renderizada por el MISMO shader de píxeles/paleta que el fondo.
const menuScene = new THREE.Scene();
const menuCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
menuCamera.position.z = 1;
const menuMaterial = new THREE.MeshBasicMaterial({ transparent: false });
const menuPlane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), menuMaterial);
menuScene.add(menuPlane);

const menuComposer = new EffectComposer(renderer);
menuComposer.addPass(new RenderPass(menuScene, menuCamera));
const menuPixelPass = new ShaderPass(PixelPaletteShader);
menuComposer.addPass(menuPixelPass);

// Escala el plano para que la imagen cubra toda la pantalla (modo "cover").
function fitMenuPlane() {
  const tex = menuMaterial.map;
  if (!tex || !tex.image) return;
  const screenAspect = window.innerWidth / window.innerHeight;
  const imgAspect = tex.image.width / tex.image.height;
  if (imgAspect > screenAspect) {
    menuPlane.scale.set(imgAspect / screenAspect, 1, 1);
  } else {
    menuPlane.scale.set(1, screenAspect / imgAspect, 1);
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  menuComposer.setSize(window.innerWidth, window.innerHeight);
  pixelPass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
  menuPixelPass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
  fitMenuPlane();
});

const MOVE_SPEED = 0.08;
const VERTICAL_SPEED = 0.06;
// Límites de movimiento: la panorámica está proyectada en una esfera y solo
// se ve sin deformarse cerca del centro. Mantenemos la cámara dentro de un
// radio pequeño (horizontal) y un rango de altura acotado.
const MAX_RADIUS = 2.5;
const MIN_Y = 0.4;
const MAX_Y = 2.6;

const forward = new THREE.Vector3();
const right = new THREE.Vector3();

renderer.setAnimationLoop(() => {
  if (menuOpen) {
    menuComposer.render();
    return;
  }

  const speed = MOVE_SPEED * (keys.shift ? 2.5 : 1);

  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  right.set(-forward.z, 0, forward.x);

  if (keys.w) camera.position.addScaledVector(forward, speed);
  if (keys.s) camera.position.addScaledVector(forward, -speed);
  if (keys.a) camera.position.addScaledVector(right, -speed);
  if (keys.d) camera.position.addScaledVector(right, speed);
  if (keys.space) camera.position.y += VERTICAL_SPEED;
  if (keys.c) camera.position.y -= VERTICAL_SPEED;

  const horiz = Math.hypot(camera.position.x, camera.position.z);
  if (horiz > MAX_RADIUS) {
    const s = MAX_RADIUS / horiz;
    camera.position.x *= s;
    camera.position.z *= s;
  }
  camera.position.y = THREE.MathUtils.clamp(camera.position.y, MIN_Y, MAX_Y);

  composer.render();
});
