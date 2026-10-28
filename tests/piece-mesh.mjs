import assert from 'node:assert/strict';
import fs from 'node:fs';
import {adaptEngine} from '../web/engine/wasm.js';
import {compositeMesh} from '../web/render/piece-mesh.js';
import {colors} from '../web/render/geometry.js';
const {instance}=await WebAssembly.instantiate(fs.readFileSync(new URL('../dist/cube_stack.wasm',import.meta.url)));
const engine=adaptEngine(instance.exports),board=Array(27).fill(0),ids=Array(27).fill(0);
for(const i of [0,1,3,4]) {board[i]=1;ids[i]=5;}
const raw=engine.bandMesh(27),mesh=compositeMesh(board,ids,colors,m=>engine.bandMesh(m));
assert.equal(mesh.length,raw.length);for(let n=0;n<mesh.length;n+=9)assert.deepEqual(mesh.slice(n,n+6),raw.slice(n,n+6));
board[26]=2;ids[26]=6;
const withExtra=compositeMesh(board,ids,colors,m=>engine.bandMesh(m));assert(withExtra.length>mesh.length);assert(withExtra.every(Number.isFinite));
console.log('PASS: composite geometry and normals exactly match native game surfaces; extra cubies remain visible.');

const voxel=compositeMesh(board,ids,colors,()=>{throw Error('Voxel must not generate smooth geometry');},'voxel');
assert.equal(voxel.length,5*36*9);
assert(voxel.every(Number.isFinite));
for(let n=0;n<voxel.length;n+=9) {
  assert.equal(Math.hypot(...voxel.slice(n+3,n+6)),1);
  for(let k=0;k<3;k++) assert(Math.abs(voxel[n+k]-Math.round(voxel[n+k]))<.5);
}
console.log('PASS: voxel preset uses bounded squared cells with unit face normals.');
