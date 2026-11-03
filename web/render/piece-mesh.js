import {placedTetracubeColor} from './tetracube-colors.js';
import {tagCoverage} from './transparency.js';
import {joinMeshes} from './cell-fragments.js';
// Shared native surfaces and retained colored pieces. Fragments can key their
// cache by these stable arrays, independent of the current packing or piece ID.
import {rgb, box, xyz} from './geometry.js';
const cache=new Map(),colored=new Map();
let coloredBytes=0;
export function compositeParts(board,ids,palette,generate,appearance='jelly',spatialColors=false) {
  const groups=new Map();
  for(let i=0;i<27;i++)if(board[i]) {
    const key=ids[i]+':'+board[i],g=groups.get(key)||{mask:0,color:board[i]};
    g.mask|=1<<i;groups.set(key,g);
  }
  return [...groups.values()].map(({mask,color})=>{
    const hex=(spatialColors && placedTetracubeColor(mask)) || palette[color],key=mask+':'+hex+':'+(appearance==='voxel');
    if(colored.has(key))return colored.get(key);
    const out=[],c=rgb(hex);
    if(!cache.has(mask)) {
      if(cache.size>=192)cache.delete(cache.keys().next().value);
      cache.set(mask,generate(mask));
    }
    const source=cache.get(mask);
    for(let i=0;i<source.length;i+=9)out.push(...source.subarray(i,i+6),...c);
    const mesh=tagCoverage(new Float32Array(out),xyz(31-Math.clz32(mask&-mask)));
    while(coloredBytes+mesh.byteLength>16*1024*1024 && colored.size) {
      const first=colored.keys().next().value;coloredBytes-=colored.get(first).byteLength;colored.delete(first);
    }
    colored.set(key,mesh);coloredBytes+=mesh.byteLength;return mesh;
  });
}
export function compositeMesh(board,ids,palette,generate,appearance='jelly') {
  const parts=compositeParts(board,ids,palette,generate,appearance);
  return joinMeshes(parts);
}
