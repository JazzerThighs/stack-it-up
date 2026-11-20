import assert from 'node:assert/strict';
import {extraCubieType,extraCubieColor,extraColorFields} from '../web/render/extra-colors.js';
import {visualSettings} from '../web/render/visual-settings.js';
import {compositeParts} from '../web/render/piece-mesh.js';
import {explorationMeshes} from '../web/explorer/exploration-mesh.js';
import {createGeometryPreparation} from '../web/workers/geometry-preparation.js';
import {packingPalette} from '../web/render/palette.js';
import {rgb} from '../web/render/geometry.js';
const custom=['#123456','#235678','#34abcd','#abcdef'];
extraColorFields.forEach((key,i)=>visualSettings[key]=custom[i]);
const counts=[0,0,0,0];
for(let i=0;i<27;i++){counts[extraCubieType(i)]++;assert.equal(extraCubieColor(i),custom[extraCubieType(i)]);}
assert.deepEqual(counts,[1,6,12,8]);
const generate=()=>new Float32Array([0,0,0,0,1,0,1,1,1]);
function check(mesh,hex){assert.ok(mesh.length);const expected=rgb(hex);for(let i=6;i<mesh.length;i+=9)for(let k=0;k<3;k++)assert.ok(Math.abs(mesh[i+k]-expected[k])<1e-6);}
// Ignore old marker colors and solid grayscale preferences for extras.
visualSettings.solidGray=1;
const cells=Array.from({length:27},(_,i)=>({piece:-1,color:i%2?'w':'k'}));
for(const style of ['angular','jelly','text']) {
  for(const extras of ['cubies','solids']) {
    const parts=explorationMeshes(cells,generate,style,false,true,true,false,{},false,{whole:'whole',fragments:'cubies',extras});
    parts.forEach((mesh,i)=>check(mesh,extraCubieColor(i)));
  }
  for(const i of [0,1,4,13]) {
    const board=Array(27).fill(0);board[i]=1;
    check(compositeParts(board,Array(27).fill(1),['','#ff0000'],generate,style,false,1<<i)[0],extraCubieColor(i));
  }
}
// Worker settings must drive extras, including after a subsequent color edit.
const prepare=createGeometryPreparation(generate);
const request={key:'first',exportModel:true,cells,initial:cells,shape:'angular',assembly:{whole:'whole',fragments:'cubies',extras:'cubies'},settings:{...visualSettings},palette:{...packingPalette},filters:{}};
const first=prepare(request);
first.exportParts.forEach(part=>check(part.data,extraCubieColor(part.cells[0])));
const second=prepare({...request,key:'second',settings:{...request.settings,extraCenterColor:'#ff00ff'}});
second.exportParts.forEach(part=>check(part.data,extraCubieColor(part.cells[0])));
assert.equal(extraCubieColor(4),'#ff00ff');
console.log('PASS: all 27 extra types, legacy marker independence, styles, solids and worker color updates.');
