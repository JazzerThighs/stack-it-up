import assert from 'node:assert/strict';
import {textMesh,bracketCell,bracketPiece} from '../web/render/text-mesh.js';
import {compositeParts,jellyCell} from '../web/render/piece-mesh.js';
import {explorationMeshes} from '../web/explorer/exploration-mesh.js';
import {visualSettings} from '../web/render/visual-settings.js';
const unit=textMesh();assert.equal(textMesh(),unit);assert.throws(()=>textMesh('A'),/Unsupported/);
const mesh=[];bracketCell(mesh,[0,0,0],.487,[.2,.5,.8]);
assert(mesh.length>0&&mesh.length%27===0);assert(mesh.every(Number.isFinite));
for(let i=0;i<mesh.length;i+=27){
 const a=mesh.slice(i,i+3),b=mesh.slice(i+9,i+12),c=mesh.slice(i+18,i+21),n=mesh.slice(i+3,i+6);
 assert.equal(Math.hypot(...n),1);
 const u=b.map((v,k)=>v-a[k]),v=c.map((v,k)=>v-a[k]);
 const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 assert(cross.reduce((sum,x,k)=>sum+x*n[k],0)>0,'outward winding');
 for(let j=0;j<3;j++){const p=mesh.slice(i+j*9,i+j*9+3);assert(p.every(x=>Math.abs(x)<=.487001));assert.deepEqual(mesh.slice(i+j*9+6,i+j*9+9),[.2,.5,.8]);}
 // The central column is entirely open, including front/back faces.
 if(n[2])assert(a[0]!==0&&b[0]!==0&&c[0]!==0&&!(Math.min(a[0],b[0],c[0])<0&&Math.max(a[0],b[0],c[0])>0));
}
for(let axis=0;axis<3;axis++)assert(Math.abs(Math.max(...mesh.filter((_,i)=>i%9===axis))-.487)<1e-6);
const board=Array(27).fill(0),ids=Array(27).fill(1);for(const i of [0,1,3,4])board[i]=1;
const noNative=()=>{throw Error('Text must not use native jelly geometry');};
const parts=compositeParts(board,ids,['','#ff8000'],noNative,'text');assert.equal(parts.length,1);assert(parts[0].coverage);
assert.equal(parts[0],compositeParts(board,ids,['','#ff8000'],noNative,'text')[0]);
assert.equal(parts[0].length,bracketPiece(27,[1,128/255,0]).length);
const loose=[];jellyCell(loose,13,[1,1,1],noNative,.465,'text');assert(loose.length>0);
const savedScale=visualSettings.cubieScale;
try {
 for(const scale of [40,100]) {
  visualSettings.cubieScale=scale;
  const cells=Array.from({length:27},(_,i)=>[0,3,6,7].includes(i)?{piece:0,color:'o'}:null);
  const positions=meshes=>meshes.flatMap(mesh=>Array.from({length:mesh.length/9},(_,i)=>Array.from(mesh.subarray(i*9,i*9+3)).map(v=>v.toFixed(6)).join(','))).sort();
  const whole=explorationMeshes(cells,noNative,'text',false,false,true,false,{},false,'whole');
  const separate=explorationMeshes(cells,noNative,'text',false,false,true,false,{},false,'cubies');
  assert.deepEqual(positions(whole),positions(separate),'Whole and separate text cubies occupy identical geometry at '+scale+'%');
  const single=[];jellyCell(single,13,[1,1,1],noNative,.465,'text');
  assert.deepEqual(single,bracketPiece(1<<13,[1,1,1]),'Loose game text matches piece text');
 }
}finally{visualSettings.cubieScale=savedScale;}
console.log('PASS: extruded bracket bounds, open center, palette, unit normals, outward winding, composite/loose dispatch and cache reuse.');
