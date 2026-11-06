import {controlSettings} from '../input/control-settings.js';
import {S} from '../engine/snapshot.js';
import {xyz,rgb,colors} from './geometry.js';
import {packingPalette} from './palette.js';
import {identitySolid,solidColor,solidStyleKey} from './identity-solids.js';
import {cellFragments,joinMeshes,exposedFragment,neighborCell} from './cell-fragments.js';
import {tagCoverage} from './transparency.js';
export function hoveredIdentity(r){
 const hit=r.identityHover||r.hover?.hit;
 if(!controlSettings.hoverIdentities||!hit||r.busy||r.orbitDragging||r.currentAnimation||r.animation)return null;
 const q=hit.p.map(v=>Math.max(0,Math.min(2,Math.round(v)+1))),cell=q[0]*9+q[1]*3+q[2];
 if(r.cells){const piece=r.cells[cell]?.piece;if(!(piece>=0))return null;return {cells:r.cells.flatMap((c,i)=>c?.piece===piece?[i]:[]),slot:piece,ids:['packing'],color:rgb(packingPalette[r.cells[cell].color]),rotations:r.cells.map(c=>c?.solidRotation)};}
 const s=r.state;if(!s)return null;
 if(!r.isStack&&((s[S.ACTIVE]|s[S.FLOATING])&(1<<cell))){
  const current=!!(s[S.ACTIVE]&(1<<cell)),id=s.rebuildIds?.[cell]||s[S.BAND_IDS+cell];
  const cells=Array.from({length:27},(_,i)=>i).filter(i=>current?!!(s[S.ACTIVE]&(1<<i)):!!(s[S.FLOATING]&(1<<i))&&(id?(s.rebuildIds?.[i]||s[S.BAND_IDS+i])===id:i===cell));
  return {cells,slot:current?5:(r.rebuildSlots?.get(s.rebuildIds?.[cell])??Math.max(0,(id||1)-1)),ids:current?['active','centers']:['active','floating'],color:current?rgb(colors[s[S.PIECE]]||'#ffffff'):[1,1,1],rotations:s.solidRotations};
 }
 if((r.isStack||r.combined)&&s[cell]){const id=s[27+cell],ids=[...new Set(Array.from({length:27},(_,i)=>i).filter(i=>s[i]).map(i=>s[27+i]))];return {cells:Array.from({length:27},(_,i)=>i).filter(i=>s[i]&&s[27+i]===id),slot:ids.indexOf(id),ids:['stack'],color:rgb(colors[s[cell]]||'#ffffff')};}
 return null;
}
export function hoverIdentityPackets(r,packets){
 const group=hoveredIdentity(r);if(!group)return packets;
 const selected=new Set(group.cells),mask=group.cells.reduce((m,i)=>m|(1<<i),0),style=solidStyleKey();
 r.hoverIdentityCache??=new Map();
 let sample;
 const result=packets.map(p=>{
  if(!group.ids.includes(p.id)||p.type!==r.gl.TRIANGLES||p.rotation||p.offset)return p;
  sample??=p;
  let cache=r.hoverIdentityCache.get(p.target);
  if(!cache||cache.data!==p.target.data||cache.mask!==mask){
   const target=cache?.target||r.buffer();
   const kept=cellFragments(p.target.data).filter(f=>!selected.has(f.cell)).map(f=>exposedFragment(f.mesh,f.cell,(axis,side)=>{const next=neighborCell(f.cell,axis,side);return next<0||selected.has(next);} ));
   r.upload(target,joinMeshes(kept));cache={target,data:p.target.data,mask};r.hoverIdentityCache.set(p.target,cache);
  }
  return {...p,target:cache.target};
 });
 if(!sample)return packets;
 const key=JSON.stringify([mask,group.slot,group.color,group.rotations,style]);
 if(r.hoverIdentityKey!==key){
  r.hoverIdentityBuffer??=r.buffer();const parts=[];
  for(const i of group.cells){const out=[];identitySolid(out,xyz(i),.438,solidColor(group.slot,group.color),group.slot,group.rotations?.[i]);parts.push(tagCoverage(new Float32Array(out),xyz(i)));}
  r.upload(r.hoverIdentityBuffer,joinMeshes(parts));r.hoverIdentityKey=key;
 }
 result.push({...sample,target:r.hoverIdentityBuffer,lightingClass:'Solids'});
 return result;
}
