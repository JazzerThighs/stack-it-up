import assert from 'node:assert/strict';
import {capturePieceFragments,retainedPieceFragments} from '../web/explorer/retained-pieces.js';
import {turn} from '../web/explorer/model.js';
import {movedCell,composeRotation,turnTransform} from '../web/render/transforms.js';
const cells=Array.from({length:27},(_,i)=>({piece:[0,1,3,4].includes(i)?0:-1,color:'y',assemblyOrigin:i}));
const source=capturePieceFragments(cells,()=>{throw Error('Angular geometry is native-free');},'angular');
const original=retainedPieceFragments(source,cells);
const move=(state,m)=>turn(state.map((c,i)=>movedCell(i,m)?{...c,solidRotation:composeRotation(turnTransform(m,1),c.solidRotation)}:c),m);
for(let m=0;m<30;m++){
 const moved=move(cells,m),pieces=retainedPieceFragments(source,moved);
 for(let i=0;i<27;i++){assert.equal(pieces.fragments[i].length,source.fragments[moved[i].assemblyOrigin].length);assert(pieces.fragments[i].every(Number.isFinite));}
 const restored=retainedPieceFragments(source,move(moved,(m+15)%30));
 for(let i=0;i<27;i++)assert.deepEqual(restored.fragments[i],original.fragments[i]);
}
assert(original.joined(0,2,1));assert(!original.joined(0,0,1));
console.log('PASS: original cut geometry persists through all 30 turns, inverse turns restore it, and only original seams join.');
