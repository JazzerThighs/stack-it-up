import assert from 'node:assert/strict';
import {createGyroSmoothing} from '../web/input/gyro-smoothing.js';
import {axisAngle,distance} from '../web/input/orbit-math.js';
const rad=Math.PI/180,id=[0,0,0,1],target=axisAngle([0,1,0],120*rad);
function run(hz){
 const s=createGyroSmoothing({response:()=>180,speed:()=>180,acceleration:()=>1200});s.reset(id);s.target(target);
 let previous=id,previousSpeed=0,result,atOne;
 for(let i=0;i<hz*5;i++){
  result=s.step(1/hz);
  const speed=distance(result.pose,previous)*hz/rad;
  assert(speed<=180.001,'rotation speed stays capped');
  assert(Math.abs(speed-previousSpeed)<=1200/hz+.2,'angular acceleration stays capped');
  previousSpeed=speed;previous=result.pose;
  if(i===hz-1)atOne=result.pose;
 }
 assert(result.done);assert(distance(result.pose,target)<1e-7);
 return atOne;
}
assert(distance(run(60),run(120))<.5*rad);
const s=createGyroSmoothing();s.reset(id);s.target(target);
const first=s.step(1/60).pose;assert(distance(first,id)<1*rad,'large packet starts gently');
for(let i=0;i<10;i++)s.step(1/60);
s.target(axisAngle([0,1,0],-80*rad));
for(let i=0;i<600;i++){const r=s.step(1/120);assert(r.pose.every(Number.isFinite));}
assert(s.step(1/60).done,'reversal settles without endless animation');
s.reset(id);assert.deepEqual(s.step(1).pose,id,'reset removes old target and velocity');
// Quaternion sign changes describe the same pose and must not create a spin.
s.reset(target);s.target(target.map(x=>-x));assert(s.step(1/60).done);
console.log('PASS: eased gyro starts, speed/acceleration limits, frame-rate consistency, reversals, rest and reset.');
