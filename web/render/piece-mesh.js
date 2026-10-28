// Shared native seamless surfaces for game transitions and packing composites.
import {rgb, box, xyz} from './geometry.js';
const cache = new Map();
export function compositeMesh(board, ids, palette, generate, appearance = "jelly") {
  if (appearance === "voxel") {
    const out = [];
    for (let i=0;i<27;i++) if (board[i]) box(out,xyz(i),.485,rgb(palette[board[i]]));
    return new Float32Array(out);
  }
  const groups = new Map(), out = [];
  for (let i=0;i<27;i++) if (board[i]) {
    const key=ids[i] + ':' + board[i];
    const g=groups.get(key) || {mask:0,color:board[i]}; g.mask |= 1<<i; groups.set(key,g);
  }
  for (const {mask,color} of groups.values()) {
    if (!cache.has(mask)) {
      if (cache.size>=192) cache.delete(cache.keys().next().value);
      cache.set(mask,generate(mask));
    }
    const mesh=cache.get(mask), c=rgb(palette[color]);
    for (let i=0;i<mesh.length;i+=9) out.push(...mesh.subarray(i,i+6),...c);
  }
  return new Float32Array(out);
}
