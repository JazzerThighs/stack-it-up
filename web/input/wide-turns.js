import {CubeStack} from '../engine/coordinates.js';
import {turnTransform} from '../render/transforms.js';
import {quaternion, multiply, distance} from './orbit-math.js';

const inverse=q=>[-q[0],-q[1],-q[2],q[3]];

// The cube reports the single layer relative to its rotating core. Rotating
// that core by the inverse quarter turn moves the other TWO layers in space.
// A = whole(A) * wide(opposite A). Keep whole(A) in the device/view frame and
// send the wide command itself to the engine so its centers actually move.
export function wideFromFace(face) {
  const [,axis,layer]=CubeStack.moves[face%15];
  const opposite=CubeStack.moves.findIndex(([,a,l])=>a===axis && l===2-layer);
  return {move:9+opposite+(face>=15?15:0),rotation:quaternion(turnTransform(face,1))};
}

// Endpoint guidance is only used for the visual return following a slice.
export function sliceReturnAligned(face,start,end,toleranceDegrees=20) {
  const expected=inverse(wideFromFace(face).rotation);
  const actual=multiply(inverse(start),end);
  // Quaternion distance checks both axis and direction, allowing hand wobble.
  return distance(actual,expected)<=toleranceDegrees*Math.PI/180 + 1e-12;
}
