// DRIVE — explore a low-poly island in a little car (Three.js + Rapier),
// now with a time-attack circuit, coin collection and celebrations.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { buildWorld } from './world.js';
import { createCar } from './car.js';
import { createRace } from './race.js';
import { createConfetti } from './fx.js';
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
scene.fog = new THREE.Fog(0xc6e6ff, 95, 330);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 700);
camera.position.set(0, 8, 84);

// ---------- sky ----------
scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(460, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { top: { value: new THREE.Color(0x3f86d4) }, bottom: { value: new THREE.Color(0xd4eeff) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 bottom; void main(){ float h = normalize(vP).y*0.5+0.5; gl_FragColor = vec4(mix(bottom, top, smoothstep(0.0,0.65,h)), 1.0); }',
  }),
));

// ---------- lights ----------
scene.add(new THREE.HemisphereLight(0xbcd9ff, 0x6a7a52, 0.85));
const sun = new THREE.DirectionalLight(0xfff2d8, 2.0);
sun.position.set(30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 170;
sun.shadow.camera.left = -55; sun.shadow.camera.right = 55;
sun.shadow.camera.top = 55; sun.shadow.camera.bottom = -55;
sun.shadow.bias = -0.0004;
scene.add(sun, sun.target);

// ---------- input ----------
const keys = new Set();
const codeMap = {
  KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'nitro',
};
window.addEventListener('keydown', (e) => {
  if (e.code in codeMap || e.code === 'KeyR') e.preventDefault();
  keys.add(e.code);
  if (e.code === 'KeyR' && car) car.reset();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
function readInput() {
  const i = { forward: false, back: false, left: false, right: false, nitro: false };
  for (const code of keys) if (codeMap[code]) i[codeMap[code]] = true;
  return i;
}
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
bindHold('btn-up', 'KeyW'); bindHold('btn-down', 'KeyS');
bindHold('btn-left', 'KeyA'); bindHold('btn-right', 'KeyD');
bindHold('btn-nitro', 'Space');

// ---------- HUD ----------
const $ = (id) => document.getElementById(id);
function fmt(sec) {
  if (sec == null) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}
const hud = {
  setTimer: (s) => { $('timer').textContent = s == null ? '—' : fmt(s); },
  setBest: (s) => { $('best').textContent = s == null ? '—' : fmt(s); },
  setProgress: (p, t) => { $('cp').textContent = `${p}/${t}`; },
};
let bannerTimer = 0;
function banner(title, sub) {
  $('banner-title').textContent = title;
  $('banner-sub').textContent = sub || '';
  $('banner').classList.add('show');
  bannerTimer = 3.4;
}

// ---------- resize ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- state ----------
let world, car, env, race, confetti, beacon;
let collected = 0, coinsDone = false;
const camPos = new THREE.Vector3(0, 8, 84);
const camLook = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const carVec = new THREE.Vector3();
const SPAWN = { x: 0, y: 2.5, z: 72 };

async function init() {
  await RAPIER.init();
  world = new RAPIER.World({ x: 0, y: -14, z: 0 });
  world.timestep = 1 / 60;

  env = buildWorld({ RAPIER, world, scene });
  car = createCar({ RAPIER, world, scene, spawn: SPAWN });
  confetti = createConfetti(scene);

  beacon = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 1.5, 4),
    new THREE.MeshBasicMaterial({ color: 0x4ef0ff, toneMapped: false }),
  );
  beacon.rotation.x = Math.PI;
  scene.add(beacon);

  race = createRace({
    gates: env.gates,
    hud,
    onFinish: (time, best, isBest) => {
      banner(isBest ? `FINISH!  ${fmt(time)}` : `FINISH!  ${fmt(time)}`, isBest ? '★ 自己ベスト更新！' : `ベスト ${fmt(best)}`);
      confetti.burst(carVec, 180);
    },
  });

  $('coins-total').textContent = env.coins.length;
  $('loading').classList.add('hidden');
  window.__drive = { car, camera, env, race };
  renderer.setAnimationLoop(frame);
}

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 30);

  car.update(1 / 60, readInput());
  world.step();
  car.sync(1 / 60);

  for (const { body, mesh } of env.dynamicBodies) {
    const t = body.translation();
    const r = body.rotation();
    mesh.position.set(t.x, t.y, t.z);
    mesh.quaternion.set(r.x, r.y, r.z, r.w);
  }

  const carT = car.body.translation();
  carVec.set(carT.x, carT.y, carT.z);

  // coins
  for (const coin of env.coins) {
    if (coin.collected) continue;
    coin.mesh.rotation.z += dt * 2.2;
    coin.mesh.position.y = coin.position.y + Math.sin(clock.elapsedTime * 3 + coin.position.x) * 0.18;
    const dx = carT.x - coin.position.x, dz = carT.z - coin.position.z, dy = carT.y - coin.position.y;
    if (dx * dx + dz * dz + dy * dy < 3.4) {
      coin.collected = true; coin.mesh.visible = false; collected++;
      $('coins').textContent = collected;
      if (collected === env.coins.length && !coinsDone) {
        coinsDone = true;
        banner('ALL COINS! 🎉', `${env.coins.length}枚コンプリート`);
        confetti.burst(carVec, 180);
      }
    }
  }

  // time-attack
  const target = race.update(carT, clock.elapsedTime);
  const g = env.gates[target].position;
  beacon.position.set(g.x, 6.6 + Math.sin(clock.elapsedTime * 3) * 0.4, g.z);
  beacon.rotation.y += dt * 2;

  confetti.update(dt);
  if (bannerTimer > 0) { bannerTimer -= dt; if (bannerTimer <= 0) $('banner').classList.remove('show'); }

  // chase camera
  const r = car.body.rotation();
  tmpQuat.set(r.x, r.y, r.z, r.w);
  tmpV.set(0, 3.6, -8.5).applyQuaternion(tmpQuat).add(carVec);
  camPos.lerp(tmpV, 0.08);
  camera.position.copy(camPos);
  camLook.lerp(new THREE.Vector3(carT.x, carT.y + 1.1, carT.z), 0.15);
  camera.lookAt(camLook);

  sun.position.set(carT.x + 30, carT.y + 50, carT.z + 20);
  sun.target.position.set(carT.x, carT.y, carT.z);

  $('speed').textContent = Math.abs(Math.round(car.speed() * 3.6));

  // nitro gauge + boost camera punch
  const nb = $('nitro');
  if (nb) {
    nb.style.width = (car.nitro() * 100).toFixed(0) + '%';
    nb.parentElement.parentElement.classList.toggle('boosting', car.boosting());
  }
  const targetFov = car.boosting() ? 70 : 60;
  if (Math.abs(camera.fov - targetFov) > 0.1) {
    camera.fov += (targetFov - camera.fov) * 0.12;
    camera.updateProjectionMatrix();
  }

  renderer.render(scene, camera);
}

init().catch((err) => {
  console.error(err);
  $('loading')?.classList.add('hidden');
});
