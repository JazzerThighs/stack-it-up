import assert from 'node:assert/strict';
import {planPracticePath} from '../web/explorer/practice-path.js';
import {turn} from '../web/explorer/model.js';
const source=Array.from({length:27},(_,i)=>Math.floor(i/4));
let seed=124;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
for(let trial=0;trial<20;trial++){
 let target=source.slice();for(let i=0;i<30;i++)target=turn(target,Math.floor(random()*30));
 const path=planPracticePath(source,target);assert.deepEqual(path.reduce(turn,source),target);
}
assert.deepEqual(planPracticePath(source,source),[]);
assert.throws(()=>planPracticePath(source,source.map((v,i)=>i===13?99:v)),/Core/);
console.log('PASS: verified constructive practice paths, 20 random legal transformations, identity and impossible core.');
