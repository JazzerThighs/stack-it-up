import assert from 'node:assert/strict';
import fs from 'node:fs';
import {renderPackets} from '../web/render/pipeline.js';
import {visualSettings} from '../web/render/visual-settings.js';
import {turnTransform,transformPoint} from '../web/render/transforms.js';
import {xyz,rotateCell} from '../web/render/geometry.js';
import {cellFragments,exposedFragment,neighborCell} from '../web/render/cell-fragments.js';
import {adaptEngine} from '../web/engine/wasm.js';
const {instance}=await WebAssembly.instantiate(fs.readFileSync(new URL('../dist/cube_stack.wasm',import.meta.url)));
const engine=adaptEngine(instance.exports),mesh=engine.bandMesh((1<<0)|(1<<1)|(1<<3)|(1<<4));
const started=performance.now(),fragments=cellFragments(mesh),first=performance.now()-started;
const cachedStart=performance.now();for(let i=0;i<1000;i++)assert.equal(cellFragments(mesh),fragments);
const cachedTime=performance.now()-cachedStart;
assert.deepEqual(fragments.map(f=>f.cell),[0,1,3,4]);
const volume=mesh=>{
  let sum=0;for(let i=0;i<mesh.length;i+=27){const [x,y,z]=mesh.slice(i,i+3),[a,b,c]=mesh.slice(i+9,i+12),[d,e,f]=mesh.slice(i+18,i+21);sum+=(x*(b*f-c*e)+y*(c*d-a*f)+z*(a*e-b*d))/6;}return sum;
};
assert(Math.abs(fragments.reduce((sum,f)=>sum+volume(f.mesh),0)-volume(mesh))<1e-4);
for(const f of fragments) {
  const translated=f.mesh.slice();for(let i=0;i<translated.length;i+=9)translated[i]+=3;
  assert(Math.abs(volume(translated)-volume(f.mesh))<1e-4,'fragment is a closed solid');
}
for(let move=0;move<30;move++)for(let cell=0;cell<27;cell++) {
  // rotateCell selects layers; compare only cells that actually move.
  const p=xyz(cell),out=[...p,0,0,1,1,1,1];rotateCell(out,0,cell,move,.37);
  if(out.slice(0,3).some((v,a)=>Math.abs(v-p[a])>1e-6)) {
    const gpu=transformPoint(p,{rotation:turnTransform(move,.37)});
    gpu.forEach((v,a)=>assert(Math.abs(v-out[a])<1e-6));
  }
}
let uploads=0,projections=0,draws=0,blend=false,depth=false,door=false;
const gl={DEPTH_TEST:1,LEQUAL:2,STENCIL_TEST:3,BLEND:4,LINES:5,TRIANGLES:6,DEPTH_BUFFER_BIT:7,
  useProgram(){},uniformMatrix3fv(){},uniform3fv(){},uniform1f(){},
  uniform1i(loc,value){if(loc==='screenDoor')door=!!value;},
  enable(flag){if(flag===4)blend=true;},disable(flag){if(flag===4)blend=false;},depthFunc(){},depthMask(value){depth=value;},
  bindVertexArray(){},blendFunc(){},clearDepth(){},clear(){},drawArrays(){draws++;assert(door && depth && !blend);}};
const renderer={gl,uniforms:{screenDoor:'screenDoor'},project(p){projections++;return p;},upload(){uploads++;}};
const packets=[{id:'stack',target:{vao:{},data:mesh,count:mesh.length/9},type:6,opacity:.5,breathe:1}];
visualSettings.ditherTransparency=1;
for(let i=0;i<100;i++)renderPackets.call(renderer,packets,{customLayers:false});
visualSettings.ditherTransparency=0;
renderPackets.call(renderer,[{...packets[0],id:'recent'}],{customLayers:false});
// Dither always uses screen-door coverage, even with the optional setting off.
renderer.appearance='dither';renderer.canvas={width:10,height:10};renderer.ditherPass={begin(){},finish(){}};
renderPackets.call(renderer,packets,{customLayers:false});
assert.equal(draws,102);assert.equal(uploads,0);assert.equal(projections,0);
visualSettings.ditherTransparency=1;
console.log(`PASS: closed cached fragments (${first.toFixed(1)} ms first preparation; ${cachedTime.toFixed(2)} ms for 1,000 cache hits), GPU turn equivalence, 102 translucent/ghost frames with zero CPU sorting/uploads.`);

const {transparencyRank}=await import('../web/render/transparency.js');
// Software coverage test: a translucent rear cubie must occupy some holes in
// the front cubie, rather than exposing only the background at every hole.
for(let axis=0;axis<3;axis++)for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++) {
  const front=[a,b,1],back=[a,b,0];
  if(axis===0){front.reverse();back.reverse();}
  if(axis===1){[front[1],front[2]]=[front[2],front[1]];[back[1],back[2]]=[back[2],back[1]];}
  let frontPixels=0,rearPixels=0,background=0;
  for(let y=0;y<8;y++)for(let x=0;x<8;x++) {
    if(transparencyRank(x,y,front)<32)frontPixels++;
    else if(transparencyRank(x,y,back)<32)rearPixels++;
    else background++;
  }
  assert.equal(frontPixels,32);assert(rearPixels>0 && background>0);
  for(const cell of [front,back]) {
    const ranks=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++)ranks.push(transparencyRank(x,y,cell));
    assert.equal(new Set(ranks).size,64,'opaque/invisible endpoints and coverage remain exact');
  }
}
console.log('PASS: depth layers have independent dither coverage; rear cubies remain visible through front holes.');

// Removing all joined cut faces restores the original exterior surface area.
const area=mesh=>{
  let sum=0;
  for(let i=0;i<mesh.length;i+=27) {
    const u=[0,1,2].map(a=>mesh[i+9+a]-mesh[i+a]),v=[0,1,2].map(a=>mesh[i+18+a]-mesh[i+a]);
    sum+=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2;
  }
  return sum;
};
const exterior=fragments.map(f=>exposedFragment(f.mesh,f.cell,()=>false));
assert(Math.abs(exterior.reduce((n,m)=>n+area(m),0)-area(mesh))<1e-4,'joined fragments have no internal surfaces');
for(const axis of [0,1,2])for(let mode=0;mode<5;mode++) {
  const moving=cell=>{const layer=xyz(cell)[axis]+1;return mode<3?layer===mode:layer!==(mode===3?2:0);};
  for(const f of fragments) {
    const visible=exposedFragment(f.mesh,f.cell,(a,side)=>{
      const neighbor=neighborCell(f.cell,a,side);
      return neighbor<0 || moving(f.cell)!==moving(neighbor);
    });
    assert(visible.length<=f.mesh.length);
    // No hidden cap survives; applying the visibility mask twice is idempotent.
    assert.deepEqual(exposedFragment(visible,f.cell,(a,side)=>{
      const neighbor=neighborCell(f.cell,a,side);
      return neighbor<0 || moving(f.cell)!==moving(neighbor);
    }),visible);
  }
}
for(const f of fragments)assert.deepEqual(exposedFragment(f.mesh,f.cell,()=>true),f.mesh,'separated pieces retain every closing face');
console.log('PASS: joined cut surfaces removed; exposed caps preserved for single/wide turns and detached fragments.');
