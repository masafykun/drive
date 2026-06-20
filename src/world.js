// DRIVE — builds the low-poly island: ground, walls, ramps, knockable crates,
// decorative trees/rocks, a central landmark, and collectible coins.
import * as THREE from 'three';

const PALETTE = {
  grass: 0x86c95b,
  grassDark: 0x6fb049,
  sand: 0xe7d29a,
  wood: 0xc8743a,
  woodDark: 0x9c5526,
  crate: 0xe0a24a,
  rock: 0x9aa3ad,
  trunk: 0x7c4a2d,
  leaf: 0x4fa35a,
  leafDark: 0x3d8a4a,
  coin: 0xffd23f,
  pillar: 0xff5d73,
  pillar2: 0xfdfdfd,
};

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0.0, ...opts });
}

export function buildWorld({ RAPIER, world, scene }) {
  const dynamicBodies = [];
  const coins = [];

  // ---- ground ----
  const GROUND = 120;
  const groundMesh = new THREE.Mesh(new THREE.BoxGeometry(GROUND, 1, GROUND), mat(PALETTE.grass));
  groundMesh.position.y = -0.5;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // a few flat sand patches for visual variety
  for (const [x, z, r] of [[-22, 14, 9], [26, -20, 11], [10, 30, 7]]) {
    const patch = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.12, 12), mat(PALETTE.sand));
    patch.position.set(x, 0.06, z);
    patch.receiveShadow = true;
    scene.add(patch);
  }

  const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(GROUND / 2, 0.5, GROUND / 2).setFriction(1.1), groundBody);

  // ---- perimeter walls ----
  const half = GROUND / 2 - 1;
  const wallH = 2.2;
  const wallSpecs = [
    [0, wallH / 2, half, GROUND, wallH, 1],
    [0, wallH / 2, -half, GROUND, wallH, 1],
    [half, wallH / 2, 0, 1, wallH, GROUND],
    [-half, wallH / 2, 0, 1, wallH, GROUND],
  ];
  for (const [x, y, z, w, h, d] of wallSpecs) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(PALETTE.woodDark, { roughness: 1 }));
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
    world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2), body);
  }

  // ---- static box helper (ramps, platforms) ----
  function staticBox(x, y, z, w, h, d, rotX, color) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(x, y, z);
    m.rotation.x = rotX;
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, 0, 0));
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setFriction(1.0), body);
    return m;
  }

  // ramps (tilted boxes) and a raised platform reachable from one
  staticBox(0, 0.9, -22, 8, 0.6, 10, -0.32, PALETTE.wood);          // main launch ramp
  staticBox(-30, 0.7, 8, 6, 0.5, 8, 0.30, PALETTE.wood);            // side ramp
  staticBox(24, 0.6, 22, 7, 0.5, 9, -0.26, PALETTE.wood);           // another ramp
  staticBox(0, 2.0, -34, 12, 0.6, 8, 0, PALETTE.woodDark);          // platform on top of main ramp

  // ---- central landmark: a tall candy-striped pillar ----
  const pillar = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1 - i * 0.06, 1.15 - i * 0.06, 1.1, 10),
      mat(i % 2 ? PALETTE.pillar2 : PALETTE.pillar, { roughness: 0.6 }),
    );
    seg.position.y = 0.55 + i * 1.1;
    seg.castShadow = true;
    pillar.add(seg);
  }
  const topper = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), mat(PALETTE.coin, { metalness: 0.3, roughness: 0.4 }));
  topper.position.y = 0.55 + 9 * 1.1 + 0.4;
  topper.castShadow = true;
  pillar.add(topper);
  scene.add(pillar);
  {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 5.5, 0));
    world.createCollider(RAPIER.ColliderDesc.cylinder(5.5, 1.1), body);
  }

  // ---- decorations: trees + rocks ----
  function tree(x, z, s = 1) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.3 * s, 1.4 * s, 7), mat(PALETTE.trunk));
    trunk.position.y = 0.7 * s; trunk.castShadow = true;
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.1 * s, 1.8 * s, 8), mat(PALETTE.leaf));
    c1.position.y = 1.9 * s; c1.castShadow = true;
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.85 * s, 1.4 * s, 8), mat(PALETTE.leafDark));
    c2.position.y = 2.7 * s; c2.castShadow = true;
    g.add(trunk, c1, c2);
    g.position.set(x, 0, z);
    scene.add(g);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, 1, z));
    world.createCollider(RAPIER.ColliderDesc.cylinder(1, 0.3 * s), body);
  }
  function rock(x, z, s = 1) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), mat(PALETTE.rock));
    m.position.set(x, s * 0.5, z);
    m.rotation.set(Math.random(), Math.random(), Math.random());
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, s * 0.5, z));
    world.createCollider(RAPIER.ColliderDesc.ball(s * 0.8), body);
  }
  const treeSpots = [[-40, -40], [-44, -30], [-36, -46], [42, 36], [46, 28], [38, 44], [-42, 40], [44, -42], [-15, 45], [18, -45]];
  treeSpots.forEach(([x, z], i) => tree(x, z, 0.9 + (i % 3) * 0.25));
  const rockSpots = [[-18, -10, 1.4], [30, 6, 1.1], [-8, 26, 1.7], [16, -16, 1.0], [-34, 22, 1.3]];
  rockSpots.forEach(([x, z, s]) => rock(x, z, s));

  // ---- knockable crates (dynamic) ----
  function crate(x, z, size = 1.2) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat(PALETTE.crate, { roughness: 0.7 }));
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(x, size / 2 + 0.1, z).setLinearDamping(0.4).setAngularDamping(0.6),
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(size / 2, size / 2, size / 2).setDensity(0.4).setFriction(0.8), body);
    dynamicBodies.push({ body, mesh: m });
  }
  // a small pyramid of crates + a scattered field
  const stack = [[8, 8], [9.3, 8], [8.6, 9.1]];
  stack.forEach(([x, z]) => crate(x, z));
  crate(8.65, 8.5, 1.2);
  [[-12, 4], [-14, 2], [20, -8], [22, -6], [-6, -18], [-8, -16], [14, 18], [16, 16]].forEach(([x, z]) => crate(x, z, 1.0 + Math.random() * 0.5));

  // ---- collectible coins ----
  const coinGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.18, 16);
  const coinMat = new THREE.MeshStandardMaterial({ color: PALETTE.coin, metalness: 0.6, roughness: 0.25, emissive: 0x6b4e00, emissiveIntensity: 0.4 });
  const coinSpots = [
    [12, 0], [18, -2], [24, -6], [-10, 12], [-16, 18], [-22, 24],
    [4, -14], [0, -22], [-4, -30], [30, 14], [34, 20], [-30, -8],
    [-36, 0], [40, -10], [0, 18], [-12, 34], [22, 28], [-26, 36],
  ];
  for (const [x, z] of coinSpots) {
    const m = new THREE.Mesh(coinGeo, coinMat);
    m.rotation.x = Math.PI / 2;
    m.position.set(x, 1.1, z);
    m.castShadow = true;
    scene.add(m);
    coins.push({ mesh: m, position: new THREE.Vector3(x, 1.1, z), collected: false });
  }

  return { dynamicBodies, coins, groundSize: GROUND };
}
