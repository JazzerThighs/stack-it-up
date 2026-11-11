import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGameController} from '../web/game/controller.js';
import {adaptTransport} from '../web/engine/transport.js';
import {S} from '../web/engine/snapshot.js';
const bytes=readFileSync(new URL('../target/wasm32-unknown-unknown/release/cube_stack.wasm',import.meta.url));
const engine=adaptTransport((await WebAssembly.instantiate(bytes)).instance.exports);
engine.game_init(123);
let busy=false,starting=false,locked=false,release;
const busyChanges=[],presentations=[],notifications=[];
const effects={
 turn:{present:transaction=>{presentations.push(transaction);return new Promise(resolve=>{release=resolve;});},settled:()=>notifications.push('settled'),complete:()=>notifications.push('complete'),locked:()=>notifications.push('locked')},
 hold:{},choose:{},lock:{},core:{},debug:{},replay:{},undo:()=>notifications.push('undo'),
};
const controller=createGameController({engine:()=>engine,state:()=>engine.snapshot(),isBusy:()=>busy,isStarting:()=>starting,isLockMode:()=>locked,
 setBusy:value=>{busy=value;busyChanges.push(value);},copyState:s=>s.slice(),effects});
const before=engine.exportState();
const first=controller.play(0,.4);
assert(controller.running);assert(busy);assert.equal(presentations[0].fromT,.4);
const committed=engine.exportState();assert.notDeepEqual(committed,before);
assert.equal(await controller.play(1),false);assert.equal(await controller.hold(),false);assert.equal(controller.undo(),false);
assert.deepEqual(engine.exportState(),committed,'overlapping commands cannot mutate the committed turn');
release();assert.equal(await first,true);assert(!busy);assert(!controller.running);
assert.deepEqual(busyChanges,[true,false]);assert.deepEqual(notifications,['settled','complete']);
assert(controller.undo());assert.deepEqual(engine.exportState(),before);
// Presentation failure releases ownership without pretending the committed move rolled back.
effects.turn.present=async()=>{throw Error('animation failed');};
await assert.rejects(controller.play(0),/animation failed/);assert(!busy);assert(!controller.running);
assert(controller.undo());assert.deepEqual(engine.exportState(),before);
starting=true;assert.equal(await controller.play(0),false);assert.equal(await controller.debugPiece(0,1),false);assert.equal(controller.undo(),false);starting=false;
locked=true;assert.equal(await controller.play(0),false);assert.equal(notifications.at(-1),'locked');locked=false;
assert.equal(await controller.replay({method:'game_init',arg:999}),false,'replay accepts only forecast actions');
assert.deepEqual(engine.exportState(),before);
assert.equal(await controller.hold(),true);assert.equal(await controller.hold(),false);assert(controller.undo());
// Test admission flags independently of puzzle layout, without a DOM or renderer.
let flags=new Uint32Array(226),calls=[];
const mock={snapshot:()=>flags,events:()=>[],game_turn:()=>{calls.push('turn');return 0;},game_hold:()=>{calls.push('hold');return 1;},game_choose:face=>{calls.push(face);return 1;},game_core_option:i=>[3,12][i]||0,game_preview_core:mask=>{calls.push(mask);flags[S.ACTIVE]=mask;return 1;}};
let rejected=0;
const gates=createGameController({engine:()=>mock,state:()=>flags,isBusy:()=>false,isStarting:()=>false,isLockMode:()=>false,setBusy:()=>{},copyState:s=>s.slice(),effects:{turn:{rejected:()=>rejected++},hold:{},choose:{},core:{preview(){}}}});
flags[S.PENDING_FACES]=1;
assert.equal(await gates.play(0),false);assert.equal(await gates.hold(),false);assert.deepEqual(calls,[]);
assert.equal(await gates.choose(0),true);assert.deepEqual(calls,[0]);calls=[];
flags[S.PENDING_FACES]=0;flags[S.HOLD_USED]=1;assert.equal(await gates.hold(),false);
flags[S.HOLD_USED]=0;flags[S.OVER]=1;assert.equal(await gates.hold(),false);flags[S.OVER]=0;
assert.equal(await gates.play(0),false);assert.equal(rejected,1);assert(!gates.running);
calls=[];assert.equal(await gates.selectCore(-1),true);assert.equal(flags[S.ACTIVE],12);
assert.equal(await gates.selectCore(1),true);assert.equal(flags[S.ACTIVE],3);
console.log('PASS: renderer-free controller admission, rejected commands, core selection, atomic async ownership, undo and failure cleanup.');
