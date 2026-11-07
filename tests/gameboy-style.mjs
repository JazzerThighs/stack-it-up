import assert from 'node:assert/strict';
import {gameboyCell,gameboyPiece,gameboyPattern} from '../web/render/gameboy-mesh.js';
import {compositeParts} from '../web/render/piece-mesh.js';
import {appearances} from '../web/render/appearance.js';
assert(appearances.some(([id])=>id==='gameboy'));
for(const letter of ['O','T','J','L','S','Z','B','D','F','bomb','loose']) {
 const out=[];gameboyCell(out,[0,0,0],.487,[.2,.5,.8],letter);
 assert(out.length>0&&out.length%27===0);assert(out.every(Number.isFinite));
 for(let i=0;i<out.length;i+=9) {
  assert(out.slice(i,i+3).every(v=>Math.abs(v)<=.490001));
  assert.equal(Math.hypot(...out.slice(i+3,i+6)),1);
  // Relief shades must preserve the chosen color ratios.
  if(!['J','S','T','B'].includes(letter))assert(Math.abs(out[i+6]/.2-out[i+7]/.5)<1e-6);
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
 // On +Z: outer dark, colored rim, dark ring, white J center / colored S center.
 const sample=x=>{for(let i=0;i<mesh.length;i+=27){const cx=(mesh[i]+mesh[i+9]+mesh[i+18])/3,cy=(mesh[i+1]+mesh[i+10]+mesh[i+19])/3;
 if(mesh[i+5]===1&&cx>x&&cx<x+.11375&&cy>.0&&cy<.11375)return mesh.slice(i+6,i+9);}throw Error('missing relief cell');};
 const tones=[-.455,-.34125,-.2275,-.11375].map(sample);
 assert(tones[0][0]<.05);assert(Math.abs(tones[1][0]-.2)<1e-6);assert(tones[2][0]<.05);assert.deepEqual(tones[3],letter==='J'?[1,1,1]:[.2,.5,.8]);
}
console.log('PASS: distinct white J / colored S centers.');

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
   const tone=pattern[y*8+x]>.02?1:.12;
   assert(Math.abs(mesh[i+6]-.2*tone)<1e-6);
  }
  assert.equal(seen.size,64,`${letter} outward face ${axis}/${sign}`);
 }
}
const d=gameboyPattern('D'),f=gameboyPattern('F');
for(let y=1;y<7;y++)for(let x=1;x<7;x++)assert.equal(d[y*8+x]===.006,f[y*8+7-x]===.032,'opposite spiral motifs retain mirrored outlines');
assert.equal(d[4*8+3],.006,'right spiral center is inset');
assert.equal(f[4*8+4],.032,'left spiral center is raised');
console.log('PASS: all six outward faces preserve spiral handedness, dark inset D and colored raised F.');

const leftPlane=gameboyPattern('F');
for(let y=0;y<8;y++)for(let x=0;x<8;x++){
 const edge=Math.min(x,y,7-x,7-y);
 if(edge<=1)assert.equal(leftPlane[y*8+x],0,'left perimeter and adjoining background must be coplanar');
}
console.log('PASS: left spiral has no height step between perimeter and recessed background.');

const leftBase=[];gameboyCell(leftBase,[0,0,0],.487,[.2,.5,.8],'F');
let edgeVertices=0;
for(let i=0;i<leftBase.length;i+=9){
 const p=leftBase.slice(i,i+3);
 if(p.filter(v=>Math.abs(Math.abs(v)-.455)<1e-6).length>=2){
  edgeVertices++;
  assert(p.every(v=>Math.abs(v)<=.455001),'outer edges must stay on the standard base cube');
  assert(Math.abs(leftBase[i+6]-.2*.12)<1e-6,'no bright relief walls along cube edges');
 }
}
assert(edgeVertices>0);
console.log('PASS: left-screw outer seams meet on the common base cube without raised perimeter walls.');

for(const letter of ['O','T','J','L','S','Z','B','D','F','J/L','S/Z','bomb']) {
 const color=[.2,.6,.9],mesh=[];gameboyCell(mesh,[0,0,0],.487,color,letter);
 let count=0;
 for(let i=0;i<mesh.length;i+=27){
  const axis=[0,1,2].find(a=>Math.abs(mesh[i+3+a])===1),a=(axis+1)%3,b=(axis+2)%3;
  if(Math.abs(Math.abs(mesh[i+axis])-.455)>1e-6)continue;
  const u=(mesh[i+a]+mesh[i+9+a]+mesh[i+18+a])/3,v=(mesh[i+b]+mesh[i+9+b]+mesh[i+18+b])/3;
  if(Math.max(Math.abs(u),Math.abs(v))<.34125)continue;
  count++;
  for(let c=0;c<3;c++)assert(Math.abs(mesh[i+6+c]-color[c]*.12)<1e-6,`${letter} perimeter shade`);
 }
 assert(count>0);
}
console.log('PASS: all Gameboy perimeters use the same 12% palette-relative shade.');

