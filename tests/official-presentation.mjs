import assert from 'node:assert/strict';
import {store,official} from './packing-fixture.mjs';
import {packingPresentation} from '../web/explorer/presentation.js';
import {practicePair,matchesTarget,turn} from '../web/explorer/model.js';
import {detectPieces} from '../web/explorer/family-exploration.js';
const expected=new Map([[4,'m'],[14,'y'],[16,'r'],[12,'o'],[10,'g'],[22,'k']]);
store.filter({family:562});const ids=store.selected.slice();
for(let at=0;at<ids.length;at+=Math.max(1,Math.floor(ids.length/64))) {
 const p=await store.record(ids[at]),shown=packingPresentation(p,'official');assert(shown.fixed);
 for(const [i,c]of expected)assert.equal(shown.cells[i].color,c,`center ${i} line ${p.lineNumber}`);
 for(const cell of shown.cells.filter(c=>c.piece>=0))assert.equal(cell.color,'brogym'[cell.piece]);
 for(let move=0;move<30;move++) {
  const moved=turn(shown.cells,move);for(const cell of moved.filter(c=>c.piece>=0))assert.equal(cell.color,'brogym'[cell.piece]);
 }
 const pair=practicePair(shown.packing,shown.packing);assert(matchesTarget(pair.left,pair.right));
}
const canonical=packingPresentation(official,'canonical'),off=packingPresentation(official,'official');
assert.deepEqual(canonical.cells.map(c=>c.color),off.cells.map(c=>c.color));
store.filter({counts:[{type:'O',min:6,max:6}]});
const duplicate=await store.record(store.selected[0]),fallback=packingPresentation(duplicate,'official');
assert.notEqual(duplicate.familyId,562);assert(!fallback.fixed);
assert(fallback.cells.filter(c=>c.piece>=0).every(c=>c.color==='y'));
assert.equal(new Set(packingPresentation(duplicate,'multicolor').cells.filter(c=>c.piece>=0).map(c=>c.color)).size,6);
console.log('PASS: official centers and persistent physical colors throughout family 562, same-packing practice match, canonical duplicate fallback.');

// A completed shape keeps physical colors in Official/Multicolor mode.
const {readFileSync}=await import('node:fs');
const {adaptEngine}=await import('../web/engine/wasm.js');
const {explorationMeshes}=await import('../web/explorer/exploration-mesh.js');
const {packingPalette}=await import('../web/render/palette.js');
const {instance}=await WebAssembly.instantiate(readFileSync(new URL('../dist/cube_stack.wasm',import.meta.url)));
const engine=adaptEngine(instance.exports);
const redT=off.cells.map(c=>c.piece===5?{...c,color:'r'}:null);
const fixedMesh=explorationMeshes(redT,m=>engine.bandMesh(m),'jelly',false,true,true)[0];
const canonicalMesh=explorationMeshes(redT,m=>engine.bandMesh(m),'jelly',false,true,false)[0];
for(const [mesh,key]of [[fixedMesh,'r'],[canonicalMesh,'m']]) {
 const rgb=packingPalette[key].slice(1).match(/../g).map(c=>parseInt(c,16)/255);
 for(let i=0;i<mesh.length;i+=9)for(let k=0;k<3;k++)assert(Math.abs(mesh[i+6+k]-rgb[k])<1e-6);
}
console.log('PASS: fixed piece colors reach completed meshes; canonical mode still recolors by detected shape.');
