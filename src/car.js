// DRIVE — the player car: a Rapier ray-cast vehicle controller plus a low-poly
// body. Rear-wheel drive, front-wheel steering, with a chase-friendly chassis.
import * as THREE from 'three';

const ENGINE_FORCE = 26;
const REVERSE_FORCE = 20;
const BRAKE_FORCE = 11;
const COAST_BRAKE = 0;          // no auto-brake — coasting must not pitch the car
const MAX_SPEED = 13;           // m/s top-speed cap (~47 km/h)
const MAX_SPEED_2 = 11 * 11; // squared top speed for cheap comparison
const MAX_STEER = 0.5;
const STEER_LERP = 0.16;

const HX = 0.9, HY = 0.32, HZ = 1.5;       // chassis half-extents
const WHEEL_R = 0.42;
const REST_LEN = 0.28;

export function createCar({ RAPIER, world, scene, spawn }) {
  // spawn facing -Z (180° about Y) so "forward" points into the island
  const spawnRot = { x: 0, y: 1, z: 0, w: 0 };

  // ---- physics chassis ----
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spawn.x, spawn.y, spawn.z)
      .setRotation(spawnRot)
      .setLinearDamping(0.35)
      .setAngularDamping(0.7)
      .setCanSleep(false),
  );
  // Collider sits low to bias the centre of mass under the car (anti-flip)
  // without the additional-mass API, which destabilised the vehicle controller.
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(HX, HY, HZ).setTranslation(0, -0.22, 0).setDensity(1.3).setFriction(0.7),
    body,
  );

  const controller = world.createVehicleController(body);
  // Rapier defaults to up-axis = Y(1), forward-axis = Z(2), which matches our
  // wheel layout. (indexForwardAxis is getter-only, so we don't assign it.)

  const wheelPos = [
    { x: -HX, y: -0.12, z: HZ - 0.35 },   // 0 front-left
    { x: HX, y: -0.12, z: HZ - 0.35 },    // 1 front-right
    { x: -HX, y: -0.12, z: -(HZ - 0.35) }, // 2 rear-left
    { x: HX, y: -0.12, z: -(HZ - 0.35) },  // 3 rear-right
  ];
  const down = { x: 0, y: -1, z: 0 };
  const axle = { x: -1, y: 0, z: 0 };
  for (const p of wheelPos) {
    controller.addWheel(p, down, axle, REST_LEN, WHEEL_R);
  }
  for (let i = 0; i < 4; i++) {
    controller.setWheelSuspensionStiffness(i, 17);
    controller.setWheelSuspensionCompression(i, 0.7);
    controller.setWheelSuspensionRelaxation(i, 0.85);
    controller.setWheelMaxSuspensionTravel(i, 0.3);
    controller.setWheelFrictionSlip(i, 2.0);
    controller.setWheelSideFrictionStiffness(i, 0.5);
  }

  // ---- visual car ----
  const group = new THREE.Group();
  scene.add(group);

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff5a52, flatShading: true, roughness: 0.5, metalness: 0.1 });
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x2a3550, flatShading: true, roughness: 0.3, metalness: 0.2 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.6 });

  const chassisMesh = new THREE.Mesh(new THREE.BoxGeometry(HX * 2, HY * 2, HZ * 2), bodyMat);
  chassisMesh.castShadow = true; chassisMesh.receiveShadow = true;
  group.add(chassisMesh);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(HX * 1.7, HY * 1.7, HZ * 1.0), cabinMat);
  cabin.position.set(0, HY * 1.7, -0.1);
  cabin.castShadow = true;
  group.add(cabin);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(HX * 2, HY * 1.2, 0.3), trimMat);
  nose.position.set(0, -0.05, HZ);
  group.add(nose);

  // wheels: geometry pre-rotated so the axle is along X; pivots allow steering
  const wheelGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.34, 18);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1c1c22, flatShading: true, roughness: 0.8 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xd8d8e0, roughness: 0.4, metalness: 0.3 });
  const wheels = wheelPos.map((p, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(p.x, p.y - REST_LEN, p.z);
    const mesh = new THREE.Mesh(wheelGeo, wheelMat);
    mesh.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.36, 8), hubMat);
    hub.rotation.z = Math.PI / 2;
    mesh.add(hub);
    pivot.add(mesh);
    group.add(pivot);
    return { pivot, mesh, front: i < 2 };
  });

  let steer = 0;
  let spin = 0;

  function update(dt, input) {
    // horizontal speed² from the chassis velocity (currentVehicleSpeed is flaky)
    const v = body.linvel();
    const sp2 = v.x * v.x + v.z * v.z;
    let engine = 0;
    if (input.forward && sp2 < MAX_SPEED_2) engine = ENGINE_FORCE;
    else if (input.back && sp2 < MAX_SPEED_2 * 0.5) engine = -REVERSE_FORCE;
    controller.setWheelEngineForce(2, engine);
    controller.setWheelEngineForce(3, engine);

    const target = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    steer += (target * MAX_STEER - steer) * STEER_LERP;
    controller.setWheelSteering(0, steer);
    controller.setWheelSteering(1, steer);

    const brake = input.brake ? BRAKE_FORCE : engine === 0 ? COAST_BRAKE : 0;
    for (let i = 0; i < 4; i++) controller.setWheelBrake(i, brake);

    controller.updateVehicle(dt);
  }

  // call after world.step() to sync meshes to physics
  function sync(dt) {
    const t = body.translation();
    const r = body.rotation();
    group.position.set(t.x, t.y, t.z);
    group.quaternion.set(r.x, r.y, r.z, r.w);

    // signed forward speed = chassis velocity projected on the car's forward (+Z)
    const v = body.linvel();
    const fx = 2 * (r.x * r.z + r.w * r.y);
    const fz = 1 - 2 * (r.x * r.x + r.y * r.y);
    const fwdSpeed = v.x * fx + v.z * fz;
    spin += (fwdSpeed * dt) / WHEEL_R;
    for (const w of wheels) {
      if (w.front) w.pivot.rotation.y = steer;
      w.mesh.rotation.x = spin;
    }
  }

  function reset() {
    body.setTranslation(spawn, true);
    body.setRotation(spawnRot, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  return {
    group, body, update, sync, reset,
    speed: () => { const v = body.linvel(); return Math.hypot(v.x, v.z); },
  };
}
