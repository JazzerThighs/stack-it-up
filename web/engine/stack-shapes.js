import {S} from './snapshot.js';
import {IDENTITY,turnTransform,composeRotation,movedCell,transformPoint} from '../render/transforms.js';
import {CubeStack} from './coordinates.js';
/** @returns {(import("./types.js").ShapeCell|null)[]} */
const empty=()=>Array(27).fill(null);
// Immutable provenance is separate from game rules and physical IDs. Freed cells may
// overlap stack cells, so they need a separate layer until they lock again.
/** @param {import("./types.js").EngineSnapshot} state */
export function seedStackShapes(state){
  const groups=new Map(),stack=empty();
  for(let i=0;i<27;i++)if(state[i]){const id=state[27+i];groups.set(id,(groups.get(id)||0)|(1<<i));}
  for(const mask of groups.values()){const source={mask};for(let i=0;i<27;i++)if(mask&(1<<i))stack[i]={source,origin:i,rotation:IDENTITY};}
  const floating=empty(),free=new Map();
  for(let i=0;i<27;i++)if(state[S.FLOATING]&(1<<i)){const id=state.rebuildIds?.[i]||state[S.BAND_IDS+i]||i+100;free.set(id,(free.get(id)||0)|(1<<i));}
  for(const mask of free.values()){const source={mask};for(let i=0;i<27;i++)if(mask&(1<<i))floating[i]={source,origin:i,rotation:IDENTITY};}
  return {stack,floating};
}
/** @param {import("./types.js").ShapeState} shapes @param {number} move */
export function moveFreedShapes(shapes,move){
  const floating=empty(),rotation=turnTransform(move,1);
  shapes.floating.forEach((cell,i)=>{if(!cell)return;let j=i,r=cell.rotation;if(movedCell(i,move)){const p=transformPoint(CubeStack.xyz(i).map(v=>v-1),{rotation}).map(v=>Math.round(v)+1);j=p[0]*9+p[1]*3+p[2];r=composeRotation(rotation,r);}floating[j]={...cell,rotation:r};});
  return {stack:shapes.stack,floating};
}
/** @param {import("./types.js").ShapeState} shapes @param {import("./types.js").EngineEvent} event */
export function applyStackShapeEvent(shapes,event){
  let stack=shapes.stack.slice(),floating=shapes.floating.slice();
  if(event.kind===3)stack=Array.from(event.board,(c,i)=>c?shapes.stack[event.origins[i]]:null);
  if(event.kind===5)for(let i=0;i<27;i++)if((event.mask&(1<<i))&&shapes.stack[i])floating[i]=shapes.stack[i];
  if(event.kind===4)for(let i=0;i<27;i++)if(event.mask&(1<<i)){stack[i]=floating[i];floating[i]=null;}
  // New placements (including automatic ones) capture their complete shape before
  // a subsequent clear event can remove any segments.
  const missing=new Map();
  for(let i=0;i<27;i++){
    if(!event.board[i])stack[i]=null;
    else if(!stack[i] || event.kind===1&&(event.mask&(1<<i))){stack[i]=null;const id=event.ids[i];missing.set(id,(missing.get(id)||0)|(1<<i));}
  }
  for(const mask of missing.values()){const source={mask};for(let i=0;i<27;i++)if(mask&(1<<i))stack[i]={source,origin:i,rotation:IDENTITY};}
  return {stack:Array.from(stack),floating};
}
