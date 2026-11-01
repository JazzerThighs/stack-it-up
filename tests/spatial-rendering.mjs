import assert from 'node:assert/strict';
import fs from 'node:fs';
import {adaptEngine} from '../web/engine/wasm.js';
import {pieces} from '../web/engine/pieces.js';
import {colors,packingPalette} from '../web/render/palette.js';
import {compositeParts} from '../web/render/piece-mesh.js';
import {cellFragments} from '../web/render/cell-fragments.js';
import {explorationMeshes} from '../web/explorer/exploration-mesh.js';
import {displayIndex} from '../web/explorer/model.js';
import {detectPieces} from '../web/explorer/family-exploration.js';
const {instance}=await WebAssembly.instantiate(fs.readFileSync(new URL('../dist/cube_stack.wasm',import.meta.url)));
const engine=adaptEngine(instance.exports);
const volume=mesh=>{let total=0;for(let i=0;i<mesh.length;i+=27){const [x,y,z]=mesh.slice(i,i+3),[a,b,c]=mesh.slice(i+9,i+12),[d,e,f]=mesh.slice(i+18,i+21);total+=(x*(b*f-c*e)+y*(c*d-a*f)+z*(a*e-b*d))/6;}return total;};
for(const piece of pieces.filter(p=>p.spatial))for(const mask of [piece.surfacePlacements[0],piece.placements.find(m=>m&(1<<13))]) {
  const board=Array(27).fill(0),ids=Array(27).fill(0),cells=Array(27).fill(null);
  for(let i=0;i<27;i++)if(mask&(1<<i)){board[i]=piece.id;ids[i]=12;cells[displayIndex(i)]={piece:12,color:'w'};}
  assert.equal(detectPieces(cells)[0].letter,piece.letter);
  for(const style of ['jelly','matte','cel','voxel','dither','ascii']) {
    const [mesh]=compositeParts(board,ids,colors,m=>engine.bandMesh(m),style);
    assert(mesh.length&&mesh.every(Number.isFinite));
    assert.equal(compositeParts(board,ids,colors,m=>engine.bandMesh(m),style)[0],mesh,'static piece mesh is cached');
    const [explorer]=explorationMeshes(cells,m=>engine.bandMesh(m),style,true);
    const expected=packingPalette[piece.letter].slice(1).match(/../g).map(c=>parseInt(c,16)/255);
    for(let n=0;n<explorer.length;n+=9)for(let k=0;k<3;k++)assert(Math.abs(explorer[n+6+k]-expected[k])<1e-6);
  }
  const mesh=engine.bandMesh(mask),fragments=cellFragments(mesh);
  // Smooth joins can touch neighboring cells; clipping may retain boundary-only
  // fragments there. Every occupied cell must have a fragment, and the complete
  // partition must remain closed and conserve volume.
  for(let i=0;i<27;i++)if(mask&(1<<i))assert(fragments.some(f=>f.cell===i));
  assert.equal(cellFragments(mesh),fragments);
  assert(Math.abs(fragments.reduce((n,f)=>n+volume(f.mesh),0)-volume(mesh))<1e-4,'cuts preserve spatial piece volume');
  for(const f of fragments){const shifted=f.mesh.slice();for(let i=0;i<shifted.length;i+=9)shifted[i]+=3;assert(Math.abs(volume(shifted)-volume(f.mesh))<1e-4,'fragment caps close the surface');}
}
console.log('PASS: B/D/F surface and core meshes, six styles, canonical colors, cache reuse and closed fragment cuts.');
