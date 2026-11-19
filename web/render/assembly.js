import {displaySchema} from '../ui/display-schema.js';
// Assembly controls affect geometry only; they never alter piece membership.
export const assemblyOptions=displaySchema.optionSets.assembly;
export const assemblyUsesSolids=mode=>mode&&typeof mode==='object'?Object.values(mode).includes('solids'):['solids','wholeSolids','cubiesSolids'].includes(mode);
export function assemblyKind(mode,valid,extra=false){
  if(mode&&typeof mode==='object'){const kind=mode[extra?'extras':valid?'whole':'fragments'];return extra&&kind==='whole'?'cubies':kind||'cubies';}
  if(extra)return 'cubies';
  if(mode==='whole'||mode==='wholeSolids')return valid?'whole':mode==='wholeSolids'?'solids':'cubies';
  if(mode==='solids')return 'solids';
  if(mode==='cubiesSolids')return valid?'cubies':'solids';
  return 'cubies';
}
