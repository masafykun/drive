// DRIVE — explore a low-poly island in a little car (Three.js + Rapier).
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { buildWorld } from './world.js';
import { createCar } from './car.js';
import './style.css';

// ---------- renderer ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xc6e6ff, 70, 210);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 600);
camera.position.set(0, 8, -14);

// ---------- sky ----------
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(400, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { top: { value: new THREE.Color(0x3f86d4) }, bottom: { value: new THREE.Color(0xd4eeff) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 bottom; void main(){ float h = normalize(vP).y*0.5+0.5; gl_FragColor = vec4(mix(bottom, top, smoothstep(0.0,0.65,h)), 1.0); }',
  }),
);
scene.add(sky);

// ---------- lights ----------
scene.add(new THREE.HemisphereLight(0xbcd9ff, 0x6a7a52, 0.85));
const sun = new THREE.DirectionalLight(0xfff2d8, 2.0);
sun.position.set(30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 160;
sun.shadow.camera.left = -45;
sun.shadow.camera.right = 45;
sun.shadow.camera.top = 45;
sun.shadow.camera.bottom = -45;
sun.shadow.bias = -0.0004;
scene.add(sun);
scene.add(sun.target);

// ---------- input ----------
const keys = new Set();
const codeMap = {
  KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'brake',
};
window.addEventListener('keydown', (e) => {
  if (e.code in codeMap || e.code === 'KeyR') e.preventDefault();
  keys.add(e.code);
  if (e.code === 'KeyR' && car) car.reset();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
function readInput() {
  const i = { forward: false, back: false, left: false, right: false, brake: false };
  for (const code of keys) if (codeMap[code]) i[codeMap[code]] = true;
  return i;
}

// touch / on-screen controls
function bindHold(id, code) {
  const el = document.getElementById(id);
  if (!el) return;
  const on = (e) => { e.preventDefault(); keys.add(code); };
  const off = (e) => { e.preventDefault(); keys.delete(code); };
  el.addEventListener('pointerdown', on);
  el.addEventListener('pointerup', off);
  el.addEventListener('pointerleave', off);
  el.addEventListener('pointercancel', off);
}
bindHold('btn-up', 'KeyW');
bindHold('btn-down', 'KeyS');
bindHold('btn-left', 'KeyA');
bindHold('btn-right', 'KeyD');

// ---------- HUD ----------
const coinEl = document.getElementById('coins');
const speedEl = document.getElementById('speed');
const totalEl = document.getElementById('coins-total');

// ---------- resize ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- state ----------
let world, car, env;
let collected = 0;
const camPos = new THREE.Vector3(0, 8, -14);
const camLook = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const SPAWN = { x: 0, y: 2.5, z: 30 };

async function init() {
  await RAPIER.init();
  world = new RAPIER.World({ x: 0, y: -14, z: 0 });
  world.timestep = 1 / 60;

  env = buildWorld({ RAPIER, world, scene });
  car = createCar({ RAPIER, world, scene, spawn: SPAWN });

  if (totalEl) totalEl.textContent = env.coins.length;
  document.getElementById('loading')?.classList.add('hidden');
  window.__drive = { car, camera, env, scene, keys }; // debug handle
  renderer.setAnimationLoop(frame);
}

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 30);

  // drive + step physics
  car.update(1 / 60, readInput());
  world.step();
  car.sync(1 / 60);

  // sync dynamic crates
  for (const { body, mesh } of env.dynamicBodies) {
    const t = body.translation();
    const r = body.rotation();
    mesh.position.set(t.x, t.y, t.z);
    mesh.quaternion.set(r.x, r.y, r.z, r.w);
  }

  // coins: spin, bob, collect
  const carT = car.body.translation();
  for (const coin of env.coins) {
    if (coin.collected) continue;
    coin.mesh.rotation.z += dt * 2.2;
    coin.mesh.position.y = coin.position.y + Math.sin(clock.elapsedTime * 3 + coin.position.x) * 0.18;
    const dx = carT.x - coin.position.x, dz = carT.z - coin.position.z, dy = carT.y - coin.position.y;
    if (dx * dx + dz * dz + dy * dy < 3.2) {
      coin.collected = true;
      coin.mesh.visible = false;
      collected++;
      if (coinEl) coinEl.textContent = collected;
    }
  }

  // chase camera (behind the car along its forward +Z)
  const r = car.body.rotation();
  tmpQuat.set(r.x, r.y, r.z, r.w);
  tmpV.set(0, 3.6, -8.5).applyQuaternion(tmpQuat).add(new THREE.Vector3(carT.x, carT.y, carT.z));
  camPos.lerp(tmpV, 0.08);
  camera.position.copy(camPos);
  camLook.lerp(new THREE.Vector3(carT.x, carT.y + 1.1, carT.z), 0.15);
  camera.lookAt(camLook);

  // sun follows the car for crisp shadows
  sun.position.set(carT.x + 30, carT.y + 50, carT.z + 20);
  sun.target.position.set(carT.x, carT.y, carT.z);

  // HUD speed (km/h)
  if (speedEl) speedEl.textContent = Math.abs(Math.round(car.speed() * 3.6));

  renderer.render(scene, camera);
}

init().catch((err) => {
  console.error(err);
  document.getElementById('loading')?.classList.add('hidden');
});
