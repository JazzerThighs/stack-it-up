import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {adaptTransport} from '../web/engine/transport.js';
import {createGameSession,encodeSharedState,decodeSharedState} from '../web/game/session.js';
const bytes=readFileSync(new URL('../target/wasm32-unknown-unknown/release/cube_stack.wasm',import.meta.url));
const make=async()=>adaptTransport((await WebAssembly.instantiate(bytes)).instance.exports);
const engine=await make(),reference=await make();
let busy=false;
const session=createGameSession({engine:()=>engine,isBusy:()=>busy});
const config={seed:123,releaseRules:[1,true,false,3],earlyLock:true,gravityMode:1,gravityRules:[false,true],sliceClearMode:1,fragments:true,bandaged:true,randomCubies:false,rebuildMode:2,rules:0xffffffff,pool:63,current:0,held:0};
assert(!session.started);assert(session.start(config));
// Pin native configuration order to the existing new-game flow.
reference.game_init(123);reference.game_set_release_rules(1,true,false,3);reference.game_set_early_lock(true);
reference.game_set_gravity(1);reference.game_set_gravity_rules(false,true);reference.game_set_slice_clears(1);
reference.game_set_fragments(true);reference.game_set_modes(true,false,2);reference.game_configure_rules(0xffffffff);
reference.game_set_piece_pool(63,true);reference.game_debug_piece(1,0);
assert.deepEqual(engine.exportState(),reference.exportState());
const before=engine.exportState();
assert(session.beginSetup());assert(session.starting);assert(!session.setNext(3));assert(!session.start(config));assert.deepEqual(engine.exportState(),before);
session.leaveSetup();session.resume();assert(session.started);assert(!session.starting);
assert(session.setNext(3));assert(engine.game_undo());assert.deepEqual(engine.exportState(),before);
const text=session.share(true),data=JSON.parse(text);
assert.equal(data.format,'StackItUp-state');assert.equal(data.version,1);assert.deepEqual(data.dimensions,[3,3,3]);
assert.deepEqual(decodeSharedState(text),{words:before,chooseNext:true});
assert.equal(text,encodeSharedState(reference,true));
engine.game_turn(0);const turned=engine.exportState();
assert.deepEqual(session.load(text),{chooseNext:true});assert.deepEqual(engine.exportState(),before);
assert(engine.game_undo());assert.deepEqual(engine.exportState(),turned,'shared-state load remains undoable');
for(const bad of ['null','{}','x'.repeat(16001),JSON.stringify({...data,dimensions:[4,3,3]}),JSON.stringify({...data,words:['xyz']}),JSON.stringify({...data,words:['0']})]) {
 const saved=engine.exportState();assert.throws(()=>session.load(bad));assert.deepEqual(engine.exportState(),saved);
}
busy=true;assert(!session.beginSetup());assert(!session.start(config));assert(!session.setNext(2));assert.equal(session.share(),null);assert.equal(session.load(text),null);
assert.deepEqual(engine.exportState(),turned);
console.log('PASS: renderer-free session setup guards, deterministic configuration, share format compatibility, invalid-load isolation and import undo.');
