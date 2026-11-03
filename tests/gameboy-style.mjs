import assert from 'node:assert/strict';
import {gameboyCell,gameboyPiece,gameboyPattern} from '../web/render/gameboy-mesh.js';
import {compositeParts} from '../web/render/piece-mesh.js';
import {appearances} from '../web/render/appearance.js';
assert(appearances.some(([id])=>id==='gameboy'));
for(const letter of ['O','T','J','L','S','Z','B','D','F','bomb']) {
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
const board=Array(27).fill(0),ids=Array(27).fill(1);
for(const i of [0,1,3,4])board[i]=1;
const palette=['#000000','#ff8000'];
const pieces=compositeParts(board,ids,palette,()=>{throw Error('Gameboy must use relief geometry');},'gameboy');
assert.equal(pieces.length,1);assert(pieces[0].coverage);
assert.equal(compositeParts(board,ids,palette,()=>{},'gameboy')[0],pieces[0]);
console.log('PASS: Gameboy relief geometry, bounds, normals, palette ratios, screw motifs, coverage and caching.');

for(const letter of ['J','S']) {
 const mesh=[];gameboyCell(mesh,[0,0,0],.487,[.2,.5,.8],letter);
 // On +Z: outer dark, colored rim, dark ring, white S center / colored J center.
 const sample=x=>{for(let i=0;i<mesh.length;i+=27){const cx=(mesh[i]+mesh[i+9]+mesh[i+18])/3,cy=(mesh[i+1]+mesh[i+10]+mesh[i+19])/3;
 if(mesh[i+5]===1&&cx>x&&cx<x+.11375&&cy>.0&&cy<.11375)return mesh.slice(i+6,i+9);}throw Error('missing relief cell');};
 const tones=[-.455,-.34125,-.2275,-.11375].map(sample);
 assert(tones[0][0]<.05);assert(Math.abs(tones[1][0]-.2)<1e-6);assert(tones[2][0]<.05);assert.deepEqual(tones[3],letter==='S'?[1,1,1]:[.2,.5,.8]);
}
console.log('PASS: distinct white S / colored J centers.');

const bomb=[];gameboyCell(bomb,[0,0,0],.487,[.2,.5,.8],'bomb');
assert.notDeepEqual(gameboyPattern('bomb'),gameboyPattern('O'));
const extraBoard=Array(27).fill(0),extraIds=Array(27).fill(0);extraBoard[0]=1;
const extra=compositeParts(extraBoard,extraIds,palette,()=>{},'gameboy',false,1)[0];
const expected=gameboyPiece(1,[1,128/255,0],'bomb');
assert.deepEqual(Array.from(extra),Array.from(new Float32Array(expected)));
console.log('PASS: bomb relief replaces extra cubies without changing their palette.');

// View every face from outside with local right/up axes whose cross points out.
for(const letter of ['D','F']) {
 const mesh=[];gameboyCell(mesh,[0,0,0],.487,[.2,.5,.8],letter);
 const pattern=gameboyPattern(letter);
 for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
  const a=(axis+1)%3,b=(axis+2)%3,seen=new Set();
  for(let i=0;i<mesh.length;i+=27){
   if(mesh[i+3+axis]!==sign)continue;
   const u=(mesh[i+a]+mesh[i+9+a]+mesh[i+18+a])/3*sign;
   const v=(mesh[i+b]+mesh[i+9+b]+mesh[i+18+b])/3;
   const x=Math.floor((u+.455)/.11375),y=Math.floor((v+.455)/.11375);
   if(x<0||x>7||y<0||y>7)continue;
   const depth=Math.abs(mesh[i+axis])-.455;
   // Relief sidewalls have a different depth and are excluded.
   if(Math.abs(depth-pattern[y*8+x])>1e-6)continue;
   seen.add(y*8+x);
   const tone=pattern[y*8+x]>.02?1:.24;
   assert(Math.abs(mesh[i+6]-.2*tone)<1e-6);
  }
  assert.equal(seen.size,64,`${letter} outward face ${axis}/${sign}`);
 }
}
const d=gameboyPattern('D'),f=gameboyPattern('F');
for(let y=1;y<7;y++)for(let x=1;x<7;x++)assert(Math.abs(d[y*8+x]+f[y*8+7-x]-.041)<1e-9);
assert.equal(d[4*8+3],.006,'right spiral center is inset');
assert.equal(f[4*8+4],.035,'left spiral center is raised');
console.log('PASS: all six outward faces preserve spiral handedness, dark inset D and colored raised F.');
