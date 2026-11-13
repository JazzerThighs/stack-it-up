import {captureFamilyModel} from '../web/explorer/model-export.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Worker as NodeWorker} from 'node:worker_threads';
import {createBrowserFixture} from './fixtures/browser.mjs';
const workers=[];
class BrowserWorker {
 constructor(url){
  assert(String(url).endsWith('/workers/geometry-worker.js'));
  this.thread=new NodeWorker(new URL('./fixtures/geometry-worker-node.mjs',import.meta.url),{workerData:{wasm:new URL('../dist/cube_stack.wasm',import.meta.url).href,module:String(url)}});
  this.thread.on('message',data=>this.onmessage?.({data}));this.thread.on('error',e=>this.onerror?.({message:e.message}));workers.push(this);
 }
 postMessage(data){this.lastRequest=data.args?.[0];this.thread.postMessage(data);}
 terminate(){this.terminated=true;return this.thread.terminate();}
}
const browser=createBrowserFixture(fs.readFileSync(new URL('../web/explorer/index.html',import.meta.url),'utf8'),{globals:{Worker:BrowserWorker,cancelAnimationFrame(){}}});browser.install();
const get=document.getElementById;document.getElementById=id=>id==='explorerPage'?{hidden:false}:get(id);
let cube,heartbeat;
try {
 const {PackingCube}=await import('../web/explorer/cube-view.js');
 cube=new PackingCube(browser.element());cube.connected=true;cube.familyExploration=true;cube.assembly='whole';cube.modelShape='jelly';cube.appearance='jelly';cube.fixedPieceColors=true;
 cube.meshGenerator=()=>{throw Error('Geometry must not be generated on the UI thread');};
 const cells=Array.from({length:27},(_,i)=>[0,3,6,7].includes(i)?{piece:0,color:'o'}:null);
 let ticks=0;heartbeat=setInterval(()=>ticks++,5);
 cube.setCells(cells);assert(cube.geometry.pending);assert(await cube.geometry.ready());
 clearInterval(heartbeat);assert(ticks>0,'UI event loop continues while geometry is prepared');
 assert(cube.solid.count>0);
 // Session provenance is non-enumerable; locking must preserve it across worker transport.
 cube.assembly='retained';cube.rebaseInitial();cube.setState(cube.cells);
 assert(await cube.geometry.ready(),String(cube.geometry.error));
 const locked=cube.solid.data.slice();
 const exported=await captureFamilyModel(cube,{sizeMm:60});
 assert.equal(new DataView(exported.buffer).getUint32(0,true),0x46546c67);
 await cube.play(9);assert(!cube.geometry.error);
 const turnedExport=await captureFamilyModel(cube,{sizeMm:60});assert.notDeepEqual(turnedExport,exported);
 assert.deepEqual(workers.at(-1).lastRequest.cells.map(c=>c?.assemblyOrigin),cube.cells.map(c=>c?.assemblyOrigin));
 assert.deepEqual(workers.at(-1).lastRequest.cells.map(c=>c?.solidRotation),cube.cells.map(c=>c?.solidRotation));
 cube.undo();assert(await cube.geometry.ready());assert.deepEqual(cube.solid.data,locked);
 assert.deepEqual(await captureFamilyModel(cube,{sizeMm:60}),exported);
 cube.assembly='whole';cube.setState(cube.cells);assert(await cube.geometry.ready());
 const first=cube.solid.data;
 // The UI keeps the old uploaded mesh while the replacement is pending.
 cube.modelShape='angular';cube.setState(cube.cells);await Promise.resolve();
 cube.modelShape='gameboy';cube.setState(cube.cells);
 cube.modelShape='angular';cube.setState(cube.cells);
 assert.equal(cube.solid.data,first);assert(cube.geometry.pending);
 assert(await cube.geometry.ready());assert.notEqual(cube.solid.data,first);assert(cube.geometry.readyKey.includes('angular'));
 await cube.play(9);assert.equal(cube.history.length,1);assert(!cube.busy);assert(!cube.geometry.pending);
 cube.undo();assert(await cube.geometry.ready());assert.equal(cube.history.length,0);
 assert.deepEqual(cube.cells.map(c=>c?.color),cells.map(c=>c?.color));
 const mesh=cube.solid.data;cube.contextLost=true;cube.restoreGraphics();assert.equal(cube.solid.data,mesh);
 const oldFactory=cube.geometry.createWorker;
 cube.geometry.client.dispose();cube.geometry.client=null;cube.geometry.createWorker=()=>{throw Error('worker unavailable');};
 cube.modelShape='gameboy';cube.setState(cube.cells);assert.equal(await cube.geometry.ready(),false);
 assert(cube.geometry.error);assert.equal(cube.solid.data,mesh);assert(!cube.geometry.retry.hidden);
 const {partitionKey}=await import('../web/explorer/worker-geometry.js');
 const rotations=[],uniform=cube.gl.uniformMatrix3fv;
 cube.gl.uniformMatrix3fv=(location,transpose,value)=>{if(location==='modelRotation')rotations.push(Array.from(value));};
 cube.currentAnimation={kind:'turn',move:9,t:.5};cube.motionPartitions.add(partitionKey(9));cube.draw();
 assert(rotations.length>0);for(const rotation of rotations)assert.deepEqual(rotation,[1,0,0,0,1,0,0,0,1],'Failed replacement keeps the previous scene stationary');
 cube.currentAnimation=null;cube.gl.uniformMatrix3fv=uniform;
 cube.geometry.createWorker=oldFactory;cube.geometry.retry.onclick();assert(await cube.geometry.ready());assert(!cube.geometry.error);
 // A fast catalog match must not leave locks disabled after a slower geometry job.
 const {createSpatialFamilyExplorer}=await import('../web/explorer/spatial-family-controller.js');
 const {packingCells}=await import('../web/explorer/model.js');
 const record={familyId:1,lineNumber:1,masks:[0x000000f,0x00180c0,0x00c0c00,0x0406010,0x1201200,0x4020120],extras:0x2900000,identities:['J','O','T','L','S','Z']};
 const family=createSpatialFamilyExplorer({$:get,get:(_id,options)=>{Object.assign(cube,options);return cube;},getSelected:()=>record,
   data:{lookup:async()=>[record],presentation:()=>({fixed:true,cells:packingCells(record,Array(27).fill('b'))})}});
 cube.modelShape='jelly';await family.load(record);
 for(let i=0;i<10;i++)await Promise.resolve();
 assert.match(get('familyExploreProgress').textContent,/Packing found/);
 assert(cube.geometry.pending);assert(get('familyLockShapes').disabled);assert(get('familyLockColors').disabled);
 assert(await cube.geometry.ready());
 assert(!get('familyLockShapes').disabled,'Shape lock recovers when startup geometry completes');
 assert(!get('familyLockColors').disabled,'Color lock recovers when startup geometry completes');
 cube.modelShape='angular';cube.setState(cube.cells);
 assert(get('familyLockShapes').disabled);assert(get('familyLockColors').disabled);
 assert(await cube.geometry.ready());assert(!get('familyLockShapes').disabled);assert(!get('familyLockColors').disabled);
 // Dispose during preparation: late output must not upload into destroyed GL objects.
 cube.modelShape='jelly';cube.setState(cube.cells);const task=cube.geometry.task;cube.destroy();assert.equal(await task,false);assert(workers.every(w=>w.terminated));
 console.log('PASS: explorer uses real geometry worker without UI-thread generation, keeps previous mesh, coalesces settings, prepares motion buffers, supports turn/undo/recovery and disposes pending work (mock WebGL).');
}finally{clearInterval(heartbeat);for(const worker of workers)if(!worker.terminated)worker.terminate();browser.restore();}
