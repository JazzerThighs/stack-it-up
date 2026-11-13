import assert from 'node:assert/strict';
import {encodeModelGLB,captureFamilyModel} from '../web/explorer/model-export.js';
import {box} from '../web/render/geometry.js';
import {createGeometryPreparation,packGeometry} from '../web/workers/geometry-preparation.js';
import {visualSettings} from '../web/render/visual-settings.js';
import {PALETTE} from '../web/explorer/model.js';
const make=(p,color)=>{const out=[];box(out,p,.5,color);return new Float32Array(out);};
const parts=[{piece:0,cells:[13],data:make([0,0,0],[.5,0,1])},{piece:0,cells:[14],data:make([0,0,1],[.5,0,1])},{piece:-1,cells:[0],data:make([-1,-1,-1],[1,1,1])}];
function decode(bytes){const h=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);assert.equal(h.getUint32(0,true),0x46546c67);assert.equal(h.getUint32(4,true),2);assert.equal(h.getUint32(8,true),bytes.length);const n=h.getUint32(12,true);assert.equal(n%4,0);assert.equal(h.getUint32(16,true),0x4e4f534a);const doc=JSON.parse(new TextDecoder().decode(bytes.slice(20,20+n)));assert.equal(h.getUint32(24+n,true),0x004e4942);const bin=bytes.slice(28+n);assert.equal(bin.length,doc.buffers[0].byteLength);return {doc,bin};}
const {doc,bin}=decode(encodeModelGLB(parts,{sizeMm:60,familyId:42}));
assert.equal(doc.nodes.length,2);assert.equal(doc.meshes[0].primitives.length,2);assert.deepEqual(doc.nodes[0].extras.cells,[13,14]);assert.equal(doc.extras.familyId,42);
for(const accessor of doc.accessors){const view=doc.bufferViews[accessor.bufferView];assert.equal(view.byteOffset%4,0);assert(view.byteOffset+view.byteLength<=bin.length);assert(accessor.byteOffset+(accessor.count-1)*view.byteStride+12<=view.byteLength);}
const first=doc.accessors[0];assert(Math.abs(first.min[0]+.01)<1e-8);assert(Math.abs(first.max[0]-.01)<1e-8);
const dv=new DataView(bin.buffer);assert(Math.abs(dv.getFloat32(24,true)-.21404114)<1e-6);
assert.equal(doc.materials[0].pbrMetallicRoughness.metallicFactor,0);
assert.throws(()=>encodeModelGLB(parts,{sizeMm:0}),/size/);assert.throws(()=>encodeModelGLB([]),/no geometry/);
assert.throws(()=>encodeModelGLB([{...parts[0],data:new Float32Array([1])}]),/triangle/);
const invalid=parts[0].data.slice();invalid[0]=NaN;assert.throws(()=>encodeModelGLB([{...parts[0],data:invalid}]),/non-finite/);
// Export parts preserve physical IDs without guessing from surface positions.
const cells=Array.from({length:27},(_,i)=>[0,3,6,7].includes(i)?{piece:4,color:'o',assemblyOrigin:i}:null);
const request={key:'text',cells,initial:cells,shape:'text',assembly:'whole',settings:{...visualSettings},palette:{...PALETTE},fixedColors:true,filters:{}};
const prepare=createGeometryPreparation(()=>{throw Error('Text needs no Wasm');});
assert.equal(prepare(request).exportParts,undefined);
const result=prepare({...request,exportModel:true});assert(result.exportParts.length);assert(result.exportParts.every(p=>p.piece===4));
assert.deepEqual([...new Set(result.exportParts.flatMap(p=>p.cells))].sort((a,b)=>a-b),[0,3,6,7]);
const packed=packGeometry(result);assert(packed.transfer.includes(packed.value.exportParts[0].data.buffer));assert.notEqual(packed.value.exportParts[0].data.buffer,result.exportParts[0].data.buffer);
decode(encodeModelGLB(packed.value.exportParts));
const view={cells,initial:cells,generation:1,modelShape:'text',assembly:'whole',fixedPieceColors:true,meshGenerator:()=>{throw Error('Text needs no Wasm');}};
decode(await captureFamilyModel(view));await assert.rejects(captureFamilyModel({...view,busy:true}),/Finish/);
await assert.rejects(captureFamilyModel({...view,geometry:{ready:async()=>false}}),/Retry/);
const changing={...view};changing.geometry={ready:async()=>true,base:{key:'text'},revision:1,client:{request:async()=>{changing.generation++;return packed.value;}}};await assert.rejects(captureFamilyModel(changing),/changed/);
// Print layout uses rigid rotations, preserves fragments/colors, and never changes source meshes.
const {arrangePrintLayout}=await import('../web/explorer/print-layout.js');
const originals=parts.map(p=>p.data.slice()),spread=arrangePrintLayout(parts,{sizeMm:60,gapMm:5});
parts.forEach((p,i)=>assert.deepEqual(p.data,originals[i]));
const bounds=group=>{const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const p of group)for(let i=0;i<p.data.length;i+=9)for(let a=0;a<3;a++){min[a]=Math.min(min[a],p.data[i+a]);max[a]=Math.max(max[a],p.data[i+a]);}return {min,max};};
const a=bounds(spread.filter(p=>p.piece===0)),b=bounds(spread.filter(p=>p.piece===-1));
assert(Math.abs(a.min[1])<1e-6&&Math.abs(b.min[1])<1e-6);
assert(Math.abs(a.max[1]-1)<1e-6,'Two-cell piece rests on its long face');
assert(Math.abs(b.min[0]-a.max[0]-.25)<1e-6,'Exactly 5 mm gap at 60 mm cube scale');
for(let p=0;p<parts.length;p++)for(let i=0;i<parts[p].data.length;i+=9){
 assert.deepEqual(spread[p].data.slice(i+6,i+9),parts[p].data.slice(i+6,i+9));
 assert(Math.abs(Math.hypot(...spread[p].data.slice(i+3,i+6))-1)<1e-6);
}
// An arbitrarily rotated 1 x 2 x 3 box must rest on its 2 x 3 face.
const slab=make([0,0,0],[1,0,0]);
for(let i=0;i<slab.length;i+=9){slab[i+1]*=2;slab[i+2]*=3;for(const offset of [0,3]){let x=slab[i+offset],y=slab[i+offset+1],z=slab[i+offset+2];const u=x*Math.cos(.37)-y*Math.sin(.37),v=x*Math.sin(.37)+y*Math.cos(.37);slab[i+offset]=u;slab[i+offset+1]=v*Math.cos(.61)-z*Math.sin(.61);slab[i+offset+2]=v*Math.sin(.61)+z*Math.cos(.61);}}
const flat=arrangePrintLayout([{piece:7,cells:[1],data:slab}]),bound=bounds(flat);
assert(Math.abs(bound.max[1]-1)<1e-5);assert(Math.abs(bound.min[1])<1e-6);
let floorArea=0;const mesh=flat[0].data;
for(let i=0;i<mesh.length;i+=27)if([i+1,i+10,i+19].every(j=>Math.abs(mesh[j])<1e-5)){
 const ux=mesh[i+9]-mesh[i],uz=mesh[i+11]-mesh[i+2],vx=mesh[i+18]-mesh[i],vz=mesh[i+20]-mesh[i+2];floorArea+=Math.abs(ux*vz-uz*vx)/2;
}
assert(Math.abs(floorArea-6)<1e-5,'Largest actual flat face is on the floor, including non-axis-aligned geometry');
const print=decode(encodeModelGLB(parts,{layout:'print',gapMm:5}));
assert.equal(print.doc.nodes.length,2);assert.equal(print.doc.meshes[0].primitives.length,2);
// Measure final serialized coordinates, not just the requested spacing metadata.
for(const sizeMm of [30,60,120])for(const gapMm of [0,2,5]){
 const {doc:layout}=decode(encodeModelGLB(parts,{layout:'print',sizeMm,gapMm}));
 const meshBounds=mesh=>{
  const positions=mesh.primitives.map(p=>layout.accessors[p.attributes.POSITION]);
  return {min:[0,1,2].map(a=>Math.min(...positions.map(p=>p.min[a]))),max:[0,1,2].map(a=>Math.max(...positions.map(p=>p.max[a])))};
 };
 const piece=meshBounds(layout.meshes[0]),extra=meshBounds(layout.meshes[1]);
 assert(Math.abs((extra.min[0]-piece.max[0])*1000-gapMm)<1e-4,'Serialized gap is measured in mm, not metres');
 assert(Math.abs((piece.max[1]-piece.min[1])*1000-sizeMm/3)<1e-4,'Piece size stays unchanged by spread layout');
 assert(Math.abs(piece.min[1])<1e-8&&Math.abs(extra.min[1])<1e-8,'Both pieces remain on the floor');
}
assert.equal(print.doc.extras.layout,'print');assert.equal(print.doc.extras.floorAxis,'Y');
assert.throws(()=>encodeModelGLB(parts,{layout:'print',gapMm:-1}),/spacing/);
assert.throws(()=>encodeModelGLB(parts,{layout:'unknown'}),/layout/);
decode(await captureFamilyModel(view,{layout:'print'}));
console.log('PASS: print layout maximizes flat contact, handles rotated faces, preserves piece grouping/colors/source meshes, and separates grounded pieces with millimetre spacing.');
console.log('PASS: GLB structure, bounds/metre scale, linear colors, piece grouping, export ownership, copied worker transfer and stale/busy/error guards.');
