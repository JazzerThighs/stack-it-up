// Shared native surfaces and retained colored pieces. Fragments can key their
// cache by these stable arrays, independent of the current packing or piece ID.
import {rgb, box, xyz} from './geometry.js';
const cache=new Map(),colored=new Map();
let coloredBytes=0;
export function compositeParts(board,ids,palette,generate,appearance='jelly') {
  const groups=new Map();
  for(let i=0;i<27;i++)if(board[i]) {
    const key=ids[i]+':'+board[i],g=groups.get(key)||{mask:0,color:board[i]};
    g.mask|=1<<i;groups.set(key,g);
  }
  return [...groups.values()].map(({mask,color})=>{
    const hex=palette[color],key=mask+':'+hex+':'+(appearance==='voxel');
    if(colored.has(key))return colored.get(key);
    const out=[],c=rgb(hex);
    if(appearance==='voxel') {
      for(let i=0;i<27;i++)if(mask&(1<<i))box(out,xyz(i),.485,c);
    } else {
      if(!cache.has(mask)) {
        if(cache.size>=192)cache.delete(cache.keys().next().value);
        cache.set(mask,generate(mask));
      }
      const mesh=cache.get(mask);
      for(let i=0;i<mesh.length;i+=9)out.push(...mesh.subarray(i,i+6),...c);
    }
    const mesh=new Float32Array(out);
    while(coloredBytes+mesh.byteLength>16*1024*1024 && colored.size) {
      const first=colored.keys().next().value;coloredBytes-=colored.get(first).byteLength;colored.delete(first);
    }
    colored.set(key,mesh);coloredBytes+=mesh.byteLength;return mesh;
  });
}
export function compositeMesh(board,ids,palette,generate,appearance='jelly') {
  const parts=compositeParts(board,ids,palette,generate,appearance);
  const result=new Float32Array(parts.reduce((n,m)=>n+m.length,0));let offset=0;
  for(const part of parts){result.set(part,offset);offset+=part.length;}return result;
}
