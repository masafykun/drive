// DRIVE — time-attack: drive through the gates in order to complete a lap.
// Gate 0 is START/FINISH; crossing it starts the clock, and crossing it again
// after all others completes the lap.
const GATE_RADIUS = 7;
const GATE_R2 = GATE_RADIUS * GATE_RADIUS;

export function createRace({ gates, hud, onFinish }) {
  let state = 'ready'; // 'ready' | 'running'
  let target = 0;      // index of the next gate to cross
  let startTime = 0;
  let best = parseFloat(localStorage.getItem('drive_best_lap')) || null;

  function refreshGates() {
    gates.forEach((g, i) => {
      if (i === target) g.setState('next');
      else if (state === 'running' && isPassed(i)) g.setState('done');
      else g.setState('idle');
    });
  }
  function isPassed(i) {
    // when running, gates with index < target (and gate 0 once started) are done
    if (state !== 'running') return false;
    if (i === 0) return true;     // start gate already crossed
    return i < target;
  }

  hud.setBest(best);
  hud.setProgress(0, gates.length);
  refreshGates();

  function update(carPos, elapsed) {
    const g = gates[target];
    const dx = carPos.x - g.position.x;
    const dz = carPos.z - g.position.z;
    const crossed = dx * dx + dz * dz < GATE_R2;

    if (crossed) {
      if (state === 'ready') {
        state = 'running';
        startTime = elapsed;
        target = 1;
        hud.setProgress(1, gates.length);
        refreshGates();
      } else if (target === 0) {
        // back at the start gate → lap complete
        const time = elapsed - startTime;
        const isBest = best === null || time < best;
        if (isBest) { best = time; localStorage.setItem('drive_best_lap', String(best)); hud.setBest(best); }
        onFinish(time, best, isBest);
        state = 'ready';
        target = 0;
        hud.setProgress(0, gates.length);
        hud.setTimer(null);
        refreshGates();
      } else {
        target = (target + 1) % gates.length;
        hud.setProgress(target === 0 ? gates.length - 1 : target, gates.length);
        refreshGates();
      }
    }

    if (state === 'running') hud.setTimer(elapsed - startTime);
    return target;
  }

  return { update, targetIndex: () => target, isRunning: () => state === 'running' };
}
