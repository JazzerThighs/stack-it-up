import assert from 'node:assert/strict';
import {createAnimations} from '../web/ui/animations.js';
import {catchUpRate} from '../web/input/animation-timing.js';

function run({duration=220,speed=()=>1,backlog=()=>null,enabled=true}={}) {
  const frames=[],pending=[];
  globalThis.requestAnimationFrame = callback => pending.push(callback);
  const context={animations:{checked:enabled},renderers:[{draw(){}}],
    animationRate:ms=>catchUpRate(ms,backlog(frames.length))};
  const done=createAnimations(context).animate(duration,t=>frames.push(t),()=>speed(frames.length));
  let time=0;
  while(pending.length) {
    assert.ok(time<5000,'Animation must complete');
    pending.shift()(time); time+=16;
  }
  assert.equal(frames.at(-1),1);
  assert.ok(frames.every((v,i)=>v>=0&&v<=1&&(!i||v>=frames[i-1])),'Progress must never reverse');
  return {time:time-16,frames,done};
}
const normal=run();
assert.ok(run({speed:()=>.25}).time>=normal.time*3.8,'Slow slider values actually slow turns');
assert.ok(run({speed:()=>4}).time<normal.time/3,'Fast slider values accelerate turns');
const burst=run({backlog:n=>({playing:true,pending:n<3?0:8,oldestAge:n*16})});
assert.ok(burst.time<normal.time,'New arrivals accelerate an animation already running');
const steady=run({backlog:()=>({playing:true,pending:0,oldestAge:0})});
assert.ok(steady.time<=96,'Connected turns have a short baseline duration');
assert.ok(run({speed:n=>n<3?4:.25}).time>0,'Changing speed remains monotonic');
assert.deepEqual(run({enabled:false}).frames,[1]);
assert.deepEqual(run({duration:0}).frames,[1]);
assert.equal(catchUpRate(220,{playing:false,pending:5,oldestAge:100}),0);
assert.ok(catchUpRate(220,{playing:true,pending:2,oldestAge:80})>
  catchUpRate(220,{playing:true,pending:2,oldestAge:0}),'Older pending input catches up faster');
assert.ok(catchUpRate(220,{playing:true,pending:100,oldestAge:1000})<=220/24);
delete globalThis.requestAnimationFrame;
console.log('PASS: turn speed, live Bluetooth catch-up, monotonic progress, duration bounds and disabled animations.');
