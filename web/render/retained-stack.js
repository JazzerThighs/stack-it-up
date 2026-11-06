import {capturePieceFragments,retainedPieceFragments} from '../explorer/retained-pieces.js';
import {exposedFragment,joinMeshes} from './cell-fragments.js';
import {colors} from './geometry.js';
import {jellyStyleKey} from './visual-settings.js';
import {seedStackShapes} from '../engine/stack-shapes.js';
const cache=new Map();let bytes=0;
export function retainedStack(state,generate,modelShape){
 const provenance=state.stackShapes||seedStackShapes(state).stack;
 const groups=new Map(),fragments=Array.from({length:27},()=>new Float32Array()),owners=Array(27);
 provenance.forEach((p,i)=>{if(!p||!state[i])return;if(!groups.has(p.source))groups.set(p.source,[]);groups.get(p.source).push(i);});
 for(const [source,indices] of groups){
  // Capture each color separately so Gameboy's dark/white motifs retain their
  // ratios; geometry remains the original mask regardless of the current color.
  for(const color of new Set(indices.map(i=>state[i]))){
   const key=[source.mask,color,modelShape,jellyStyleKey(),colors.join(',')].join(':');
   if(!cache.has(key)){
    const cells=Array.from({length:27},(_,i)=>source.mask&(1<<i)?{piece:0,color,assemblyOrigin:i}:null);
    const captured=capturePieceFragments(cells,generate,modelShape,colors),size=captured.fragments.reduce((n,m)=>n+m.byteLength,0);
    while(bytes+size>16*1024*1024&&cache.size){const first=cache.keys().next().value;bytes-=cache.get(first).size;cache.delete(first);}
    cache.set(key,{captured,size});bytes+=size;
   }
   const cells=Array(27).fill(null);
   for(const i of indices){const p=provenance[i];cells[i]={piece:0,color:state[i],assemblyOrigin:p.origin,solidRotation:p.rotation};}
   const retained=retainedPieceFragments(cache.get(key).captured,cells);
   for(const i of indices)if(state[i]===color){fragments[i]=retained.fragments[i];owners[i]=retained;}
  }
 }
 const joined=(i,axis,side)=>!!owners[i]?.joined(i,axis,side);
 return {fragments,joined,mesh:()=>joinMeshes(fragments.map((m,i)=>exposedFragment(m,i,(axis,side)=>!joined(i,axis,side))))};
}
