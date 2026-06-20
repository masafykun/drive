// DRIVE — the low-poly island: ground, walls, ramps, knockable crates,
// decorative trees/rocks, a central landmark, collectible coins, and the
// time-attack gates.
import * as THREE from 'three';

const PALETTE = {
  grass: 0x86c95b, sand: 0xe7d29a, wood: 0xc8743a, woodDark: 0x9c5526,
  crate: 0xe0a24a, rock: 0x9aa3ad, trunk: 0x7c4a2d, leaf: 0x4fa35a,
  leafDark: 0x3d8a4a, coin: 0xffd23f, pillar: 0xff5d73, pillar2: 0xfdfdfd,
};

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0, ...opts });
}

export const GROUND = 200;

export function buildWorld({ RAPIER, world, scene }) {
  const dynamicBodies = [];
  const coins = [];
  const half = GROUND / 2 - 1;

  // ---- ground ----
  const groundMesh = new THREE.Mesh(new THREE.BoxGeometry(GROUND, 1, GROUND), mat(PALETTE.grass));
  groundMesh.position.y = -0.5;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  for (const [x, z, r] of [[-34, 22, 12], [40, -30, 15], [16, 48, 9], [-58, -50, 13], [62, 52, 11]]) {
    const patch = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.12, 14), mat(PALETTE.sand));
    patch.position.set(x, 0.06, z);
    patch.receiveShadow = true;
    scene.add(patch);
  }

  const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(GROUND / 2, 0.5, GROUND / 2).setFriction(1.1), groundBody);

  // ---- perimeter walls ----
  const wallH = 2.4;
  for (const [x, y, z, w, h, d] of [
    [0, wallH / 2, half, GROUND, wallH, 1], [0, wallH / 2, -half, GROUND, wallH, 1],
    [half, wallH / 2, 0, 1, wallH, GROUND], [-half, wallH / 2, 0, 1, wallH, GROUND],
  ]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(PALETTE.woodDark, { roughness: 1 }));
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
    world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2), body);
  }

  // ---- static box helper (ramps / platforms) ----
  function staticBox(x, y, z, w, h, d, rotX, color) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(x, y, z); m.rotation.x = rotX;
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, 0, 0));
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setFriction(1.0), body);
  }
  staticBox(0, 0.9, -20, 9, 0.6, 11, -0.30, PALETTE.wood);
  staticBox(0, 2.0, -33, 13, 0.6, 8, 0, PALETTE.woodDark);
  staticBox(-44, 0.7, 6, 7, 0.5, 9, 0.28, PALETTE.wood);
  staticBox(40, 0.6, 40, 8, 0.5, 10, -0.24, PALETTE.wood);
  staticBox(-30, 0.6, -48, 8, 0.5, 9, 0.26, PALETTE.wood);

  // ---- central landmark: candy-striped pillar ----
  const pillar = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1 - i * 0.06, 1.15 - i * 0.06, 1.1, 10),
      mat(i % 2 ? PALETTE.pillar2 : PALETTE.pillar, { roughness: 0.6 }),
    );
    seg.position.y = 0.55 + i * 1.1; seg.castShadow = true; pillar.add(seg);
  }
  const topper = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), mat(PALETTE.coin, { metalness: 0.3, roughness: 0.4 }));
  topper.position.y = 10.3; topper.castShadow = true; pillar.add(topper);
  scene.add(pillar);
  {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 5.5, 0));
    world.createCollider(RAPIER.ColliderDesc.cylinder(5.5, 1.1), body);
  }

  // ---- decorations ----
  function tree(x, z, s = 1) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.3 * s, 1.4 * s, 7), mat(PALETTE.trunk));
    trunk.position.y = 0.7 * s; trunk.castShadow = true;
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.1 * s, 1.8 * s, 8), mat(PALETTE.leaf));
    c1.position.y = 1.9 * s; c1.castShadow = true;
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.85 * s, 1.4 * s, 8), mat(PALETTE.leafDark));
    c2.position.y = 2.7 * s; c2.castShadow = true;
    g.add(trunk, c1, c2); g.position.set(x, 0, z); scene.add(g);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, 1, z));
    world.createCollider(RAPIER.ColliderDesc.cylinder(1, 0.3 * s), body);
  }
  function rock(x, z, s = 1) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), mat(PALETTE.rock));
    m.position.set(x, s * 0.5, z); m.rotation.set(s, s * 2, s * 0.5);
    m.castShadow = true; m.receiveShadow = true; scene.add(m);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, s * 0.5, z));
    world.createCollider(RAPIER.ColliderDesc.ball(s * 0.8), body);
  }
  const treeSpots = [
    [-70, -70], [-78, -58], [-64, -78], [72, 64], [80, 50], [66, 78], [-72, 70], [76, -72],
    [-26, 78], [30, -78], [-82, 10], [84, -8], [12, 82], [-40, -76], [50, 74], [-84, -30],
  ];
  treeSpots.forEach(([x, z], i) => tree(x, z, 0.9 + (i % 3) * 0.3));
  [[-26, -12, 1.6], [44, 10, 1.2], [-12, 36, 1.9], [22, -24, 1.1], [-50, 34, 1.4], [58, -54, 1.7], [10, 62, 1.3]]
    .forEach(([x, z, s]) => rock(x, z, s));

  // ---- knockable crates ----
  function crate(x, z, size = 1.2) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat(PALETTE.crate, { roughness: 0.7 }));
    m.castShadow = true; m.receiveShadow = true; scene.add(m);
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(x, size / 2 + 0.1, z).setLinearDamping(0.4).setAngularDamping(0.6),
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(size / 2, size / 2, size / 2).setDensity(0.4).setFriction(0.8), body);
    dynamicBodies.push({ body, mesh: m });
  }
  [[10, 10], [11.3, 10], [10.6, 11.1], [10.65, 10.5]].forEach(([x, z]) => crate(x, z));
  [[-16, 6], [-18, 4], [28, -10], [30, -8], [-8, -26], [-10, -24], [18, 24], [20, 22],
   [-46, -14], [52, 22], [-30, 50], [36, -44]].forEach(([x, z]) => crate(x, z, 1.0 + Math.random() * 0.5));

  // ---- collectible coins ----
  const coinGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.18, 16);
  const coinMat = new THREE.MeshStandardMaterial({ color: PALETTE.coin, metalness: 0.6, roughness: 0.25, emissive: 0x6b4e00, emissiveIntensity: 0.4 });
  const coinSpots = [
    [14, 0], [22, -4], [30, -10], [-14, 14], [-22, 22], [-30, 30], [6, -18], [0, -28],
    [-6, -40], [38, 18], [46, 26], [-40, -10], [-50, 4], [52, -16], [0, 24], [-16, 44],
    [28, 38], [-34, 48], [60, 40], [-64, 24], [68, -40], [-58, -40], [44, 60], [-44, 62],
    [8, -72], [-72, 0],
  ];
  for (const [x, z] of coinSpots) {
    const m = new THREE.Mesh(coinGeo, coinMat);
    m.rotation.x = Math.PI / 2; m.position.set(x, 1.1, z); m.castShadow = true;
    scene.add(m);
    coins.push({ mesh: m, position: new THREE.Vector3(x, 1.1, z), collected: false });
  }

  // ---- time-attack gates (loop circuit; gate 0 = START/FINISH) ----
  const gatePts = [[0, 58], [-58, 32], [-64, -34], [0, -66], [64, -34], [58, 32]];
  const gates = gatePts.map(([x, z], i) => {
    const next = gatePts[(i + 1) % gatePts.length];
    const faceAngle = Math.atan2(next[0] - x, next[1] - z);
    return buildGate(scene, new THREE.Vector3(x, 0, z), faceAngle, i === 0);
  });

  return { dynamicBodies, coins, gates, groundSize: GROUND };
}

