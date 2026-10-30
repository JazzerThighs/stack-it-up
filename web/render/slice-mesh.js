// Clip a triangle mesh at an actual layer boundary, closing the exposed cut.
// Vertices have position, normal, RGB (9 floats). Built once per drag/turn.
const EPS=1e-5;
const key=v=>v.node ?? v.slice(0,3).map(x=>Math.round(x/EPS)).join(',');
export function clipMesh(mesh,axis,plane,side) {
  const out=[], segments=[];
  for(let i=0;i<mesh.length;i+=27) {
    const tri=[Array.from(mesh.slice(i,i+9)),Array.from(mesh.slice(i+9,i+18)),Array.from(mesh.slice(i+18,i+27))];
    const polygon=[],cuts=[];
    for(let j=0;j<3;j++) {
      const a=tri[j],b=tri[(j+1)%3], da=side*(a[axis]-plane),db=side*(b[axis]-plane);
      if(da>=0) polygon.push(a);
      if((da>=0)!==(db>=0)) {
        const t=da/(da-db),v=a.map((x,k)=>x+(b[k]-x)*t);v[axis]=plane;
        polygon.push(v);cuts.push(v);
      }
    }
    for(let j=1;j+1<polygon.length;j++) out.push(...polygon[0],...polygon[j],...polygon[j+1]);
    if(cuts.length===2 && key(cuts[0])!==key(cuts[1])) segments.push(cuts);
  }
  // Join intersection edges into loops, separately for disconnected cross-sections.
  const buckets=new Map();let nextNode=0;
  for(const edge of segments) for(const v of edge) {
    const cell=v.slice(0,3).map(x=>Math.floor(x/EPS));let match;
    for(let x=-1;x<=1&&!match;x++) for(let y=-1;y<=1&&!match;y++) for(let z=-1;z<=1&&!match;z++) {
      const nearby=buckets.get([cell[0]+x,cell[1]+y,cell[2]+z].join(',')) || [];
      match=nearby.find(p=>p.slice(0,3).every((n,k)=>Math.abs(n-v[k])<EPS));
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
  return new Float32Array(out);
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
    for(const v of normal>0?[p,q,r]:[r,q,p]) {const n=[0,0,0];n[axis]=normal;out.push(...v.slice(0,3),...n,...v.slice(6,9));}
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
