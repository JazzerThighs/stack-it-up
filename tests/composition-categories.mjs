import './fixtures/behavior-defaults.mjs';
import assert from 'node:assert/strict';
import {explorationMeshes} from '../web/explorer/exploration-mesh.js';
import {capturePieceFragments,retainedPieceFragments} from '../web/explorer/retained-pieces.js';
import {retainedStack} from '../web/render/retained-stack.js';
import {seedStackShapes} from '../web/engine/stack-shapes.js';
import {createGeometryPreparation} from '../web/workers/geometry-preparation.js';
import {visualSettings} from '../web/render/visual-settings.js';
import {PALETTE} from '../web/explorer/model.js';
const generate=()=>{throw Error('Angular fixtures need no native geometry');};
const initial=Array.from({length:27},(_,i)=>[0,1,3,4].includes(i)?{piece:0,color:'y',assemblyOrigin:i}:[18,19,21,22].includes(i)?{piece:1,color:'o',assemblyOrigin:i}:i===13?{piece:-1,color:'d',assemblyOrigin:i}:null);
const cells=structuredClone(initial);cells[22]=null;
const source=capturePieceFragments(initial,generate,'angular'),retained=retainedPieceFragments(source,cells);
for(const whole of ['whole','cubies','solids'])for(const fragments of ['whole','cubies','solids'])for(const extras of ['whole','cubies','solids']){
 const assembly={whole,fragments,extras},parts=[];
 const meshes=explorationMeshes(cells,generate,'angular',false,false,true,false,{},false,assembly,parts,source);
 assert(meshes.every(m=>m.every(Number.isFinite)));
 assert.equal(parts.filter(p=>p.piece===0).length,whole==='whole'?1:4);
 assert.equal(parts.filter(p=>p.piece===1).length,3);
 const extra=parts.find(p=>p.piece===-1);assert.equal(extra.data.identityCell,extras==='solids'?13:undefined);
 if(fragments==='whole')for(const i of [18,19,21])assert.deepEqual(meshes.retained.fragments[i],retained.fragments[i]);
 const result=createGeometryPreparation(generate)({key:'export',cells,initial,shape:'angular',assembly,settings:{...visualSettings},palette:{...PALETTE},fixedColors:true,filters:{},exportModel:true});
 assert.equal(result.exportParts.length,parts.length,'Worker export has no duplicate retained parts');
}
const state=new Uint32Array(54);for(const i of [0,1,3,4]){state[i]=1;state[27+i]=1;}
state.stackShapes=seedStackShapes(state).stack;const original=retainedStack(state,generate,'angular');
state[4]=0;state.stackShapes=state.stackShapes.map((p,i)=>i===4?null:p);
const mixed=retainedStack(state,generate,'angular',{whole:'cubies',fragments:'whole',extras:'solids'});
for(const i of [0,1,3])assert.deepEqual(mixed.fragments[i],original.fragments[i]);
console.log('PASS: all 27 composition combinations, independent extras, preserved cut surfaces, and duplicate-free worker exports.');
