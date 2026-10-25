import assert from 'node:assert/strict';
import { installCubeDrag } from '../web/input/drag.js';
import { pickBand } from '../web/input/band-pick.js';
import { balloon, sphere, overlapMarks } from '../web/render/geometry.js';
import { S } from '../web/engine/snapshot.js';
globalThis.document={addEventListener(){}};
const events={}, locked=[];
const state=new Uint32Array(226);
state[S.FLOATING]=6;state[S.BAND_IDS+1]=state[S.BAND_IDS+2]=1;
const r={unit:100,orientation:[1,0,0,0,1,0,0,0,1],canvas:{style:{},
  getBoundingClientRect:()=>({left:0,top:0,width:600,height:600}),
  addEventListener:(k,v)=>events[k]=v,setPointerCapture(){}},project:p=>p};
const context={state,lockMode:true,lockBand:async cell=>locked.push(cell),invalidate(){}};
installCubeDrag(r,()=>{},context);
const e={pointerId:1,pointerType:'mouse',button:0,clientX:200,clientY:400,preventDefault(){}};
assert.equal(pickBand(r,e,state),2);
events.pointerdown(e);events.pointerup(e);assert.deepEqual(locked,[2]);
events.pointerdown(e);events.pointermove({...e,clientX:240});events.pointerup(e);assert.equal(locked.length,1);
events.pointerdown(e);events.pointercancel(e);assert.equal(locked.length,1);
// An opaque colored cubie in front must stop the ray.
state[S.FLOATING]=3;state[S.BAND_IDS+0]=state[S.BAND_IDS+1]=1;state[S.BAND_IDS+2]=0;
state[S.ACTIVE]=4;assert.equal(pickBand(r,e,state),-1);
state[S.ACTIVE]=0;assert.equal(pickBand(r,e,state),1);
for (const shape of [sphere,balloon]) {
  const mesh=[];shape(mesh,[0,0,0],0.438,[1,1,1]);
  for(let phase=0;phase<=100;phase++) {
    const scale=.90+.14*Math.sin(phase*Math.PI/50);
    for(let i=0;i<mesh.length;i+=9)for(let a=0;a<3;a++)assert(Math.abs(mesh[i+a]*scale)<.466);
  }
}
const marks=[];overlapMarks(marks,[0,0,0]);assert(marks.some((v,i)=>i%9<3&&Math.abs(v)>.49));
console.log('PASS: whole-group click selection, occlusion, drag/cancel rejection and bounded breathing geometry.');