for(const letter of ['T','B']) {
 const mesh=[];gameboyCell(mesh,[0,0,0],.487,[.2,.5,.8],letter);
 const pattern=gameboyPattern(letter);let white=0,colored=0,dark=0;
 for(let i=0;i<mesh.length;i+=27){
  if(mesh[i+5]!==1)continue;
  const x=Math.floor(((mesh[i]+mesh[i+9]+mesh[i+18])/3+.455)/.11375);
  const y=Math.floor(((mesh[i+1]+mesh[i+10]+mesh[i+19])/3+.455)/.11375);
  if(x<0||x>7||y<0||y>7)continue;
  const h=pattern[y*8+x];if(Math.abs(mesh[i+2]-.455-h)>1e-6)continue;
  const edge=Math.min(x,y,7-x,7-y),isWhite=letter==='T'?edge===2:edge>0&&h===.008;
  const expected=isWhite?[1,1,1]:edge===0?[.024,.06,.096]:[.2,.5,.8];
  for(let c=0;c<3;c++)assert(Math.abs(mesh[i+6+c]-expected[c])<1e-6,`${letter} inset/rim/raised color`);
  if(isWhite)white++;else if(edge===0)dark++;else colored++;
 }
 assert(white>0&&colored>0&&dark>0);
}
console.log('PASS: white T inset ring and Branch inset corners, colored raised shapes and dark perimeters.');

for(const letter of ['O','J','S','T']){
 const p=gameboyPattern(letter);
 for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(Math.min(x,y,7-x,7-y)===2)assert.equal(p[y*8+x],0,`${letter} inset uses the perimeter base plane`);
}
console.log('PASS: inset rings meet the standard cube base without a raised intermediate seam.');

const bombPlane=gameboyPattern('bomb');
assert.deepEqual([...new Set(bombPlane)].sort((a,b)=>a-b),[0,.032],'bomb uses only the perimeter plane and raised colored field');
for(const [x,y]of [[0,3],[1,3],[0,4],[1,4],[4,0],[4,1]])assert.equal(bombPlane[y*8+x],0,'dark bomb motif meets its frame without a step');
console.log('PASS: bomb extras have no intermediate dark relief plane at the perimeter seam.');

for(const letter of ['O','T','J','L','S','Z','B','D','F','bomb'])assert.notDeepEqual(gameboyPattern('loose'),gameboyPattern(letter));
const looseBoard=Array(27).fill(0);looseBoard[13]=1;
const looseMesh=compositeParts(looseBoard,ids,['','#ffffff'],()=>{},'gameboy')[0];
assert.deepEqual(Array.from(looseMesh),gameboyPiece(1<<13,[1,1,1],'loose'));
const {jellyCell}=await import('../web/render/piece-mesh.js');
const activeLoose=[],expectedLoose=[];
jellyCell(activeLoose,13,[.2,.5,.8],()=>{},.438,'gameboy');
gameboyCell(expectedLoose,[0,0,0],.438,[.2,.5,.8],'loose');
assert.deepEqual(activeLoose,expectedLoose);
console.log('PASS: loose cubies use a unique raised X motif in stack and active rendering, preserving relief colors.');

// Every raised motif reaches the same face plane, including inner J/S/T tiles.
for(const letter of ['O','T','J','L','S','Z','B','D','F','J/L','S/Z','bomb','loose']) {
 const pattern=gameboyPattern(letter);
 assert.equal(Math.max(...pattern),.032,`${letter} raised height`);
 for(const height of pattern)if(height>.008)assert.equal(height,.032,`${letter} raised tiles are coplanar`);
 for(const halfSize of [.438,.465,.487]) {
  const mesh=[];gameboyCell(mesh,[0,0,0],halfSize,[.2,.5,.8],letter);
  for(let axis=0;axis<3;axis++)for(const sign of [-1,1]) {
   let top=-Infinity;
   for(let i=0;i<mesh.length;i+=9)if(mesh[i+3+axis]===sign)top=Math.max(top,sign*mesh[i+axis]);
   assert(Math.abs(top-halfSize)<1e-6,`${letter} face ${axis}/${sign} reaches the common outer plane at size ${halfSize}`);
  }
 }
}
console.log('PASS: every raised motif uses one relief height and all six faces share the requested outer bounds.');