// One gate: two posts, a top bar, and a glowing "curtain" you drive through.
function buildGate(scene, pos, faceAngle, isStart) {
  const W = 8, H = 5.5;
  const g = new THREE.Group();
  const postGeo = new THREE.BoxGeometry(0.55, H, 0.55);
  const materials = [];
  function post(x) {
    const m = new THREE.MeshStandardMaterial({ color: isStart ? 0xffffff : 0xdfe6ef, flatShading: true, roughness: 0.5 });
    materials.push(m);
    const mesh = new THREE.Mesh(postGeo, m);
    mesh.position.set(x, H / 2, 0); mesh.castShadow = true;
    return mesh;
  }
  const barMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.5 });
  materials.push(barMat);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.6, 0.6), barMat);
  bar.position.set(0, H, 0); bar.castShadow = true;

  const curtain = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H - 0.6),
    new THREE.MeshBasicMaterial({ color: 0x49e0ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }),
  );
  curtain.position.set(0, H / 2, 0);

  g.add(post(-W / 2), post(W / 2), bar, curtain);
  g.position.copy(pos);
  g.rotation.y = faceAngle;
  scene.add(g);

  function setState(s) {
    let e = 0x000000, cur = 0x49e0ff, op = 0.1;
    if (s === 'next') { e = 0x1f9bd6; cur = 0x4ef0ff; op = 0.34; }
    else if (s === 'done') { e = 0x1f7a3a; cur = 0x6ff0a0; op = 0.16; }
    materials.forEach((m) => m.emissive && m.emissive.setHex(e));
    curtain.material.color.setHex(cur);
    curtain.material.opacity = op;
  }
  setState('idle');

  return { position: pos.clone(), setState, group: g, curtain };
}
