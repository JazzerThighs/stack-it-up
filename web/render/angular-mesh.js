// Exact planar CSG of beveled rectangular runs. No marching grid or smooth normals.
import {xyz} from './geometry.js';
import {visualSettings} from './visual-settings.js';
const EPS=1e-7;
const dot=(a,b)=>a.reduce((n,v,k)=>n+v*b[k],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);};
function clip(poly,plane,inside=true) {
  const out=[],sign=inside?1:-1;
  for(let i=0;i<poly.length;i++) {
    const a=poly[i],b=poly[(i+1)%poly.length],da=sign*(dot(plane.n,a)-plane.d),db=sign*(dot(plane.n,b)-plane.d);
    if(da<=EPS)out.push(a);
    if((da< -EPS&&db>EPS)||(da>EPS&&db< -EPS))out.push(a.map((v,k)=>v+(b[k]-v)*da/(da-db)));
  }
  return out;
}
function subtract(poly,planes){
  let rest=poly;const out=[];
  for(const plane of planes){
    if(rest.length<3)break;
    const distances=rest.map(p=>dot(plane.n,p)-plane.d);
    if(distances.every(d=>d<=EPS))continue;
    if(distances.every(d=>d>=-EPS)){out.push(rest);return out;}
    const outside=clip(rest,plane,false);if(outside.length>=3)out.push(outside);
    rest=clip(rest,plane,true);
  }
  return out;
}
export function angularPiece(mask,color=[1,1,1]) {
  const cells=Array.from({length:27},(_,i)=>i).filter(i=>mask&(1<<i));
  const runs=[];
  for(const a of cells)for(const b of cells){
    const lo=xyz(a),hi=xyz(b);if(lo.some((v,k)=>v>hi[k]))continue;
    let valid=true;
    for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++)
      if(!(mask&(1<<((x+1)*9+(y+1)*3+z+1))))valid=false;
    if(valid)runs.push({lo,hi});
  }
  const maximal=runs.filter(r=>!runs.some(s=>s!==r&&r.lo.every((v,k)=>s.lo[k]<=v&&s.hi[k]>=r.hi[k])));
  let volumes=maximal.map(({lo,hi})=>({center:lo.map((v,k)=>(v+hi[k])/2),half:lo.map((v,k)=>(hi[k]-v+1)/2-.045)}));
  if(visualSettings.jellyCornerO && cells.length===4) {
    const lo=[0,1,2].map(k=>Math.min(...cells.map(i=>xyz(i)[k]))),hi=[0,1,2].map(k=>Math.max(...cells.map(i=>xyz(i)[k])));
    const span=lo.map((v,k)=>hi[k]-v),axis=span.indexOf(0);
    if(axis>=0 && span.filter(v=>v===1).length===2) {
      const a=(axis+1)%3,b=(axis+2)%3,mid=lo.map((v,k)=>(v+hi[k])/2),hole=visualSettings.jellyOpening/100,outer=.93;
      volumes=[];
      for(const direction of [a,b])for(const side of [-1,1]) {
        const center=mid.slice(),half=[.43,.43,.43];
        center[direction]+=side*(outer+hole)/2;
        half[direction]=(outer-hole)/2;half[direction===a?b:a]=outer;
        volumes.push({center,half});
      }
    }
  }
  const solids=volumes.map(({center,half})=>{
    const bevel=Math.min(visualSettings.jellyBevel/100,Math.min(...half)*.9),planes=[];
    for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
      const raw=[x,y,z],count=raw.filter(Boolean).length;if(!count)continue;
      const length=Math.hypot(...raw),n=raw.map(v=>v/length);
      planes.push({n,d:dot(n,center)+(dot(raw.map(Math.abs),half)-(count-1)*bevel)/length});
    }
    return planes;
  });
  const out=[];
  solids.forEach((planes,index)=>planes.forEach(plane=>{
    const u=unit(cross(plane.n,Math.abs(plane.n[0])<.8?[1,0,0]:[0,1,0])),v=cross(plane.n,u),center=plane.n.map(n=>n*plane.d);
    let poly=[[-6,-6],[6,-6],[6,6],[-6,6]].map(([a,b])=>center.map((c,k)=>c+a*u[k]+b*v[k]));
    for(const bound of planes)poly=clip(poly,bound);
    let parts=poly.length>=3?[poly]:[];
    solids.forEach((other,j)=>{
      if(j===index)return;
      // Coincident outward faces belong to one solid, never zero or two.
      if(index<j&&other.some(p=>Math.abs(p.d-plane.d)<EPS&&p.n.every((n,k)=>Math.abs(n-plane.n[k])<EPS)))return;
      parts=parts.flatMap(p=>subtract(p,other));
    });
    for(const p of parts)for(let i=1;i+1<p.length;i++){
      const a=p[0],b=p[i],c=p[i+1];
      if(Math.hypot(...cross(b.map((v,k)=>v-a[k]),c.map((v,k)=>v-a[k])))<EPS)continue;
      for(const vertex of [a,b,c])out.push(...vertex,...plane.n,...color);
    }
  }));
  return new Float32Array(out);
}
