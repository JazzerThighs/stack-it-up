import assert from 'node:assert/strict';
import {faceMapLevels,createFaceMap,faceMapCell} from '../web/ui/face-map.js';
import {landedState} from '../web/ui/animations.js';
import {S} from '../web/engine/snapshot.js';
const state=new Uint32Array(300);state[S.PIECE]=1;state[S.ACTIVE]=1<<0;state[S.FLOATING]=1<<1;
for(let i=0;i<54;i++)state[80+i]=i%27;
state[2]=2;
for(let move=0;move<30;move++){
 const end=landedState(state,move);
 for(const t of [0,.1,.5,.9,1]){
  let active=0,floating=0;
  for(let i=0;i<27;i++){const x=faceMapLevels(state,end,i,t);active+=x.active;floating+=x.floating;}
  assert(Math.abs(active-1)<1e-9);assert(Math.abs(floating-1)<1e-9);
 }
}
const end=landedState(state,4),source=0,target=31-Math.clz32(end[S.ACTIVE]);
assert.notEqual(source,target);
assert.equal(faceMapLevels(state,end,source,.9).active,1-.9);
assert.equal(faceMapLevels(state,end,target,.9).active,.9);
const copies=Array.from({length:2},()=>Array.from({length:6},()=>Array.from({length:9},()=>({style:{},classList:{toggle(){} }}))));
const update=createFaceMap(copies,['','#ff0','#f0f'],['','O','T'],['U','D','F','B','L','R']);
update(state,{kind:'turn',move:4,t:.9});
assert(copies[0][0][0].style.backgroundImage.includes('9.999999999999998%'));
assert.equal(copies[0][0][2].style.backgroundColor,'#f0f');
assert.deepEqual(copies[0][0][0].style,copies[1][0][0].style);
update(state);assert(copies[0][0][0].style.backgroundImage.includes('100%'));
assert.equal(state[S.ACTIVE],1);assert.equal(state[2],2);
console.log('PASS: all 30 turns preserve map occupancy, continuous drain/fill, fixed stack, mirrored maps and cancellation.');

// Planes are sampled inward from the existing L/D/F face orientation.
for(let c=0;c<9;c++){
 const a=Math.floor(c/3),b=c%3;
 state[80+4*9+c]=a*3+b;
 state[80+1*9+c]=a*9+b;
 state[80+2*9+c]=a*9+b*3;
}
state[13]=2;state[S.ACTIVE]=1<<13;state[S.FLOATING]=0;
const maps=Array.from({length:9},()=>Array.from({length:9},()=>({style:{},classList:{toggle(){}}})));
const updateSlices=createFaceMap([maps],['','#ff0','#f0f'],['','O','T'],['U','D','F','B','L','R']);
for(let move=6;move<=8;move++){
 updateSlices(state,{kind:'turn',move,t:.5});
 for(let map=6;map<9;map++){
  const cells=Array.from({length:9},(_,c)=>faceMapCell(state,map,c));
  assert.equal(new Set(cells).size,9);assert.equal(cells[4],13);
  assert.equal(maps[map][4].style.backgroundColor,'#f0f');
  assert(maps[map][4].style.backgroundImage.includes('100%'));
  for(const i of cells)assert.equal([Math.floor(i/9),Math.floor(i/3)%3,i%3][map-6],1);
 }
}
console.log('PASS: M/E/S each show nine middle-plane cells, including shared core occupancy during slice turns.');
