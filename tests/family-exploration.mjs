import assert from 'node:assert/strict';
import fs from 'node:fs';
import {detectPieces,identifyMask,createFamilyLookup,chooseFamilyPacking} from '../web/explorer/family-exploration.js';
import {practicePair,turn,ROTATIONS} from '../web/explorer/model.js';
import {clipMesh} from '../web/render/slice-mesh.js';
import {explorationMeshes,sliceForTurn,animateSlices} from '../web/explorer/exploration-mesh.js';
import {adaptEngine} from '../web/engine/wasm.js';
const {instance}=await WebAssembly.instantiate(fs.readFileSync(new URL('../dist/cube_stack.wasm',import.meta.url)));
const engine=adaptEngine(instance.exports);
const packings=[],families=new Map();let family;
for(const line of fs.readFileSync(new URL('../web/explorer/refined_families.txt',import.meta.url),'utf8').split(/\r?\n/)) {
  const head=/^FAMILY (\d+)/.exec(line);if(head)family={id:+head[1]};
  const match=/^\s+line=(\d+) identities=\S+ scores=\S+ (.+)$/.exec(line);
  if(match) {
    const fields=match[2].split(/\s+/),p={lineNumber:+match[1],masks:fields.slice(0,6).map(v=>parseInt(v,16)),extras:parseInt(fields[6].split('=')[1],16),identities:fields[8]};
    packings.push(p);families.set(p.lineNumber,{family});
  }
}
for(const packing of packings) {
  const result=detectPieces(practicePair(packing,packing).left);
  for(let i=0;i<6;i++) if('JLOSTZ'.includes(packing.identities[i]))
    assert.equal(result.find(p=>p.id===i).letter,packing.identities[i],`catalog detection ${packing.lineNumber}/${i}`);
}
const source=packings.find(p=>p.lineNumber===77451),cells=practicePair(source,source).left;
const familyId=families.get(source.lineNumber).family.id;
const members=packings.filter(p=>families.get(p.lineNumber).family.id===familyId);
const lookup=createFamilyLookup(members);
assert.equal(detectPieces(cells).filter(p=>p.letter).length,6);
assert(lookup(cells).matches.some(p=>p.lineNumber===77451));
assert.equal(families.get(chooseFamilyPacking(packings,families,familyId,()=>.4).lineNumber).family.id,familyId);
assert.equal(chooseFamilyPacking(packings,families,-1),null);
// Color and piece numbering do not determine either shape or catalog identity.
const recolored=cells.map(c=>({...c,color:'w',piece:c.piece>=0?5-c.piece:-1}));
assert.equal(detectPieces(recolored).filter(p=>p.letter).length,6);
assert(lookup(recolored).matches.some(p=>p.lineNumber===77451));
for(const rotation of ROTATIONS) {
  const rotated=Array(27);cells.forEach((c,i)=>rotated[rotation[i]]=c);
  assert(lookup(rotated).matches.some(p=>p.lineNumber===77451));
}
for(let move=0;move<30;move++) {
  const moved=turn(cells,move),back=turn(moved,(move+15)%30);
  assert.deepEqual(detectPieces(back),detectPieces(cells));
  if(detectPieces(moved).some(p=>!p.letter)) assert.equal(lookup(moved).matches.length,0);
}
// Nonplanar chains and scattered cubies must not be joined as tetrominos.
assert.equal(identifyMask((1<<0)|(1<<1)|(1<<4)|(1<<13)),null);
assert.equal(identifyMask((1<<0)|(1<<2)|(1<<20)|(1<<26)),null);
const meshes=explorationMeshes(cells,engine.bandMesh,'jelly');
const volume=mesh=>{
  let sum=0;
  for(let i=0;i<mesh.length;i+=27) {
    const [x,y,z]=mesh.slice(i,i+3),[a,b,c]=mesh.slice(i+9,i+12),[d,e,f]=mesh.slice(i+18,i+21);
    sum+=(x*(b*f-c*e)+y*(c*d-a*f)+z*(a*e-b*d))/6;
  }
  return sum;
};
for(const mesh of meshes) for(let axis=0;axis<3;axis++)for(const plane of [-.5,.5]) {
  const lo=clipMesh(mesh,axis,plane,-1),hi=clipMesh(mesh,axis,plane,1);
  assert(lo.every(Number.isFinite)&&hi.every(Number.isFinite));
  for(const half of [lo,hi]) {
    const translated=half.slice();
    for(let i=0;i<translated.length;i+=9)translated[i+axis]+=4;
    assert(Math.abs(volume(translated)-volume(half))<1e-4,`closed mesh ${meshes.indexOf(mesh)}/${axis}/${plane} ${volume(half)} vs ${volume(translated)}`);
  }
  for(let i=0;i<lo.length;i+=9)assert(lo[i+axis]<=plane+1e-6);
  for(let i=0;i<hi.length;i+=9)assert(hi[i+axis]>=plane-1e-6);
  assert(Math.abs(volume(lo)+volume(hi)-volume(mesh))<1e-4,'clipped halves preserve volume');
}
const originalVolume=meshes.reduce((n,m)=>n+volume(m),0);
for(let move=0;move<30;move++) {
  const parts=sliceForTurn(meshes,move);
  for(const t of [0,.5,1]) {
    const mesh=animateSlices(parts,move,t);
    assert(mesh.every(Number.isFinite));
    assert(Math.abs(volume(mesh)-originalVolume)<1e-4,`turn ${move}/${t} preserves closed volume`);
  }
}
console.log('Family exploration: detection, colors, rotations, lookup and 30 capped mesh turns passed.');

