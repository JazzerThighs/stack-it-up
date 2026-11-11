import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Worker as NodeWorker} from 'node:worker_threads';
import {createGeometryClient} from '../web/workers/geometry-client.js';
import {createWorkerRpc} from '../web/workers/rpc.js';
import {createGeometryPreparation,packGeometry} from '../web/workers/geometry-preparation.js';
import {adaptTransport} from '../web/engine/transport.js';
import {visualSettings} from '../web/render/visual-settings.js';
import {PALETTE} from '../web/explorer/model.js';

// Coalescing has a bounded queue, settles skipped work and rejects stale replies.
const messages=[],mock={postMessage:data=>messages.push(data),terminate(){this.terminated=true;}};
const client=createGeometryClient(mock);
const a=client.request({key:'a'}),b=client.request({key:'b'}),c=client.request({key:'c'});
assert.equal(client.pendingCount,2);assert.equal(await b,null);assert.equal(messages.length,1);
mock.onmessage({data:{id:messages[0].id,value:'obsolete'}});assert.equal(await a,null);
await Promise.resolve();assert.equal(messages.length,2);assert.equal(messages[1].args[0].key,'c');
mock.onmessage({data:{id:messages[1].id,value:'current'}});assert.equal(await c,'current');
assert.deepEqual(client.diagnostics,{requested:3,started:2,completed:1,supersededQueued:1,staleReplies:1,failed:0,pendingCount:0,disposed:false});
const diagnostics=client.diagnostics;diagnostics.completed=99;assert.equal(client.diagnostics.completed,1,'Diagnostics are immutable snapshots');
const d=client.request({key:'d'}),e=client.request({key:'e'});client.dispose();assert.equal(await d,null);assert.equal(await e,null);assert(mock.terminated);
await assert.rejects(client.request({key:'f'}),/disposed/);

const wasm=new URL('../dist/cube_stack.wasm',import.meta.url);
const thread=new NodeWorker(new URL('./fixtures/geometry-worker-node.mjs',import.meta.url),{workerData:{wasm:wasm.href}});
const bridge={postMessage:value=>thread.postMessage(value),terminate:()=>thread.terminate()};
thread.on('message',data=>bridge.onmessage?.({data}));thread.on('error',error=>bridge.onerror?.({message:error.message}));
const rpc=createWorkerRpc(bridge);
const {instance}=await WebAssembly.instantiate(fs.readFileSync(wasm));const engine=adaptTransport(instance.exports);
let options;
const prepare=createGeometryPreparation((mask,corner)=>engine.bandMesh(mask,corner,options));
const cells=Array.from({length:27},(_,i)=>[0,3,6,7].includes(i)?{piece:0,color:'o',assemblyOrigin:i}:i===13?{piece:-1,color:'d',assemblyOrigin:i}:null);
const settings={...visualSettings},palette={...PALETTE};
try {
 for(const [i,{shape,assembly}]of [
  {shape:'angular',assembly:'whole'},
  {shape:'jelly',assembly:'whole'},
  {shape:'angular',assembly:'retained'},
  {shape:'angular',assembly:'solids'},
 ].entries()){
  const request={key:'case'+i,cells,initial:cells,shape,assembly,settings,palette,solids:false,gray:false,fixedColors:true,individual:false,filters:{},move:9};
  options={bevel:settings.jellyBevel/100,opening:settings.jellyOpening/100,profile:settings.jellyProfile,elbows:settings.jellyElbows/100,scale:settings.cubieScale/100};
  const expected=packGeometry(prepare(request)).value;
  const result=await rpc.call('prepare',request);
  for(const key of ['solid','fixed','motion'])assert.deepEqual(result[key],expected[key],shape+' '+assembly+' '+key);
  assert(result.solid.coverage instanceof Float32Array);
  // A second response from the same worker uses cached geometry after transfer.
  const repeated=await rpc.call('prepare',request);
  assert.deepEqual(repeated.solid,result.solid,'Transfers do not detach cached worker geometry');
  assert.deepEqual(repeated.motion,result.motion);
 }
 await assert.rejects(rpc.call('invalid'),/Unknown geometry/);
 console.log('PASS: real geometry worker matches release-Wasm synchronous meshes, closed wide-turn fragments, retained assembly, solids, coverage; transferred caches remain reusable.');
 console.log('PASS: geometry queue coalesces requests, suppresses stale results and settles disposal.');
}finally{rpc.dispose();}
