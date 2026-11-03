import {vertexCoverage,withCoverage} from './transparency.js';
// Object-space voxels, shared by all playfield packets (including line guides).
// Scan closed meshes into solid cells, then emit only the exposed cube faces.
// Sixteen voxels per cubie preserves spheres, bevels and identity solids.
export const VOXEL_SIZE=1/16;
const cache=new WeakMap();
export function voxelMesh(source,lines=false) {
  if(!source?.length)return new Float32Array();
  const previous=cache.get(source);
  if(previous?.lines===lines)return previous.mesh;
  const step=VOXEL_SIZE, cells=new Map(),key=(x,y,z)=>`${x},${y},${z}`;
  const put=(x,y,z,color,anchor)=>cells.set(key(x,y,z),{p:[x,y,z],color,anchor});
  if(lines) {
    for(let i=0;i<source.length;i+=18) {
      const a=Array.from(source.slice(i,i+3)),b=Array.from(source.slice(i+9,i+12));
      const count=Math.max(1,Math.ceil(Math.hypot(...b.map((v,j)=>v-a[j]))/step*2));
      for(let n=0;n<=count;n++)put(...a.map((v,j)=>Math.floor((v+(b[j]-v)*n/count)/step)),source.slice(i+6,i+9),vertexCoverage(source,i));
    }
  } else {
    const rays=new Map();
    for(let i=0;i<source.length;i+=27) {
      const a=source.slice(i,i+3),b=source.slice(i+9,i+12),c=source.slice(i+18,i+21);
      const det=(b[1]-a[1])*(c[2]-a[2])-(c[1]-a[1])*(b[2]-a[2]);
      const color=source.slice(i+6,i+9),anchor=vertexCoverage(source,i);
      if(Math.abs(det)<1e-10)continue;
      const colorKey=Array.from(color).map(v=>Math.round(v*65535)).join(',');
      const minY=Math.ceil(Math.min(a[1],b[1],c[1])/step-.5),maxY=Math.floor(Math.max(a[1],b[1],c[1])/step-.5);
      const minZ=Math.ceil(Math.min(a[2],b[2],c[2])/step-.5),maxZ=Math.floor(Math.max(a[2],b[2],c[2])/step-.5);
      for(let y=minY;y<=maxY;y++)for(let z=minZ;z<=maxZ;z++) {
        // Tiny deterministic offset avoids double hits on triangle edges.
        const dy=(y+.500013)*step-a[1],dz=(z+.500027)*step-a[2];
        const u=(dy*(c[2]-a[2])-dz*(c[1]-a[1]))/det;
        const v=((b[1]-a[1])*dz-(b[2]-a[2])*dy)/det;
        if(u<0||v<0||u+v>1)continue;
        const k=`${y},${z}:${colorKey}:${anchor.join(",")}`;
        if(!rays.has(k))rays.set(k,{y,z,color,anchor,hits:[]});
        rays.get(k).hits.push(a[0]+u*(b[0]-a[0])+v*(c[0]-a[0]));
      }
    }
    for(const {y,z,color,anchor,hits} of rays.values()) {
      hits.sort((a,b)=>a-b);
      const unique=hits.filter((v,i)=>!i||v-hits[i-1]>1e-6);
      for(let i=0;i+1<unique.length;i+=2)
        for(let x=Math.ceil(unique[i]/step-.5);x<unique[i+1]/step-.5;x++)put(x,y,z,color,anchor);
      // Open surfaces (arrow heads and clipped outlines) still become voxels.
      if(unique.length%2)for(const x of unique)put(Math.floor(x/step),y,z,color,anchor);
    }
  }
  const out=[],coverage=[];
  for(const {p,color,anchor} of cells.values())for(let axis=0;axis<3;axis++)for(const side of [-1,1]) {
    const neighbor=p.slice();neighbor[axis]+=side;
    if(cells.has(key(...neighbor)))continue;
    const a=(axis+1)%3,b=(axis+2)%3,n=[0,0,0];n[axis]=side;
    const corners=[[0,0],[1,0],[1,1],[0,1]].map(([u,v])=>{
      const q=p.map(v=>v*step);q[axis]+=(side+1)*.5*step;q[a]+=u*step;q[b]+=v*step;return q;
    });
    for(const j of side===1?[0,1,2,0,2,3]:[0,2,1,0,3,2]){out.push(...corners[j],...n,...color);coverage.push(...anchor);}
  }
  const mesh=withCoverage(new Float32Array(out),new Float32Array(coverage));cache.set(source,{lines,mesh});return mesh;
}
