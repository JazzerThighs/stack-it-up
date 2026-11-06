import assert from 'node:assert/strict';
import {controlSettings} from '../web/input/control-settings.js';
import {hoveredIdentity,hoverIdentityPackets} from '../web/render/hover-identities.js';
import {compositeParts} from '../web/render/piece-mesh.js';
import {joinMeshes} from '../web/render/cell-fragments.js';
const cells=Array(27).fill(null);for(const i of [0,1,3,4])cells[i]={piece:0,color:'y'};for(const i of [18,19,21,22])cells[i]={piece:1,color:'y'};
const mesh=joinMeshes(compositeParts(cells.map(c=>c?1:0),cells.map(c=>c?c.piece+1:0),['','#ffff00'],()=>{},'angular'));
let uploads=0;const r={cells,identityHover:{p:[-1,-1,-1.5]},gl:{TRIANGLES:4},buffer:()=>({}),upload(target,data){uploads++;target.data=data;}};
const packets=[{id:'packing',target:{data:mesh},type:4,opacity:1}];
assert.equal(controlSettings.hoverIdentities,false);assert.equal(hoverIdentityPackets(r,packets),packets);
controlSettings.hoverIdentities=true;assert.deepEqual(hoveredIdentity(r).cells,[0,1,3,4]);
const replaced=hoverIdentityPackets(r,packets);assert.equal(replaced.length,2);assert.equal(packets[0].target.data,mesh);
assert(replaced.every(p=>p.target.data.every(Number.isFinite)));
const previousUploads=uploads;hoverIdentityPackets(r,packets);assert.equal(uploads,previousUploads);
r.identityHover={p:[1,-1,-1.5]};assert.deepEqual(hoveredIdentity(r).cells,[18,19,21,22]);assert.equal(hoveredIdentity(r).slot,1);
r.orbitDragging=true;assert.equal(hoverIdentityPackets(r,packets),packets);
r.orbitDragging=false;r.identityHover=null;assert.equal(hoverIdentityPackets(r,packets),packets);
console.log('PASS: hover replaces only one physical identity despite duplicate colors, caches geometry, and restores normal rendering on leave/drag.');

const {S}=await import('../web/engine/snapshot.js');
const state=new Uint32Array(226);for(const i of [0,1,3,4]){state[i]=1;state[27+i]=7;}for(const i of [18,19,21,22]){state[i]=1;state[27+i]=8;}
const game={state,combined:true,identityHover:{p:[1,-1,-1.5]}};
assert.deepEqual(hoveredIdentity(game).cells,[18,19,21,22]);assert.equal(hoveredIdentity(game).slot,1);
state[S.ACTIVE]=(1<<0)|(1<<1);game.identityHover={p:[-1,-1,-1.5]};assert.deepEqual(hoveredIdentity(game).cells,[0,1]);assert.equal(hoveredIdentity(game).slot,5);
console.log('PASS: game stack identities and current active cubies are grouped independently.');
