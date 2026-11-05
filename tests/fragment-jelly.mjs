import assert from 'node:assert/strict';
import fs from 'node:fs';
import {adaptEngine} from '../web/engine/wasm.js';
import {compositeParts,jellyCell} from '../web/render/piece-mesh.js';
import {setVisualSetting,resetVisualSettings} from '../web/render/visual-settings.js';
import {explorationMeshes} from '../web/explorer/exploration-mesh.js';
const {instance}=await WebAssembly.instantiate(fs.readFileSync(new URL('../dist/cube_stack.wasm',import.meta.url)));
const engine=adaptEngine(instance.exports);
let generated=0;const generate=(...args)=>{generated++;return engine.bandMesh(...args);};
for(const cells of [[0],[0,1],[0,1,2],[0,1,3]]) {
  resetVisualSettings('jelly');
  const board=Array(27).fill(0),ids=Array(27).fill(1);for(const i of cells)board[i]=1;
  const mesh=()=>compositeParts(board,ids,['','#ffffff'],generate,'jelly')[0];
  const initial=mesh();assert(initial.length>0);assert(initial.every(Number.isFinite));
  const count=generated;assert.equal(mesh(),initial);assert.equal(generated,count);
  setVisualSetting('jellyBevel',48);assert.notDeepEqual(mesh(),initial);
  setVisualSetting('jellyBevel',30);setVisualSetting('jellyProfile',6);assert.notDeepEqual(mesh(),initial);
  setVisualSetting('jellyProfile',1.05);assert(mesh().every(Number.isFinite));
}
resetVisualSettings('jelly');
const cells=Array(27).fill(null);cells[0]={piece:-1,color:1};
const extra=explorationMeshes(cells,generate,'jelly')[0];
const single=[];jellyCell(single,0,[1,1,1],generate);
assert.equal(extra.length,single.length);
for(let i=0;i<single.length;i+=9)assert.deepEqual(Array.from(extra.slice(i,i+6)),single.slice(i,i+6));
setVisualSetting('jellyProfile',6);
assert.notDeepEqual(explorationMeshes(cells,generate,'jelly')[0],extra);
resetVisualSettings('jelly');
console.log('PASS: single, domino, straight triple and V fragments share shaping controls; explorer extras use the same cached geometry.');

const elbowBoard=Array(27).fill(0);for(const i of [0,1,3])elbowBoard[i]=1;
const elbowMesh=()=>compositeParts(elbowBoard,Array(27).fill(1),['','#ffffff'],generate,'jelly')[0];
const smoothElbow=elbowMesh();setVisualSetting('jellyElbows',0);
assert.notDeepEqual(elbowMesh(),smoothElbow);assert(elbowMesh().every(Number.isFinite));
resetVisualSettings('jelly');
