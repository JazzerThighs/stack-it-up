import assert from 'node:assert/strict';
import fs from 'node:fs';
import {adaptEngine} from '../web/engine/wasm.js';
import {S} from '../web/engine/snapshot.js';
const {instance}=await WebAssembly.instantiate(fs.readFileSync(new URL('../dist/cube_stack.wasm',import.meta.url)));
const engine=adaptEngine(instance.exports);engine.game_init(123);
const words=engine.exportState(),snapshots=[];
// Native undo history caps at 100. Cosmetic history must roll over with it.
for(let n=0;n<105;n++){
 const data=words.slice();data[4]=n+1;data.fill(0,22,76);data[22+n%27]=1;data[49+n%27]=n+1;
 assert(engine.importState(data));snapshots.push(engine.snapshot().stackShapes);
}
for(let n=103;n>=5;n--){assert(engine.game_undo());assert.deepEqual(engine.snapshot().stackShapes,snapshots[n]);}
engine.game_init(123);let placed=0,rng=12345;
for(let n=0;n<1200;n++){
 const before=engine.snapshot();if(before[S.OVER])break;
 if(before[S.PENDING_FACES])assert(engine.game_choose(31-Math.clz32(before[S.PENDING_FACES])));
 else {
 const available=before[S.ALLOWED_MOVES],winning=before[S.WINNING_MOVES]&available;
 const choices=Array.from({length:30},(_,i)=>i).filter(i=>available&(1<<i));
 rng=(Math.imul(rng,1664525)+1013904223)>>>0;
 const m=winning?31-Math.clz32(winning):choices[rng%choices.length];
 if(m===undefined)break;
 assert(engine.game_turn(m));
 }

 const after=engine.snapshot();
 for(let i=0;i<27;i++)assert.equal(!!after[i],!!after.stackShapes[i],`occupied provenance ${n}/${i}`);
 for(const event of engine.events()){
  if(event.kind===1)placed++;
  for(let i=0;i<27;i++)assert.equal(!!event.board[i],!!event.stackShapes[i]);
 }
 const preserved=after.stackShapes;engine.game_configure_rules(1);assert.equal(engine.snapshot().stackShapes,preserved,'changing rules must not replay old events');
}
assert(placed>0);
console.log('PASS: real Wasm placements and animation traces carry stack provenance, settings leave it intact, and 100-entry undo rollover restores it.');
