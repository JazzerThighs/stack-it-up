import {S} from '../engine/snapshot.js';
import {cubieShape} from './geometry.js';
import {identitySolid,identityGray} from './identity-solids.js';
import {visualSettings} from './visual-settings.js';
export function rebuildSlots(state) {
  const ids=[...new Set(Array.from(state.rebuildIds||[]).filter(Boolean))].sort((a,b)=>a-b);
  return new Map(ids.map((id,slot)=>[id,slot]));
}
export function activeCubie(out,p,h,color,cell,state,renderer) {
  if(renderer.rebuildSolidIdentities && state[S.REBUILD_COLORS+cell]) {
    const slot=renderer.rebuildSlots?.get(state.rebuildIds?.[cell]) ?? state[S.REBUILD_COLORS+cell]-1;
    identitySolid(out,p,h,visualSettings.solidGray?identityGray(slot):color,slot);
  } else cubieShape(!(state[S.FLOATING]&(1<<cell)),!!state[S.REBUILD_COLORS+cell],renderer.activeSpheres)(out,p,h,color);
}
