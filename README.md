# DRIVE — 走

Explore a low-poly island in a little car. Race the clock through a circuit of
glowing gates, hit the nitro for a boost, scatter crates, and collect all the
coins — a physics-driven 3D playground in the browser.

**Live:** https://drive.1qaz.jp

![DRIVE](docs/01-hero.png)

---

## Controls

- **W A S D** / **arrow keys** — drive & steer
- **Space** — 🔥 nitro boost (refillable gauge)
- **S** — brake / reverse
- **R** — flip the car back / reset to spawn
- On touch devices, on-screen buttons appear automatically (including nitro).

## Things to do

- **Time attack** — drive through the glowing gates in order (a beacon marks the
  next one). Cross the start gate to begin the clock and again to finish a lap;
  your best lap is saved locally.
- **Nitro** — hold Space for a burst of speed (≈60 → ≈95 km/h) with exhaust
  flames. The gauge drains as you boost and refills when you don't.
- **Collect 26 coins** scattered across the island for an all-clear celebration.
- **Make a mess** — ramps to launch off, a stack of knockable crates, trees and
  rocks to weave between.

| Drifting the island | Nitro 🔥 |
|---|---|
| ![world](docs/02-world.png) | ![nitro](docs/03-nitro.png) |

## How it works

- **[Three.js](https://threejs.org/)** renders the scene; every object's mesh is
  driven each frame from its **[Rapier](https://rapier.rs/)** rigid body.
- The car is a single dynamic chassis collider plus a ray-cast
  **vehicle controller** (rear-wheel drive, front-wheel steering, suspension),
  with a low centre of mass and a top-speed cap so it's quick to control and
  hard to flip. Nitro raises the cap and multiplies the engine force.
- Gates are pure-visual arches; a lap is tracked by driving through them in
  order. Coins are simple distance checks. Celebrations fire an instanced
  confetti burst.

## Tech stack

- [Three.js](https://threejs.org/) `0.184` — rendering, shadows, gradient sky
- [@dimforge/rapier3d](https://rapier.rs/) — WASM physics (vehicle, colliders)
- [Vite](https://vitejs.dev/) build — static output, no backend

## Project structure

```
index.html      # canvas + HUD (coins, speed, lap timer, nitro, touch controls)
src/
  main.js       # renderer, Rapier init, chase camera, coins, race + fx wiring
  world.js      # the island: ground, walls, ramps, crates, decor, coins, gates
  car.js        # vehicle controller + low-poly car + nitro + input → forces
  race.js       # time-attack: gate order, lap timer, best-time persistence
  fx.js         # instanced confetti burst
  style.css     # HUD / loading / nitro gauge / touch controls
```

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/
```

---

Built by [masafy](https://github.com/masafykun), alongside the WebGL series
[INK](https://github.com/masafykun/ink),
[VOYAGE](https://github.com/masafykun/voyage),
[ORB](https://github.com/masafykun/kodou-orb) and
[FLUX](https://github.com/masafykun/yuragi-flux).
