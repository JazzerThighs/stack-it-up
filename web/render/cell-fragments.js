import {withCoverage,vertexCoverage} from './transparency.js';
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
  return cells.map(joinMeshes);
}
export function joinMeshes(parts) {
  const result=new Float32Array(parts.reduce((n,p)=>n+p.length,0));
  const coverage=new Float32Array(result.length/3);let offset=0;
  for(const part of parts){
    result.set(part,offset);
    if(part.coverage)coverage.set(part.coverage,offset/3);
    else for(let i=0;i<part.length;i+=9)coverage.set(vertexCoverage(part,i),(offset+i)/3);
    offset+=part.length;
  }
  return withCoverage(result,coverage);
}

// Caps are the only triangles exactly on a cell boundary with its axis normal.
// Keep the cached closed solids intact; prepare visible-surface variants once.
const visibleVariants=new WeakMap();
export function exposedFragment(mesh,cell,separated) {
  let cached=visibleVariants.get(mesh);
  if(!cached || cached.cell!==cell) {
    const center=[Math.floor(cell/9)-1,Math.floor(cell/3)%3-1,cell%3-1];
    const caps=new Uint8Array(mesh.length/27);
    for(let i=0;i<mesh.length;i+=27)for(let axis=0;axis<3;axis++)for(const side of [-1,1]) {
      const plane=center[axis]+side*.5;
      if([0,9,18].every(v=>Math.abs(mesh[i+v+axis]-plane)<1e-6 &&
        [0,1,2].every(a=>Math.abs(mesh[i+v+3+a]-(a===axis?side:0))<1e-6)))caps[i/27]|=1<<(axis*2+(side>0?1:0));
    }
    cached={cell,caps,variants:new Map()};visibleVariants.set(mesh,cached);
  }
  let show=0;
  for(let axis=0;axis<3;axis++)for(const side of [-1,1])if(separated(axis,side))show|=1<<(axis*2+(side>0?1:0));
  if(cached.variants.has(show))return cached.variants.get(show);
  const keep=cached.caps.map(cap=>!(cap & ~show));
  const count=keep.reduce((sum,v)=>sum+v,0);
  if(count===keep.length){cached.variants.set(show,mesh);return mesh;}
  const out=new Float32Array(count*27),coverage=new Float32Array(count*9);let offset=0;
  for(let tri=0;tri<keep.length;tri++)if(keep[tri]) {
    out.set(mesh.subarray(tri*27,tri*27+27),offset);
    if(mesh.coverage)coverage.set(mesh.coverage.subarray(tri*9,tri*9+9),offset/3);
    else for(let j=0;j<27;j+=9)coverage.set(vertexCoverage(mesh,tri*27+j),(offset+j)/3);
    offset+=27;
  }
  const result=withCoverage(out,coverage);cached.variants.set(show,result);return result;
}
export function neighborCell(cell,axis,side) {
  const stride=[9,3,1][axis],coordinate=Math.floor(cell/stride)%3;
  return coordinate+side<0 || coordinate+side>2 ? -1 : cell+side*stride;
}
