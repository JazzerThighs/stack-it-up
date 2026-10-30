import {clipMesh} from './slice-mesh.js';
const cache=new Map();let bytes=0;
// Each cell gets a closed, static slice of the original curved surface. Create
// these while loading/settling a state, not in a pointer-move or animation frame.
export function cellFragments(mesh) {
  if(cache.has(mesh))return cache.get(mesh);
  const fragments=[];
  for(let x=0;x<3;x++) {
    const xpart=clipMesh(clipMesh(mesh,0,x-1.5,1),0,x-.5,-1);
    if(!xpart.length)continue;
    for(let y=0;y<3;y++) {
      const ypart=clipMesh(clipMesh(xpart,1,y-1.5,1),1,y-.5,-1);
      if(!ypart.length)continue;
      for(let z=0;z<3;z++) {
        const part=clipMesh(clipMesh(ypart,2,z-1.5,1),2,z-.5,-1);
        if(part.length)fragments.push({cell:x*9+y*3+z,mesh:part});
      }
    }
  }
  const size=fragments.reduce((n,f)=>n+f.mesh.byteLength,0);
  while(bytes+size>24*1024*1024 && cache.size) {
    const first=cache.keys().next().value;
    bytes-=cache.get(first).reduce((n,f)=>n+f.mesh.byteLength,0);cache.delete(first);
  }
  cache.set(mesh,fragments);bytes+=size;return fragments;
}
export function mergeFragments(meshes) {
  const cells=Array.from({length:27},()=>[]);
  for(const mesh of meshes)for(const fragment of cellFragments(mesh))cells[fragment.cell].push(fragment.mesh);
  return cells.map(parts=>{
    const result=new Float32Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;
    for(const part of parts){result.set(part,offset);offset+=part.length;}return result;
  });
}
export function joinMeshes(parts) {
  const result=new Float32Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;
  for(const part of parts){result.set(part,offset);offset+=part.length;}return result;
}

// Caps are the only triangles exactly on a cell boundary with its axis normal.
// Keep the cached closed solids intact; prepare visible-surface variants once.
export function exposedFragment(mesh,cell,separated) {
  const center=[Math.floor(cell/9)-1,Math.floor(cell/3)%3-1,cell%3-1],out=[];
  for(let i=0;i<mesh.length;i+=27) {
    let hidden=false;
    for(let axis=0;axis<3&&!hidden;axis++)for(const side of [-1,1]) {
      const plane=center[axis]+side*.5;
      const cap=[0,9,18].every(v=>Math.abs(mesh[i+v+axis]-plane)<1e-6 &&
        [0,1,2].every(a=>Math.abs(mesh[i+v+3+a]-(a===axis?side:0))<1e-6));
      if(cap && !separated(axis,side))hidden=true;
    }
    if(!hidden)for(let j=i;j<i+27;j++)out.push(mesh[j]);
  }
  return new Float32Array(out);
}
export function neighborCell(cell,axis,side) {
  const stride=[9,3,1][axis],coordinate=Math.floor(cell/stride)%3;
  return coordinate+side<0 || coordinate+side>2 ? -1 : cell+side*stride;
}
