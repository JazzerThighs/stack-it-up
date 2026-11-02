import {visualSettings} from './visual-settings.js';
import {IDENTITY,transformPoint} from './transforms.js';
// Six durable identities: five Platonic solids and a sphere. Flat face normals
// keep the polyhedra legible under every material/filter.
import {sphere,rgb} from './geometry.js';
export const identityShapeNames=['Tetrahedron','Cube','Octahedron','Dodecahedron','Icosahedron','Sphere'];
const phi=(1+Math.sqrt(5))/2;
const tetra=[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]];
const cube=[],octa=[],ico=[],dodeca=[];
for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])cube.push([x,y,z]);
for(let axis=0;axis<3;axis++)for(const side of [-1,1]) {const p=[0,0,0];p[axis]=side;octa.push(p);}
dodeca.push(...cube);
for(const a of [-1,1])for(const b of [-1,1]) {
  ico.push([0,a,b*phi],[a,b*phi,0],[b*phi,0,a]);
  dodeca.push([0,a/phi,b*phi],[a/phi,b*phi,0],[b*phi,0,a/phi]);
}
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);};
// Supporting planes give exact polygon faces; triangulation happens only once.
function hull(vertices) {
  const faces=new Map(),eps=1e-7;
  for(let i=0;i<vertices.length;i++)for(let j=i+1;j<vertices.length;j++)for(let k=j+1;k<vertices.length;k++) {
    let n=cross(sub(vertices[j],vertices[i]),sub(vertices[k],vertices[i]));
    if(Math.hypot(...n)<eps)continue;n=unit(n);
    let d=dot(n,vertices[i]);
    const distances=vertices.map(v=>dot(n,v)-d);
    if(distances.some(v=>v>eps)&&distances.some(v=>v< -eps))continue;
    if(d<0){n=n.map(v=>-v);d=-d;}
    const ids=vertices.map((v,id)=>Math.abs(dot(n,v)-d)<eps?id:-1).filter(id=>id>=0);
    faces.set(ids.join(','),{ids,n});
  }
  const scale=Math.max(...vertices.flat().map(Math.abs)),out=[];
  for(const {ids,n} of faces.values()) {
    const center=[0,1,2].map(a=>ids.reduce((sum,i)=>sum+vertices[i][a],0)/ids.length);
    const u=unit(sub(vertices[ids[0]],center)),v=cross(n,u);
    ids.sort((a,b)=>{
      const p=sub(vertices[a],center),q=sub(vertices[b],center);
      return Math.atan2(dot(p,v),dot(p,u))-Math.atan2(dot(q,v),dot(q,u));
    });
    for(let i=1;i<ids.length-1;i++)for(const id of [ids[0],ids[i],ids[i+1]])out.push(...vertices[id].map(x=>x/scale),...n);
  }
  return new Float32Array(out);
}
const meshes=[tetra,cube,octa,dodeca,ico].map(hull);
export function identitySolid(out,p,h,color,id,rotation=IDENTITY) {
  const start=out.length;
  // Extra released fragment groups must not wrap back to an existing solid.
  // Beyond the six standard identities, use distinct polygonal bipyramids.
  if(id>=6) {
    const sides=id===6?3:id-2; // Skip the four-sided bipyramid (the existing octahedron).
    for(let i=0;i<sides;i++)for(const sign of [-1,1]) {
      const a=i*2*Math.PI/sides,b=(i+1)*2*Math.PI/sides;
      const points=sign>0?[[0,1,0],[Math.cos(a),0,Math.sin(a)],[Math.cos(b),0,Math.sin(b)]]:
        [[0,-1,0],[Math.cos(b),0,Math.sin(b)],[Math.cos(a),0,Math.sin(a)]];
      // Winding and normals agree with the existing convex meshes.
      const [p0,p1,p2]=points,u=p1.map((v,k)=>v-p0[k]),v=p2.map((v,k)=>v-p0[k]);
      let normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
      if(normal[1]*sign<0){points.reverse();normal=normal.map(v=>-v);}
      const length=Math.hypot(...normal);normal=normal.map(v=>v/length);
      for(const point of points) {
        const q=visualSettings.solidFixed?point:transformPoint(point,{rotation});
        const n=visualSettings.solidFixed?normal:transformPoint(normal,{rotation});
        out.push(...p.map((v,k)=>v+q[k]*h),...n,...color);
      }
    }
    return;
  }
  const shape=((id%6)+6)%6;
  if(shape===5){sphere(out,p,h,color);return;}
  const mesh=meshes[shape];
  for(let i=0;i<mesh.length;i+=6)out.push(...p.map((x,a)=>x+mesh[i+a]*h),...mesh.slice(i+3,i+6),...color);
  if(!visualSettings.solidFixed)for(let i=start;i<out.length;i+=9) {
    const q=transformPoint(out.slice(i,i+3).map((v,a)=>v-p[a]),{rotation});
    const n=transformPoint(out.slice(i+3,i+6),{rotation});
    for(let a=0;a<3;a++){out[i+a]=q[a]+p[a];out[i+3+a]=n[a];}
  }
}

export function identityGray(id) {const value=[.34,.46,.58,.70,.82,.94][((id%6)+6)%6];return [value,value,value];}

export function solidColor(id,color,gray=visualSettings.solidGray) {
  return visualSettings.solidUniform?rgb(visualSettings.solidColor):gray?identityGray(id):color;
}
export function solidStyleKey(){return [visualSettings.solidGray,visualSettings.solidUniform,visualSettings.solidColor,visualSettings.solidFixed].join(':');}
