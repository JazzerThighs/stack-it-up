import {withCoverage,vertexCoverage} from './transparency.js';
// Clip a triangle mesh at an actual layer boundary, closing the exposed cut.
// Vertices have position, normal, RGB (9 floats). Built once per drag/turn.
const EPS=1e-5;
const key=v=>v.node ?? v.slice(0,3).map(x=>Math.round(x/EPS)).join(',');
// Write geometry and ownership together, without an interleaved JS-array copy.
class ClipOutput {
  constructor(capacity){this.geometry=new Float32Array(capacity);this.coverage=new Float32Array(capacity/3);this.length=0;}
  reserve(count){
    if(this.length+count<=this.geometry.length)return;
    const capacity=Math.max(this.length+count,this.geometry.length*2,27);
    const geometry=new Float32Array(capacity),coverage=new Float32Array(capacity/3);
    geometry.set(this.geometry);coverage.set(this.coverage);this.geometry=geometry;this.coverage=coverage;
  }
  triangle(mesh,start){
    this.reserve(27);const offset=this.length;
    for(let k=0;k<27;k++)this.geometry[offset+k]=mesh[start+k];
    if(mesh.coverage)for(let k=0;k<9;k++)this.coverage[offset/3+k]=mesh.coverage[start/3+k];
    else for(let v=0;v<27;v+=9)for(let a=0;a<3;a++)
      this.coverage[(offset+v)/3+a]=Math.floor(mesh[start+v+a]-mesh[start+v+3+a]*.002+.5);
    this.length+=27;
  }
  vertex(v,axis=-1,normal=0){
    this.reserve(9);const offset=this.length;
    for(let k=0;k<9;k++)this.geometry[offset+k]=k>=3&&k<6&&axis>=0?(k===axis+3?normal:0):v[k];
    for(let k=0;k<3;k++)this.coverage[offset/3+k]=v[9+k];
    this.length+=9;
  }
  finish(){return withCoverage(this.geometry.slice(0,this.length),this.coverage.slice(0,this.length/3));}
}
export function clipMesh(mesh,axis,plane,side) {
  let low=Infinity,high=-Infinity;
  for(let i=axis;i<mesh.length;i+=9){low=Math.min(low,mesh[i]);high=Math.max(high,mesh[i]);}
  if(side>0 ? low>=plane : high<=plane)return mesh;
  if(side>0 ? high<=plane : low>=plane)return new Float32Array(0);
  const out=new ClipOutput(mesh.length), segments=[];
  for(let i=0;i<mesh.length;i+=27) {
    const a=side*(mesh[i+axis]-plane)>=0,b=side*(mesh[i+9+axis]-plane)>=0,c=side*(mesh[i+18+axis]-plane)>=0;
    if(a&&b&&c){out.triangle(mesh,i);continue;}
    if(!a&&!b&&!c)continue;
    const tri=[[...mesh.slice(i,i+9),...vertexCoverage(mesh,i)],[...mesh.slice(i+9,i+18),...vertexCoverage(mesh,i+9)],[...mesh.slice(i+18,i+27),...vertexCoverage(mesh,i+18)]];
    const polygon=[],cuts=[];
    for(let j=0;j<3;j++) {
      const a=tri[j],b=tri[(j+1)%3], da=side*(a[axis]-plane),db=side*(b[axis]-plane);
      if(da>=0) polygon.push(a);
      if((da>=0)!==(db>=0)) {
        const t=da/(da-db),v=a.map((x,k)=>x+(b[k]-x)*t);v[axis]=plane;
        polygon.push(v);cuts.push(v);
      }
    }
    for(let j=1;j+1<polygon.length;j++){out.vertex(polygon[0]);out.vertex(polygon[j]);out.vertex(polygon[j+1]);}
    if(cuts.length===2 && key(cuts[0])!==key(cuts[1])) segments.push(cuts);
  }
  // Join intersection edges into loops, separately for disconnected cross-sections.
  const buckets=new Map();let nextNode=0;
  for(const edge of segments) for(const v of edge) {
    const cell=v.slice(0,3).map(x=>Math.floor(x/EPS));let match;
    for(let x=-1;x<=1&&!match;x++) for(let y=-1;y<=1&&!match;y++) for(let z=-1;z<=1&&!match;z++) {
      const nearby=buckets.get([cell[0]+x,cell[1]+y,cell[2]+z].join(',')) || [];
      match=nearby.find(p=>Math.abs(p[0]-v[0])<EPS&&Math.abs(p[1]-v[1])<EPS&&Math.abs(p[2]-v[2])<EPS);
    }
    if(match) v.node=match.node;
    else {
      v.node=nextNode++;const id=cell.join(',');
      if(!buckets.has(id))buckets.set(id,[]);buckets.get(id).push(v);
    }
  }
  const adjacency=new Map();
  segments.forEach((edge,id)=>edge.forEach(v=>{const k=key(v);if(!adjacency.has(k))adjacency.set(k,[]);adjacency.get(k).push(id);}));
  const used=new Set();
  for(let first=0;first<segments.length;first++) {
    if(used.has(first)) continue;
    const loop=[segments[first][0]], start=key(loop[0]);
    let current=segments[first][1];used.add(first);
    while(key(current)!==start) {
      loop.push(current);
      const next=adjacency.get(key(current))?.find(id=>!used.has(id));
      if(next===undefined) break;
      used.add(next);const edge=segments[next];current=key(edge[0])===key(current)?edge[1]:edge[0];
    }
    if(key(current)===start) cap(out,loop,axis,-side);
  }
  return out.finish();
}
function cap(out,loop,axis,normal) {
  const a=(axis+1)%3,b=(axis+2)%3;
  const cross=(p,q,r)=>(q[a]-p[a])*(r[b]-p[b])-(q[b]-p[b])*(r[a]-p[a]);
  // Remove collinear vertices before ear clipping (cuts can be concave).
  let changed=true;
  while(changed && loop.length>3) {
    changed=false;
    for(let i=0;i<loop.length;i++) if(Math.abs(cross(loop[(i+loop.length-1)%loop.length],loop[i],loop[(i+1)%loop.length]))<1e-10) {loop.splice(i,1);changed=true;break;}
  }
  const area=loop.reduce((sum,p,i)=>{const q=loop[(i+1)%loop.length];return sum+p[a]*q[b]-q[a]*p[b];},0);
  if(area<0) loop.reverse();
  const emit=(p,q,r)=>{
    for(const v of normal>0?[p,q,r]:[r,q,p])out.vertex(v,axis,normal);
  };
  while(loop.length>3) {
    let found=false;
    for(let i=0;i<loop.length;i++) {
      const p=loop[(i+loop.length-1)%loop.length],q=loop[i],r=loop[(i+1)%loop.length];
      if(cross(p,q,r)<=1e-10) continue;
      if(loop.some(v=>v!==p&&v!==q&&v!==r&&cross(p,q,v)>=-1e-10&&cross(q,r,v)>=-1e-10&&cross(r,p,v)>=-1e-10))continue;
      emit(p,q,r);loop.splice(i,1);found=true;break;
    }
    if(!found) break;
  }
  if(loop.length===3)emit(...loop);
}
