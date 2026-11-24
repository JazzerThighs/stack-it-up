import assert from 'node:assert/strict';
import {pairedSlice,correctedFace,createSlicePairing} from '../web/input/slice-pairing.js';
import {turn} from '../web/explorer/model.js';
import {matrix,multiply,quaternion,cubeRotations} from '../web/input/orbit-math.js';
import {transformPoint} from '../web/render/transforms.js';
import {CubeStack} from '../web/engine/coordinates.js';

const identity=Array.from({length:27},(_,i)=>i);
function rotate(cells,q) {
  const out=[];
  cells.forEach((cell,i)=>{
    const p=transformPoint(CubeStack.xyz(i).map(v=>v-1),{rotation:matrix(q)}).map(v=>Math.round(v)+1);
    out[p[0]*9+p[1]*3+p[2]]=cell;
  });
  return out;
}
let pairs=0;
for(const a of [...Array(6).keys(),...Array.from({length:6},(_,i)=>i+15)])
for(const b of [...Array(6).keys(),...Array.from({length:6},(_,i)=>i+15)]) {
  const pair=pairedSlice(a,b);
  if(!pair)continue;
  pairs++;
  assert.deepEqual(rotate(turn(identity,pair.move),pair.rotation),turn(turn(identity,a),b));
  // Every follow-up direction must preserve the exact labeled-cubie state.
  for(const next of [...Array(6).keys(),...Array.from({length:6},(_,i)=>i+15)])
    assert.deepEqual(rotate(turn(turn(identity,pair.move),correctedFace(next,pair.rotation)),pair.rotation),turn(turn(turn(identity,a),b),next));
}
assert.equal(pairs,12);
// Repeated pairs and face turns in every rigid initial frame.
for(const m of cubeRotations) {
  let correction=quaternion(m), virtual=identity, physical=rotate(identity,correction);
  for(const [a,b] of [[4,20],[0,16],[17,3],[5,19],[2,18],[1,15]]) {
    physical=turn(turn(physical,a),b);
    const pair=pairedSlice(correctedFace(a,correction),correctedFace(b,correction));
    virtual=turn(virtual,pair.move); correction=multiply(correction,pair.rotation);
    assert.deepEqual(rotate(virtual,correction),physical);
  }
}
let clock=0,window=40,id=0;
const tasks=new Map(), emitted=[];
const pairing=createSlicePairing({emit:c=>emitted.push(c),windowMs:()=>window,now:()=>clock,
  setTimer:(f,ms)=>{tasks.set(++id,{f,due:clock+ms});return id;},cancelTimer:id=>tasks.delete(id)});
const push=(m,event={})=>pairing.push(m,event);
const advance=ms=>{clock+=ms;for(const [id,t] of [...tasks])if(t.due<=clock){tasks.delete(id);t.f();}};
const rightQuarter=pairedSlice(4,20).rotation.map((v,i)=>i<3?-v:v);
pairing.gyro([0,0,0,1]);push([4],{cubeTimestamp:100}); clock+=39;pairing.gyro(rightQuarter);clock++;push([20],{cubeTimestamp:140});
assert.deepEqual(emitted.pop().moves,[4,20],'Inclusive boundary before timeout fires');
push([4]);advance(40);assert.deepEqual(emitted.pop().moves,[4]);
push([0]);clock++;push([2]);assert.deepEqual(emitted.pop().moves,[0]);advance(40);assert.deepEqual(emitted.pop().moves,[2]);
// Batched device timestamps distinguish truly adjacent turns from recovered gaps.
for(const [first,second,paired] of [[100,110,true],[100,180,false],[100,90,false]]) {
  pairing.clear();pairing.gyro([0,0,0,1]);clock++;pairing.gyro(rightQuarter);
  push([4],{cubeTimestamp:first,localTimestamp:null});push([20],{cubeTimestamp:second,localTimestamp:null});advance(40);
  assert.equal(emitted.some(c=>c.moves.length===2),paired);emitted.length=0;
}
pairing.clear(); push([4],{cubeTimestamp:10});clock++;push([20],{cubeTimestamp:11});advance(40);
assert.deepEqual(emitted.splice(0).map(c=>c.moves),[[4,20]],'Two timely opposite turns pair without gyro evidence');
push([4],{localTimestamp:null});push([20],{localTimestamp:null});
assert.equal(emitted.length,2);emitted.length=0;
push([4]);push([20]);advance(40);assert.equal(emitted.length,2,'Unstamped same-tick delivery does not pair');emitted.length=0;
push([4]);pairing.clear();advance(100);assert.equal(emitted.length,0);
push([4]);clock+=5;push([0,0]);assert.deepEqual(emitted.map(c=>c.moves),[[4],[0],[0]]);emitted.length=0;
window=0;push([4]);assert.deepEqual(emitted.pop().moves,[4]);assert.equal(tasks.size,0);
console.log('PASS: slice pairing timing, all directions, exact state compensation and all 24 frames.');
