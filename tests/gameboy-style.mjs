import assert from 'node:assert/strict';
import {gameboyCell,gameboyPiece,gameboyPattern} from '../web/render/gameboy-mesh.js';
import {compositeParts} from '../web/render/piece-mesh.js';
import {appearances} from '../web/render/appearance.js';
assert(appearances.some(([id])=>id==='gameboy'));
for(const letter of ['O','T','J','L','S','Z','B','D','F']) {
 const out=[];gameboyCell(out,[0,0,0],.487,[.2,.5,.8],letter);
 assert(out.length>0&&out.length%27===0);assert(out.every(Number.isFinite));
 for(let i=0;i<out.length;i+=9) {
  assert(out.slice(i,i+3).every(v=>Math.abs(v)<=.490001));
  assert.equal(Math.hypot(...out.slice(i+3,i+6)),1);
  // Relief shades must preserve the chosen color ratios.
  if(letter!=='J'&&letter!=='S')assert(Math.abs(out[i+6]/.2-out[i+7]/.5)<1e-6);
 }
 assert(new Set(gameboyPattern(letter)).size>1);
}
const d=gameboyPattern('D'),f=gameboyPattern('F');
for(let y=0;y<8;y++)for(let x=0;x<8;x++)assert.equal(d[y*8+x],f[y*8+7-x]);
const board=Array(27).fill(0),ids=Array(27).fill(1);
for(const i of [0,1,3,4])board[i]=1;
const palette=['#000000','#ff8000'];
const pieces=compositeParts(board,ids,palette,()=>{throw Error('Gameboy must use relief geometry');},'gameboy');
assert.equal(pieces.length,1);assert(pieces[0].coverage);
assert.equal(compositeParts(board,ids,palette,()=>{},'gameboy')[0],pieces[0]);
console.log('PASS: Gameboy relief geometry, bounds, normals, palette ratios, mirrored screw motifs, coverage and caching.');

const right=[],left=[];gameboyCell(right,[0,0,0],.487,[1,1,1],'D');gameboyCell(left,[0,0,0],.487,[1,1,1],'F');
const signatures=(mesh,mirror=false)=>{
 const result=[];for(let i=0;i<mesh.length;i+=9)result.push(mesh.slice(i,i+9).map((v,a)=>(v*(mirror&&(a===0||a===3)?-1:1)).toFixed(5).replace('-0.00000','0.00000')).join(','));
 return result.sort();
};
assert.deepEqual(signatures(right,true),signatures(left),'entire screw relief must mirror in 3D');
for(const letter of ['J','S']) {
 const mesh=[];gameboyCell(mesh,[0,0,0],.487,[.2,.5,.8],letter);
 // On +Z: outer dark, colored rim, dark ring, pale center.
 const sample=x=>{for(let i=0;i<mesh.length;i+=27){const cx=(mesh[i]+mesh[i+9]+mesh[i+18])/3,cy=(mesh[i+1]+mesh[i+10]+mesh[i+19])/3;
 if(mesh[i+5]===1&&cx>x&&cx<x+.11375&&cy>.0&&cy<.11375)return mesh.slice(i+6,i+9);}throw Error('missing relief cell');};
 const tones=[-.455,-.34125,-.2275,-.11375].map(sample);
 assert(tones[0][0]<.05);assert(Math.abs(tones[1][0]-.2)<1e-6);assert(tones[2][0]<.05);assert(tones[3][0]>.7);
}
console.log('PASS: full 3D screw reflection and J/S dark-color-dark-pale concentric squares.');