const {assignIdentityColors,detectedColor,familyPackingCells}=await import('../web/explorer/family-colors.js');
const {CANONICAL_COLORS,PALETTE}=await import('../web/explorer/model.js');
const {identitySolid,identityShapeNames}=await import('../web/render/identity-solids.js');
const {rgb}=await import('../web/render/geometry.js');
const letters=['Z','L','O','T','S','J'];
assert.deepEqual(assignIdentityColors(letters),letters.map(l=>CANONICAL_COLORS[l]));
for(const bag of [['O','O','O','O','O','O'],['J','J','S','T','O','L'],['J/L','S/Z','T','O','J/L','S/Z']]) {
  const colors=assignIdentityColors(bag);
  assert.equal(new Set(colors).size,6);
  const exact=bag.filter((letter,i)=>letter.split('/').some(l=>CANONICAL_COLORS[l]===colors[i])).length;
  if(bag.every(l=>l==='O'))assert.equal(exact,1);
  else if(bag[0]==='J')assert.equal(exact,5);
  else assert.equal(exact,6);
}
const colored=familyPackingCells(source),detected=detectPieces(colored);
assert.equal(new Set(colored.filter(c=>c.piece>=0).map(c=>c.color)).size,6);
for(const p of detected)assert.equal(colored[cellsOfForTest(p.mask)[0]].color,CANONICAL_COLORS[p.letter]);
function cellsOfForTest(mask) {return Array.from({length:27},(_,i)=>i).filter(i=>mask&(1<<i));}
assert.equal(detectedColor('T','b'),'m');assert.equal(detectedColor('L','g'),'o');
assert.equal(detectedColor('J/L','o'),'o');
assert.equal(detectedColor('S/Z','w'),'g');
// Completed meshes recolor by detected letter, without changing stored ID colors.
const white=cells.map(c=>({...c,color:c.piece>=0?'w':c.color}));
const coloredMeshes=explorationMeshes(white,engine.bandMesh,'jelly',true);
const coloredGroups=[];const seen=new Set();
white.forEach((c,i)=>{const id=c.piece>=0?c.piece:i+100;if(!seen.has(id)){seen.add(id);coloredGroups.push(id);}});
for(let i=0;i<coloredGroups.length;i++) {
  const piece=detectPieces(white).find(p=>p.id===coloredGroups[i]);if(!piece)continue;
  const expected=rgb(PALETTE[CANONICAL_COLORS[piece.letter]]);
  const mesh=coloredMeshes[i];
  for(let k=0;k<mesh.length;k+=9)for(let a=0;a<3;a++)assert(Math.abs(mesh[k+6+a]-expected[a])<1e-6);
}
assert(white.filter(c=>c.piece>=0).every(c=>c.color==='w'));
assert.equal(identityShapeNames.length,6);
const triangleCounts=[4,12,8,36,20];
for(let id=0;id<6;id++) {
  const mesh=[];identitySolid(mesh,[0,0,0],.465,[1,.5,.25],id);
  assert(mesh.length>0 && mesh.every(Number.isFinite));
  if(id<5)assert.equal(mesh.length/27,triangleCounts[id]);
  for(let i=0;i<mesh.length;i+=9) {
    assert(mesh.slice(i,i+3).every(v=>Math.abs(v)<=.465+1e-6));
    assert(Math.abs(Math.hypot(...mesh.slice(i+3,i+6))-1)<1e-6);
  }
  if(id<5)assert(volume(mesh)>0,'Platonic faces point outwards');
}
console.log('PASS: optimal distinct canonical ID colors, detected-shape recoloring and five Platonic solids plus sphere.');
