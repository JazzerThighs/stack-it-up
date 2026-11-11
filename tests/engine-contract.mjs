// Test the shipping engine's contract, not a second implementation of its rules.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {adaptEngine} from '../web/engine/wasm.js';
import {S,SNAPSHOT_WORDS} from '../web/engine/snapshot.js';

const {instance}=await WebAssembly.instantiate(readFileSync(new URL('../target/wasm32-unknown-unknown/release/cube_stack.wasm',import.meta.url)));
const engine=adaptEngine(instance.exports,{trackSolids:false}),FULL=(1<<27)-1;
let checks=0,regressionVisited=false;
function check(label) {
  const snapshot=engine.snapshot();
  assert.equal(snapshot.length,SNAPSHOT_WORDS,label);
  assert.equal(snapshot[S.ABI_VERSION],4,label);
  for(let i=0;i<27;i++){
    assert(snapshot[i]<=9,`${label}: invalid cell color`);
    assert.equal(snapshot[i]===0,snapshot[27+i]===0,`${label}: board/identity disagreement`);
  }
  for(const field of [S.ACTIVE,S.FLOATING,S.LAST_MASK])assert.equal(snapshot[field]&~FULL,0,label);
  assert.equal(snapshot[S.OCCUPIED_COUNT],snapshot.slice(0,27).filter(Boolean).length+snapshot[S.FLOATING_COUNT],label);
  for(const event of engine.events()) {
    assert(event.kind>=1&&event.kind<=5,label);
    assert.equal(event.mask&~FULL,0,label);
    assert.equal(event.board.length,27,label);assert.equal(event.ids.length,27,label);
    assert.equal(event.origins.length,27,label);assert(event.origins.every(i=>i<27),label);
  }
  checks++;
  return snapshot;
}
for(let mode=0;mode<3;mode++)for(let seed=1;seed<=12;seed++) {
  engine.game_init(seed);engine.game_set_slice_clears(0);engine.game_set_gravity(mode);
  check('spawn');
  for(let step=0;step<120;step++) {
    const before=engine.snapshot(),saved=engine.exportState();
    if(before[S.OVER])break;
    if(step%19===0) {
      const events=engine.events();
      for(let move=0;move<30;move++)for(const p of engine.placement_previews([move])) {
        assert.equal(p.mask&~FULL,0);assert.equal(p.sourceMask&~before[S.ACTIVE],0);
        assert(p.piece>=1&&p.piece<=11);
      }
      assert.deepEqual(engine.exportState(),saved,'previews must not consume RNG or mutate state');
      assert.deepEqual(engine.events(),events,'previews must not overwrite animation events');
    }
    const pending=before[S.PENDING_FACES];
    let act;
    if(pending)act=()=>engine.game_choose(Math.log2(pending&-pending));
    else if(step%17===0)act=()=>engine.game_hold();
    else {
      const wins=before[S.WINNING_MOVES],move=wins?Math.log2(wins&-wins):(step*7+seed)%30;
      act=()=>engine.game_turn(move);
    }
    const ok=act(),after=engine.exportState(),events=engine.events();
    if(ok&&!pending) {
      assert(engine.game_undo(),'accepted turn/hold is undoable');
      assert.deepEqual(engine.exportState(),saved,'undo restores logical state, including RNG');
      assert(act());
      assert.deepEqual(engine.exportState(),after,'redo is deterministic');
      assert.deepEqual(engine.events(),events,'redo reproduces animation events');
    }else if(!ok)assert.deepEqual(after,saved,'rejected action is inert');
    const current=check(`mode=${mode} seed=${seed} step=${step}`);
    // The next Z has one fit: it auto-locks, clears a face and releases fragments.
    if(mode===2&&seed===10&&step===49){
      regressionVisited=true;
      assert.equal(current[S.PIECES],5);assert.equal(current[S.CLEARS],1);
      assert.equal(current[S.SCORE],1000);assert.equal(current[S.FLOATING_COUNT],11);
    }
    if(step%13===8){engine.game_undo();check('undo');}
  }
}
assert(regressionVisited,'seeded regression must remain covered');
console.log(`PASS: ${checks} engine snapshots, preview purity, deterministic undo/redo and unique-fit regression.`);
