import assert from 'node:assert/strict';
import fs from 'node:fs';
import {forecast,stateKey} from '../web/engine/forecast-search.js';
import {adaptEngine} from '../web/engine/wasm.js';
function state(id, placed=0, over=0, pending=0) {
 const s=Array(85).fill(0);s[0]=0x53554931;s[1]=2;s[2]=id;s[4]=placed;s[18]=over;s[19]=pending;
 return s;
}
function graph(nodes,edges) {
 let current;
 return {importState(s){current=s;return true;},exportState(){return current.slice();},
 game_turn(m){const id=edges[current[2]]?.[m];if(id===undefined)return false;current=nodes[id];return true;},
 game_choose(m){return this.game_turn(m);},game_lock_band(){return false;}};
}
function run(engine,s,h,limit) {const it=forecast(engine,s,h,limit);let r;do{r=it.next();}while(!r.done);return r.value;}
// Explore every branch: the first failure is not a proof.
const nodes=[state(0),state(1,1,1),state(2,1),state(3,3,1)];
assert.equal(run(graph(nodes,{0:[1,2],2:[3]}),nodes[0],3).status,'safe');
// Multiple automatic placements followed by topout beyond the horizon count.
assert.equal(run(graph(nodes,{0:[3]}),nodes[0],3).status,'safe');
// Cycles terminate and the longest possible prefix determines the marker.
const blocked=run(graph(nodes,{0:[0,1,2],2:[2]}),nodes[0],3);
assert.equal(blocked.status,'blocked');assert.equal(blocked.longest,1);
assert.equal(run(graph(nodes,{0:[2]}),nodes[0],3,1).status,'unknown');
// Pending face choices are searched independently.
const pending=state(0,0,0,1);
assert.equal(run(graph(nodes,{0:[1,3]}),pending,3).status,'safe');
assert.notEqual(stateKey(nodes[0]),stateKey(nodes[2]));
const {instance}=await WebAssembly.instantiate(fs.readFileSync(new URL('../dist/cube_stack.wasm',import.meta.url)));
const engine=adaptEngine(instance.exports);engine.game_init(1);
const initial=engine.exportState();
const fresh=await WebAssembly.instantiate(fs.readFileSync(new URL('../dist/cube_stack.wasm',import.meta.url)));
assert(adaptEngine(fresh.instance.exports).importState(initial), 'fresh worker instance can import without a detached buffer');
const result=run(engine,initial,1,10000);
assert.equal(result.status,'safe','real Rust move/placement path');
assert(engine.importState(initial));assert.deepEqual(engine.exportState(),initial);
console.log('PASS: exhaustive branches, cycles, automatic chains, horizon/topout boundary, face choices, resource uncertainty, real Wasm placement and state isolation.');

// Replay the actual witness through the same UI controller used by the game.
import {createReplay,actionLabel} from '../web/ui/forecast-replay.js';
const elements=new Map();
globalThis.document={getElementById:id=>{if(!elements.has(id))elements.set(id,{hidden:true,disabled:false,textContent:''});return elements.get(id);}};
const $=id=>document.getElementById(id);
const replay=createReplay({engine:()=>engine,act:async step=>!!engine[step.method](step.arg),refresh:()=>{},isBusy:()=>false,closeSettings:()=>{}});
assert(result.steps.length>0);
assert.equal(actionLabel({method:'game_turn',arg:15}),"U'");
replay.setWitness({initial,...result});
$('forecastReplay').onclick();
assert.equal($('forecastReplayBar').hidden,false);
for(const step of result.steps) await $('forecastStep').onclick();
assert.equal(stateKey(engine.exportState()),stateKey(result.finalState));
assert.equal($('forecastReplayStatus').textContent,'Verified path completed.');
$('forecastRestore').onclick();assert.deepEqual(engine.exportState(),initial);
assert.equal($('forecastReplayBar').hidden,true);
replay.setWitness({initial,...result});engine.game_turn(0);
$('forecastReplay').onclick();assert.equal($('forecastReplay').disabled,true);
console.log('PASS: witness notation, live step replay, final-state verification, restore and stale-path rejection.');

engine.game_init(19);const oldRelease=engine.exportState();
engine.game_set_release_rules(2,true,true,1);const newRelease=engine.exportState();
assert.notEqual(stateKey(oldRelease),stateKey(newRelease));
assert(engine.importState(newRelease));assert.equal(engine.game_release_rules(),30);
const releaseForecast=run(engine,newRelease,1,10000);assert.equal(releaseForecast.status,'safe');
console.log('PASS: forecast retains new release rules and searches actual turn-start releases.');
engine.game_init(39);
const unifiedRules=1|2|8|32|512|(15<<10)|(1<<14)|(1<<15)|(1<<20);
assert(engine.game_configure_rules(unifiedRules));const unifiedState=engine.exportState();assert.equal(unifiedState[1],4);
assert(engine.importState(unifiedState));assert.equal(engine.game_rules(),unifiedRules);
const unifiedForecast=run(engine,unifiedState,1,10000);assert.equal(unifiedForecast.status,'safe');
console.log('PASS: queue forecast imports and searches unified gameplay rules with transport v4.');

// Spatial pending choices must be enumerated beyond the original six face IDs.
const {pieceByLetter}=await import('../web/engine/pieces.js');
engine.game_init(65);assert(engine.game_configure_rules(3));assert(engine.game_set_piece_pool(448,true));
assert(engine.game_debug_piece(0,7));
const branch=pieceByLetter('B');let spatialPair;
for(const a of branch.surfacePlacements)for(const b of branch.surfacePlacements) {
 if(a===b)continue;const counts=[0,0,0];
 for(let i=0;i<27;i++)if((a|b)&(1<<i))counts[[Math.floor(i/9),Math.floor(i/3)%3,i%3].filter(v=>v!==1).length-1]++;
 if(counts.every((n,i)=>n<=branch.surfaceInventory[i]))spatialPair=[a,b];
}
assert(spatialPair);
const spatialState=engine.exportState();spatialState[3]=spatialPair[0]|spatialPair[1];spatialState[19]=1;
assert.equal(spatialState[1],5);assert(engine.importState(spatialState));
const spatialForecast=run(engine,spatialState,1,1000);
assert.equal(spatialForecast.status,'safe');assert.equal(spatialForecast.steps[0].method,'game_choose');
assert(spatialForecast.steps[0].arg>=6);assert.equal(spatialForecast.finalState.at(-1),448);
assert(engine.importState(spatialState));for(const step of spatialForecast.steps)assert(engine[step.method](step.arg));
assert.equal(stateKey(engine.exportState()),stateKey(spatialForecast.finalState));
console.log('PASS: spatial pending placements, custom pool and transport v5 forecast/replay.');
