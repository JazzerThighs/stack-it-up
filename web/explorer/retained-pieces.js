import {compositeParts} from '../render/piece-mesh.js';
import {mergeFragments,neighborCell} from '../render/cell-fragments.js';
import {xyz} from '../render/geometry.js';
import {IDENTITY,composeRotation,transformPoint} from '../render/transforms.js';
import {withCoverage,vertexCoverage} from '../render/transparency.js';
import {PALETTE} from './model.js';
const inverse=r=>[0,3,6,1,4,7,2,5,8].map(i=>r[i]);
export function capturePieceFragments(cells,generate,shape,palette=PALETTE){
 const parts=compositeParts(cells.map(c=>c?.color||0),cells.map((c,i)=>c?.piece>=0?c.piece+1:i+100),palette,generate,shape,false,cells.reduce((m,c,i)=>c?.piece<0?m|(1<<i):m,0));
 return {cells,fragments:mergeFragments(parts)};
}
export function retainedPieceFragments(source,cells){
 const rotations=cells.map(c=>c?composeRotation(c.solidRotation||IDENTITY,inverse(source.cells[c.assemblyOrigin]?.solidRotation||IDENTITY)):IDENTITY);
 const fragments=cells.map((cell,i)=>{
  if(!cell)return new Float32Array();
  const origin=cell.assemblyOrigin,mesh=source.fragments[origin],r=rotations[i],from=xyz(origin),to=xyz(i);
  const place=p=>transformPoint(p.map((v,a)=>v-from[a]),{rotation:r}).map((v,a)=>v+to[a]);
  const out=mesh.slice(),coverage=new Float32Array(mesh.length/3);
  for(let n=0;n<mesh.length;n+=9){out.set(place(Array.from(mesh.subarray(n,n+3))),n);out.set(transformPoint(mesh.subarray(n+3,n+6),{rotation:r}),n+3);coverage.set(place(vertexCoverage(mesh,n)),n/3);}
  return withCoverage(out,coverage);
 });
 function joined(cell,axis,side){
  const next=neighborCell(cell,axis,side),a=cells[cell],b=cells[next];
  if(!a||!b||a.piece<0||a.piece!==b.piece||!rotations[cell].every((v,k)=>v===rotations[next][k]))return false;
  const direction=[0,0,0];direction[axis]=side;
  const local=transformPoint(direction,{rotation:inverse(rotations[cell])}),localAxis=local.findIndex(v=>Math.abs(v)>.5);
  return neighborCell(a.assemblyOrigin,localAxis,Math.sign(local[localAxis]))===b.assemblyOrigin;
 }
 return {fragments,joined};
}
