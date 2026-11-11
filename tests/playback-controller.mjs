import assert from 'node:assert/strict';
import {createPlaybackController} from '../web/explorer/playback-controller.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
let cancelled=0;
const c=createPlaybackController({cancelSearch:()=>cancelled++});
const log=[];
assert.equal(await c.run({plan:()=>[2,5],onPlan:m=>log.push(m),play:async m=>log.push(m),onStep:n=>log.push('step'+n),onFinish:()=>log.push('done')}),true);
assert.deepEqual(log,[[2,5],2,'step1',5,'step2','done']);assert(!c.busy);
// Admission is synchronous, including while view selection is pending.
const preparation=deferred();let planned=0,finished=0;
const first=c.run({prepare:()=>preparation.promise,plan:()=>{planned++;return [];},onFinish:()=>finished++});
assert(c.busy);assert.equal(await c.run({plan:()=>{throw Error('overlap');}}),false);
c.cancel();preparation.resolve();assert.equal(await first,false);assert.equal(planned,0);assert.equal(finished,0);
// A late search failure must not report an error or finish a replacement.
const search=deferred(),replacement=deferred();let errors=0;
const old=c.run({plan:()=>search.promise,onError:()=>errors++,onFinish:()=>finished++});
await Promise.resolve();c.cancel();
const next=c.run({plan:()=>replacement.promise,play:async()=>{},onFinish:()=>finished++});
search.reject(Error('old search'));assert.equal(await old,false);assert(c.busy);assert.equal(errors,0);
replacement.resolve([]);assert.equal(await next,true);assert.equal(finished,1);
// Cancellation while animating cannot publish stale progress or start another move.
const frame=deferred(),started=deferred();let steps=0,plays=0;
const playing=c.run({plan:()=>[1,2],play:()=>{plays++;started.resolve();return frame.promise;},onStep:()=>steps++,onFinish:()=>finished++});
await started.promise;c.cancel();frame.resolve();assert.equal(await playing,false);
assert.equal(plays,1);assert.equal(steps,0);assert.equal(finished,1);
for(const phase of ['prepare','plan','play']){
 const options={plan:()=>[1],play:async()=>{},onError:e=>{assert.equal(e.message,phase);errors++;},onFinish:()=>finished++};
 options[phase]=()=>{throw Error(phase);};
 assert.equal(await c.run(options),false);assert(!c.busy);
}
assert.equal(errors,3);assert.equal(finished,4);assert.equal(cancelled,3);
console.log('PASS: playback admission, sequencing, cancellation during prepare/search/animation, stale-result isolation and failure cleanup.');
