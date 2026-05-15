import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const ENVIRONMENT_PATH = './assets/panoramica.png';
const PIXEL_SIZE = 6;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 1, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, renderer.domElement);
renderer.domElement.addEventListener('click', () => controls.lock());

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

const sphere = new THREE.Mesh(
  new THREE.SphereGeometry(1, 64, 64),
  new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 1.0,
    roughness: 0.15,
  })
);
scene.add(sphere);

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

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  pixelPass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
});

const MOVE_SPEED = 0.08;
const VERTICAL_SPEED = 0.06;

const MAX_DIST = ROOM_RADIUS - 3;

renderer.setAnimationLoop(() => {
  const speed = MOVE_SPEED * (keys.shift ? 2.5 : 1);
  if (keys.w) controls.moveForward(speed);
  if (keys.s) controls.moveForward(-speed);
  if (keys.a) controls.moveRight(-speed);
  if (keys.d) controls.moveRight(speed);
  if (keys.space) camera.position.y += VERTICAL_SPEED;
  if (keys.c) camera.position.y -= VERTICAL_SPEED;

  if (camera.position.length() > MAX_DIST) {
    camera.position.setLength(MAX_DIST);
  }

  composer.render();
});
