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
console.log('PASS: GLB structure, bounds/metre scale, linear colors, piece grouping, export ownership, copied worker transfer and stale/busy/error guards.');
