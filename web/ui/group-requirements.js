import {rebuildSlots} from '../render/active-cubie.js';
import {S} from '../engine/snapshot.js';
import {identityShapeNames} from '../render/identity-solids.js';
import {choices} from '../engine/queue-pieces.js';
const names=['O','T','L','J','S','Z','Branch','Right screw','Left screw'];
export function groupRequirementsText(state,renderer) {
 const current=choices(state[S.PIECE]).map(id=>names[id-1]).join(' / ');
 const slots=rebuildSlots(state,renderer?.rebuildSlots);
 const parts=[`Current piece: ${current}.`],seen=new Set();
 if(state[S.ACTIVE]&(1<<13))parts.push('Pale spheres: core choice. Preview an orientation, then confirm.');
 for(let i=0;i<27;i++) {
  const id=state.rebuildIds?.[i],rule=state.groupRequirements?.[i];
  if(!id||seen.has(id))continue;seen.add(id);
  const slot=slots.get(id);
  const label=(renderer?.activeKinds?renderer.activeKinds[i]==='solids':renderer?.rebuildSolidIdentities) && slot!==undefined?identityShapeNames[slot%6]+(slot>=6?` ${Math.floor(slot/6)+1}`:''):`Freed group ${seen.size}`;
  const requirement=(rule&511)===511?'any connected shape':rule&(1<<17)?'no reconstruction':rule&(1<<16)?'any connected shape':rule&(1<<18)?'single cube':rule&(1<<19)?'domino':rule&(1<<20)?'bar':rule&(1<<21)?'V':names.filter((_,j)=>rule&(1<<j)).join(' / ')||'no allowed shape';
  parts.push(`${label}: ${requirement}.`);
 }
 return parts.join(' ');
}
