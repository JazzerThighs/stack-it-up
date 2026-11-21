import {distance, multiply, slerp, cubeRotations, quaternion} from './orbit-math.js';

const identity = () => [0,0,0,1];
const inverse = q => [-q[0],-q[1],-q[2],q[3]];
const rad = Math.PI / 180;

// Presentation-only alignment. Raw sensor samples still drive gesture recognition.
export function createGyroNeutral({tolerance = () => 10, delay = () => 125, speed = () => 2.5, cutoff = () => 6} = {}) {
  let targets = [], targetIndex = -1, offset = identity(), previous, previousTime, settled = 0;
  const pause = () => { previous = previousTime = undefined; settled = 0; targetIndex = -1; };
  return {
    reset(pose) {
      // Right multiplication changes which cube faces occupy the saved grip;
      // the camera-relative natural holding angle stays the same.
      targets = pose ? cubeRotations.map(rotation => multiply(pose, quaternion(rotation))) : [];
      offset = identity(); pause();
    },
    pause,
    apply(pose, sensor, time) {
      let displayed = multiply(offset, pose);
      const dt = previousTime === undefined ? 0 : (time - previousTime) / 1000;
      const velocity = previous && dt > 0 ? distance(previous, sensor) / dt : Infinity;
      previous = sensor; previousTime = time;
      // Measure in the displayed frame after discrete slice/wide corrections and
      // accumulated alignment. All 24 face arrangements share the neutral grip.
      let nearest = -1, error = Infinity;
      for (let i = 0; i < targets.length; i++) {
        const angle = distance(displayed, targets[i]);
        if (angle < error) { error = angle; nearest = i; }
      }
      if (nearest !== targetIndex) { settled = 0; targetIndex = nearest; }
      const neutral = targets[nearest];
      const zone = Number(tolerance()) * rad;
      if (!neutral || !(zone > 0) || dt <= 0 || dt > .25 ||
          velocity > Number(cutoff()) * rad || error > zone) {
        settled = 0;
        return displayed;
      }
      const before = settled;
      settled += dt;
      const correctionTime = Math.max(0, settled - Math.max(before, Number(delay()) / 1000));
      if (correctionTime > 0) {
        // Scale both convergence and the angular speed cap so the entire
        // correction accelerates together, including its final approach.
        const elapsed = correctionTime * Number(speed());
        const fraction = Math.min(1 - Math.exp(-elapsed / .45),
          8 * rad * elapsed / Math.max(error, 1e-10));
        displayed = slerp(displayed, neutral, fraction);
        offset = multiply(displayed, inverse(pose));
      }
      return displayed;
    },
    orient(pose) { return multiply(offset, pose); },
  };
}
