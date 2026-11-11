import {cubieScale} from './cubie-size.js';
// Small pixel-font extrusion engine. Glyphs form the solid; there is no backing cube.
import {xyz} from './geometry.js';
const glyphs={
  '[':['###','#..','#..','#..','#..','#..','###'],
  ']':['###','..#','..#','..#','..#','..#','###'],
};
const cache=new Map();
export function textMesh(text='[]') {
  if(cache.has(text))return cache.get(text);
  if(!text.length||text.length>8)throw Error('Extruded text requires 1–8 glyphs');
  const letters=[...text].map(c=>{if(!glyphs[c])throw Error('Unsupported extruded glyph: '+c);return glyphs[c];});
  const rows=Array.from({length:7},(_,y)=>letters.map(g=>g[y]).join('.'));
  const width=rows[0].length,unit=2/Math.max(width,7),out=[];
  const occupied=(x,y)=>rows[y]?.[x]==='#';
  const quad=(points,normal)=>{
    const a=points[1].map((v,k)=>v-points[0][k]),b=points[2].map((v,k)=>v-points[0][k]);
    const cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    if(cross.reduce((n,v,k)=>n+v*normal[k],0)<0)points.reverse();
    for(const i of [0,1,2,0,2,3])out.push(...points[i],...normal);
  };
  for(let y=0;y<7;y++)for(let x=0;x<width;x++)if(occupied(x,y)){
    const l=(x-width/2)*unit,r=l+unit,t=(3.5-y)*unit,b=t-unit;
    for(const z of [-1,1])quad([[l,b,z],[r,b,z],[r,t,z],[l,t,z]],[0,0,z]);
    if(!occupied(x-1,y))quad([[l,b,-1],[l,t,-1],[l,t,1],[l,b,1]],[-1,0,0]);
    if(!occupied(x+1,y))quad([[r,b,-1],[r,t,-1],[r,t,1],[r,b,1]],[1,0,0]);
    if(!occupied(x,y-1))quad([[l,t,-1],[r,t,-1],[r,t,1],[l,t,1]],[0,1,0]);
    if(!occupied(x,y+1))quad([[l,b,-1],[r,b,-1],[r,b,1],[l,b,1]],[0,-1,0]);
  }
  const mesh=new Float32Array(out);
  if(cache.size>=32)cache.delete(cache.keys().next().value);
  cache.set(text,mesh);return mesh;
}
export function textCell(out,p,h,color,text='[]') {
  h*=cubieScale();
  if(h<=0)return;
  const mesh=textMesh(text);
  for(let i=0;i<mesh.length;i+=6)out.push(...p.map((v,k)=>v+mesh[i+k]*h),...mesh.subarray(i+3,i+6),...color);
}
export function bracketCell(out,p,h,color){textCell(out,p,h,color,'[]');}
export function bracketPiece(mask,color){const out=[];for(let i=0;i<27;i++)if(mask&(1<<i))bracketCell(out,xyz(i),.465,color);return out;}
