import assert from 'node:assert/strict';
import {gameboyLight} from '../web/render/gameboy-lighting.js';
const n=[0,0,1],light=[0,0,1];
const near=gameboyLight([0,0,1.5],n,light),far=gameboyLight([1.5,1.5,1.5],n,light);
assert(near-far>.15,'flat face must have a spatial gradient');
for(let x=-1.5;x<1.5;x+=.03){
 const a=gameboyLight([x,.5,1.5],n,light),b=gameboyLight([x+.001,.5,1.5],n,light);
 assert(Number.isFinite(a)&&Math.abs(a-b)<.001,'continuous motion');
}
const p=[.2,.4,1.2];
assert(Math.abs(gameboyLight(p,[1,0,0],light)-gameboyLight(p,n,light))<.09,'relief normals only weakly change lighting');
assert(gameboyLight([1,0,1],n,[1,0,0])>gameboyLight([-1,0,1],n,[1,0,0]),'light controls move the bright region');
assert(Number.isFinite(gameboyLight([0,0,4],n,light)),'finite at light location');
console.log('PASS: positional Gameboy lighting varies across flat faces, follows light direction, and stays smooth across normals/motion.');
