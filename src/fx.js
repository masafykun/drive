// DRIVE — celebratory confetti burst (instanced, GPU-light).
import * as THREE from 'three';

export function createConfetti(scene) {
  const COUNT = 180;
  const geo = new THREE.PlaneGeometry(0.28, 0.42);
  const mesh = new THREE.InstancedMesh(
    geo,
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }),
    COUNT,
  );
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const COLORS = [0xff5a8a, 0xffd23f, 0x49e0ff, 0x7af07a, 0xb072ff, 0xff8a3d];
  const tmpC = new THREE.Color();
  for (let i = 0; i < COUNT; i++) mesh.setColorAt(i, tmpC.setHex(COLORS[i % COLORS.length]));
  mesh.instanceColor.needsUpdate = true;

  // per-instance state
  const P = Array.from({ length: COUNT }, () => ({
    life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
    rx: 0, ry: 0, rz: 0, vrx: 0, vry: 0, vrz: 0,
  }));
  const dummy = new THREE.Object3D();
  const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < COUNT; i++) mesh.setMatrixAt(i, HIDDEN);
  mesh.instanceMatrix.needsUpdate = true;

  let cursor = 0;
  function burst(pos, amount = COUNT) {
    for (let n = 0; n < amount; n++) {
      const p = P[cursor];
      cursor = (cursor + 1) % COUNT;
      p.life = 2.6 + Math.random() * 1.2;
      p.x = pos.x + (Math.random() - 0.5) * 1.5;
      p.y = pos.y + 1.2;
      p.z = pos.z + (Math.random() - 0.5) * 1.5;
      const ang = Math.random() * Math.PI * 2;
      const spread = 3 + Math.random() * 6;
      p.vx = Math.cos(ang) * spread;
      p.vz = Math.sin(ang) * spread;
      p.vy = 7 + Math.random() * 7;
      p.rx = Math.random() * 6.28; p.ry = Math.random() * 6.28; p.rz = Math.random() * 6.28;
      p.vrx = (Math.random() - 0.5) * 12;
      p.vry = (Math.random() - 0.5) * 12;
      p.vrz = (Math.random() - 0.5) * 12;
    }
  }

  function update(dt) {
    let any = false;
    for (let i = 0; i < COUNT; i++) {
      const p = P[i];
      if (p.life <= 0) continue;
      any = true;
      p.life -= dt;
      p.vy -= 16 * dt;          // gravity
      p.vx *= 0.98; p.vz *= 0.98;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rx += p.vrx * dt; p.ry += p.vry * dt; p.rz += p.vrz * dt;
      if (p.life <= 0 || p.y < 0) { mesh.setMatrixAt(i, HIDDEN); continue; }
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rx, p.ry, p.rz);
      const s = Math.min(1, p.life);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    if (any) mesh.instanceMatrix.needsUpdate = true;
  }

  return { burst, update };
}
