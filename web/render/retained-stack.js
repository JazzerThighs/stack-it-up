import {capturePieceFragments,retainedPieceFragments} from '../explorer/retained-pieces.js';
import {exposedFragment,joinMeshes,mergeFragments,neighborCell} from './cell-fragments.js';
import {compositeParts} from './piece-mesh.js';
import {identifyMask} from '../explorer/family-exploration.js';
import {assemblyKind} from './assembly.js';
import {colors} from './geometry.js';
import {jellyStyleKey} from './visual-settings.js';
import {seedStackShapes} from '../engine/stack-shapes.js';
const cache=new Map();let bytes=0;
export function retainedStack(state,generate,modelShape,composition='retained',palette=colors){
 const provenance=state.stackShapes||seedStackShapes(state).stack;
 const groups=new Map(),fragments=Array.from({length:27},()=>new Float32Array()),owners=Array(27);
 provenance.forEach((p,i)=>{if(!p||!state[i])return;if(!groups.has(p.source))groups.set(p.source,[]);groups.get(p.source).push(i);});
 for(const [source,indices] of groups){
  if(typeof composition==='object'&&assemblyKind(composition,!!identifyMask(indices.reduce((m,i)=>m|(1<<i),0)))!=='whole')continue;
  // Complete tetracubes use their current shape; only fragments need provenance.
  if(typeof composition==='object'&&identifyMask(indices.reduce((m,i)=>m|(1<<i),0)))continue;
  // Capture each color separately so Gameboy's dark/white motifs retain their
  // ratios; geometry remains the original mask regardless of the current color.
  for(const color of new Set(indices.map(i=>state[i]))){
   const key=[source.mask,color,modelShape,jellyStyleKey(),palette.join(',')].join(':');
   if(!cache.has(key)){
    const cells=Array.from({length:27},(_,i)=>source.mask&(1<<i)?{piece:0,color,assemblyOrigin:i}:null);
    const captured=capturePieceFragments(cells,generate,modelShape,palette),size=captured.fragments.reduce((n,m)=>n+m.byteLength,0);
    while(bytes+size>16*1024*1024&&cache.size){const first=cache.keys().next().value;bytes-=cache.get(first).size;cache.delete(first);}
    cache.set(key,{captured,size});bytes+=size;
   }
   const cells=Array(27).fill(null);
   for(const i of indices){const p=provenance[i];cells[i]={piece:0,color:state[i],assemblyOrigin:p.origin,solidRotation:p.rotation};}
   const retained=retainedPieceFragments(cache.get(key).captured,cells);
   for(const i of indices)if(state[i]===color){fragments[i]=retained.fragments[i];owners[i]=retained;}
  }
 }
 if(typeof composition==='object'){
  const board=Array.from(state.slice(0,27),(c,i)=>owners[i]?0:c);
  const regular=mergeFragments(compositeParts(board,state.slice(27,54),palette,generate,modelShape,false,0,composition));
  for(let i=0;i<27;i++)if(!owners[i])fragments[i]=regular[i];
 }
 const joined=(i,axis,side)=>{
  const next=neighborCell(i,axis,side);
  if(owners[i])return !!owners[next]&&owners[i].joined(i,axis,side);
  return next>=0&&!owners[next]&&!!state[i]&&state[i]===state[next]&&state[27+i]===state[27+next];
 };
 return {fragments,joined,mesh:()=>joinMeshes(fragments.map((m,i)=>exposedFragment(m,i,(axis,side)=>!joined(i,axis,side))))};
}
