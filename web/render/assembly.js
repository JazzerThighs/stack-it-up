// Assembly controls affect geometry only; they never alter piece membership.
export const assemblyOptions=[
  ['cubies','Individual Cubies Only'],
  ['whole','Whole Tetracubes + Individual Cubie Fragments'],
  ['solids','Balls & Platonic Solids + Cubie Extras'],
  ['wholeSolids','Whole Tetracubes + Balls & Platonic Solid Fragments + Cubie Extras'],
  ['cubiesSolids','Individual Cubie Tetracubes + Balls & Platonic Solid Fragments + Cubie Extras'],
];
export const assemblyUsesSolids=mode=>['solids','wholeSolids','cubiesSolids'].includes(mode);
export function assemblyKind(mode,valid,extra=false){
  if(extra)return 'cubies';
  if(mode==='whole'||mode==='wholeSolids')return valid?'whole':mode==='wholeSolids'?'solids':'cubies';
  if(mode==='solids')return 'solids';
  if(mode==='cubiesSolids')return valid?'cubies':'solids';
  return 'cubies';
}
