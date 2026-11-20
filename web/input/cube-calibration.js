import {cubeRotations, quaternion} from './orbit-math.js';

const normals = {U:[0,1,0], D:[0,-1,0], F:[0,0,-1], B:[0,0,1], R:[-1,0,0], L:[1,0,0]};
const opposite = {U:'D',D:'U',F:'B',B:'F',R:'L',L:'R'};
const transform = (m,v) => [0,1,2].map(i => m[i]*v[0]+m[i+3]*v[1]+m[i+6]*v[2]);

// A proper cube rotation maps logical face normals into the device's frame.
export function calibrationFrame(faces) {
  const frame = cubeRotations.find(m => ['U','F','R'].every(face =>
    normals[faces[face]]?.every((v,i) => v === transform(m,normals[face])[i])));
  if (!frame) return null;
  const mapping = {};
  for (const face of ['U','F','R']) {
    mapping[faces[face]] = face;
    mapping[opposite[faces[face]]] = opposite[face];
  }
  return {mapping, rotation:quaternion(frame)};
}
