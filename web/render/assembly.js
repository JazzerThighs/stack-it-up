import {displaySchema} from '../ui/display-schema.js';
// Assembly controls affect geometry only; they never alter piece membership.
export const assemblyOptions=displaySchema.optionSets.assembly;
export const assemblyUsesSolids=mode=>['solids','wholeSolids','cubiesSolids'].includes(mode);
export function assemblyKind(mode,valid,extra=false){
  if(extra)return 'cubies';
  if(mode==='whole'||mode==='wholeSolids')return valid?'whole':mode==='wholeSolids'?'solids':'cubies';
  if(mode==='solids')return 'solids';
  if(mode==='cubiesSolids')return valid?'cubies':'solids';
  return 'cubies';
}
