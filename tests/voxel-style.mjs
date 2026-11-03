import assert from 'node:assert/strict';
import {sphere,balloon,diamond} from '../web/render/geometry.js';
import {voxelMesh,VOXEL_SIZE} from '../web/render/voxel-mesh.js';
for(const shape of [sphere,balloon,diamond]) {
 const original=[];shape(original,[0,0,0],.465,[1,.2,.4]);
 const source=new Float32Array(original),mesh=voxelMesh(source);
 assert(mesh.length>0);assert.equal(voxelMesh(source),mesh);
 for(let i=0;i<mesh.length;i+=9){
  for(let a=0;a<3;a++)assert(Math.abs(mesh[i+a]/VOXEL_SIZE-Math.round(mesh[i+a]/VOXEL_SIZE))<1e-5);
  assert.equal(Math.abs(mesh[i+3])+Math.abs(mesh[i+4])+Math.abs(mesh[i+5]),1);
 }
 if(shape===sphere) {
  // Stepped sphere must retain many contour levels, not a single cell box.
  assert(new Set(Array.from(mesh).filter((_,i)=>i%9===0)).size>10);
  for(let i=0;i<mesh.length;i+=9)assert(Math.hypot(...mesh.slice(i,i+3))<.465+VOXEL_SIZE);
 }
}
const line=new Float32Array([0,0,0,0,0,1,1,1,1,1,1,0,0,0,1,1,1,1]);
assert(voxelMesh(line,true).length>27);
console.log('PASS: voxel sphere/rounded/diamond contours, axis-aligned faces, retained cache and voxel line guides.');
