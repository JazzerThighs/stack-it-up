import assert from 'node:assert/strict';
import {createGyroNeutral} from '../web/input/gyro-neutral.js';
import {axisAngle, distance, multiply, cubeRotations, quaternion} from '../web/input/orbit-math.js';
const rad=Math.PI/180, id=[0,0,0,1], pose=d=>axisAngle([0,1,0],d*rad);
let tolerance=10;
const c=createGyroNeutral({tolerance:()=>tolerance, delay:()=>250, speed:()=>1});
c.reset(id);
let q;
for(let t=0;t<=200;t+=20)q=c.apply(pose(8),pose(8),t);
assert(distance(q,pose(8))<1e-7,'no pull before settling');
q=c.apply(pose(8),pose(8),280);
assert(distance(q,id)<8*rad && distance(q,id)>7*rad,'bounded smooth onset');
for(let t=300;t<=3000;t+=20)q=c.apply(pose(8),pose(8),t);
assert(distance(q,id)<.1*rad,'steady neutral drift converges');
const offset=c.orient(id);
q=c.apply(pose(40),pose(40),3020);
assert(distance(q,multiply(offset,pose(40)))<1e-7,'fast motion keeps full response');
for(let t=3040;t<=4000;t+=20)q=c.apply(pose(40),pose(40),t);
assert(distance(q,multiply(offset,pose(40)))<1e-7,'outside zone does not pull');
tolerance=0;
for(let t=4020;t<=5000;t+=20)q=c.apply(pose(10),pose(10),t);
assert(distance(q,multiply(offset,pose(10)))<1e-7,'disable preserves alignment');
tolerance=10;c.reset(pose(30));
for(let t=0;t<=3000;t+=20)q=c.apply(pose(35),pose(5),t);
assert(distance(q,pose(30))<.1*rad,'arbitrary neutral pose');
c.pause();const held=c.orient(pose(36));q=c.apply(pose(36),pose(6),10000);
assert(distance(q,held)<1e-7,'resume cannot integrate stale elapsed time');
c.reset(id);assert(distance(c.orient(pose(8)),pose(8))<1e-7,'reset clears offset');
// Same elapsed time at different sensor rates produces comparable convergence.
function run(step){const n=createGyroNeutral({delay:()=>250, speed:()=>1});n.reset(id);let out;for(let t=0;t<=1500;t+=step)out=n.apply(pose(8),pose(8),t);return out;}
assert(distance(run(10),run(50))<.15*rad);
console.log('PASS: neutral gyro dwell, smooth convergence, motion/zone gates, disable, reset, resume and sample-rate independence.');

// Use a tilted, rolled natural grip so an incorrect multiplication order cannot
// pass simply because neutral is identity. Every face arrangement must settle
// to its own nearby target, never back to the originally calibrated U/F/R pose.
const grip=multiply(axisAngle([1,0,0],.43),axisAngle([0,0,1],-.29));
assert.equal(cubeRotations.length,24);
for(const rotation of cubeRotations){
  const target=multiply(grip,quaternion(rotation));
  const drift=multiply(axisAngle([1,2,3],7*rad),target);
  const n=createGyroNeutral({delay:()=>250, speed:()=>1});n.reset(grip);
  let result;
  for(let t=0;t<=3000;t+=20)result=n.apply(drift,drift,t);
  assert(distance(result,target)<.1*rad,'each of 24 neutral grips converges locally');
  n.reset(grip);
  for(let t=0;t<=1000;t+=20)result=n.apply(target,target,t);
  assert(distance(result,target)<1e-7,'exact alternate neutral does not rotate back to UFR');
  const outside=multiply(axisAngle([1,0,0],20*rad),target);
  n.reset(grip);
  for(let t=0;t<=1000;t+=20)result=n.apply(outside,outside,t);
  assert(distance(result,outside)<1e-7,'outside every neutral zone remains untouched');
}
console.log('PASS: all 24 neutral face arrangements preserve the calibrated natural grip and local correction zone.');

// Delay and speed are independent, live controls. Doubling speed halves the
// settling time once the dwell period ends (both cap and convergence scale).
function timed(delay,speed,duration,step=10){
 const n=createGyroNeutral({delay:()=>delay,speed:()=>speed});n.reset(id);
 let out;for(let t=0;t<=duration;t+=step)out=n.apply(pose(8),pose(8),t);return out;
}
assert(distance(timed(500,2.5,500),pose(8))<1e-7);
assert(distance(timed(0,2.5,20),id)<8*rad);
assert(distance(timed(100,2.5,300,4),timed(100,1,600,10))<1e-6);
let liveDelay=1000,liveSpeed=1;
const live=createGyroNeutral({delay:()=>liveDelay,speed:()=>liveSpeed});live.reset(id);
for(let t=0;t<=200;t+=20)live.apply(pose(8),pose(8),t);
liveDelay=0;liveSpeed=4;
assert(distance(live.apply(pose(8),pose(8),220),id)<8*rad);
console.log('PASS: configurable delay, zero delay, proportional completion speed and live changes.');

// Sensor speed is independent of displayed correction. A lower cutoff blocks
// a moving hold, a higher cutoff permits it, and crossing it restarts dwell.
let cutoff=5;
const gate=createGyroNeutral({cutoff:()=>cutoff,delay:()=>100,speed:()=>1});gate.reset(id);
let out;
for(let t=0;t<=200;t+=20)out=gate.apply(pose(8),pose(t*.01),t);
assert(distance(out,pose(8))<1e-7,'10 degrees/s exceeds a 5 degrees/s cutoff');
cutoff=20;
for(let t=220;t<=500;t+=20)out=gate.apply(pose(8),pose(t*.01),t);
assert(distance(out,id)<8*rad,'live cutoff permits correction below threshold');
cutoff=5;const stopped=gate.orient(pose(8));
out=gate.apply(pose(8),pose(5.2),520);
assert(distance(out,stopped)<1e-7,'raising physical speed stops correction');
for(let t=540;t<=600;t+=20)out=gate.apply(pose(8),pose(5.2),t);
assert(distance(out,stopped)<1e-7,'a steady hold must satisfy the delay again');
console.log('PASS: configurable physical gyro cutoff and dwell restart.');
