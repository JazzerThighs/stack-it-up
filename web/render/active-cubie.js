import {turnTransform,movedCell,transformPoint} from './transforms.js';
import {S} from '../engine/snapshot.js';
import {cubieShape} from './geometry.js';
import {identitySolid,identityGray,solidColor} from './identity-solids.js';
import {visualSettings} from './visual-settings.js';
export function rebuildSlots(state,previous=new Map()) {
  const ids=[...new Set(Array.from(state.rebuildIds||[]).filter(Boolean))].sort((a,b)=>a-b);
  const slots=new Map(ids.filter(id=>previous.has(id)).map(id=>[id,previous.get(id)]));
  for(const id of ids)if(!slots.has(id)){let slot=0;while([...slots.values()].includes(slot))slot++;slots.set(id,slot);}
  return slots;
}
export function activeCubie(out,p,h,color,cell,state,renderer) {
  if(renderer.rebuildSolidIdentities && state[S.REBUILD_COLORS+cell]) {
    const slot=renderer.rebuildSlots?.get(state.rebuildIds?.[cell]) ?? state[S.REBUILD_COLORS+cell]-1;
    const start=out.length;
    identitySolid(out,p,h,solidColor(slot,color),slot,state.solidRotations?.[cell]);
    const animation=renderer.animation;
    if(visualSettings.solidFixed && animation?.kind==='turn' && movedCell(cell,animation.move)) {
      const rotation=turnTransform(animation.move,-animation.t);
      for(let i=start;i<out.length;i+=9) {
        const q=transformPoint(out.slice(i,i+3).map((v,a)=>v-p[a]),{rotation}),n=transformPoint(out.slice(i+3,i+6),{rotation});
        for(let a=0;a<3;a++){out[i+a]=p[a]+q[a];out[i+3+a]=n[a];}
      }
    }
  } else cubieShape(!(state[S.FLOATING]&(1<<cell)),!!state[S.REBUILD_COLORS+cell],renderer.activeSpheres)(out,p,h,color);
}
