import assert from 'node:assert/strict';
import {createWorkerRpc} from '../web/workers/rpc.js';
import {createLatestRequest} from '../web/workers/latest-request.js';
const sent=[],progress=[];
const worker={terminated:0,postMessage(message){if(message.method==='bad')throw Error('clone failed');sent.push(message);},terminate(){this.terminated++;}};
const rpc=createWorkerRpc(worker,{onProgress:p=>progress.push(p)});
const a=rpc.call('record',1),b=rpc.call('query',{});
worker.onmessage({data:{progress:{phase:'load'}}});assert.equal(progress.length,1);assert.equal(rpc.pendingCount,2);
worker.onmessage({data:{id:sent[1].id,value:'second'}});worker.onmessage({data:{id:sent[0].id,value:'first'}});
assert.equal(await a,'first');assert.equal(await b,'second');assert.equal(rpc.pendingCount,0);
await assert.rejects(rpc.call('bad'),/clone failed/);assert.equal(rpc.pendingCount,0);
const failed=rpc.call('record',2),failure=assert.rejects(failed,/not found/);worker.onmessage({data:{id:sent.at(-1).id,error:'not found'}});await failure;
const pending=rpc.call('query',{}),rejected=assert.rejects(pending,/crashed/),late=worker.onmessage;
worker.onerror({message:'crashed'});await rejected;assert.equal(worker.terminated,1);assert.equal(rpc.pendingCount,0);
await assert.rejects(rpc.call('record',3),/crashed/);late({data:{id:sent.at(-1).id,value:'late'}});rpc.dispose();assert.equal(worker.terminated,1);
const decodeWorker={postMessage(){},terminate(){this.terminated=true;}};
const decodeRpc=createWorkerRpc(decodeWorker);
const failures=[assert.rejects(decodeRpc.call('a'),/decoded/),assert.rejects(decodeRpc.call('b'),/decoded/)];
decodeWorker.onmessage({data:{id:999,value:'unknown'}});assert.equal(decodeRpc.pendingCount,2);
decodeWorker.onmessageerror();await Promise.all(failures);assert.equal(decodeRpc.pendingCount,0);assert(decodeWorker.terminated);
const queries=createLatestRequest();
const old=queries.begin(),fresh=queries.begin();assert(!old.isCurrent());assert(fresh.isCurrent());queries.invalidate();assert(!fresh.isCurrent());
// Exercise the actual packing client init failure/success/disposal wiring.
const {createPackingClient}=await import('../web/explorer/data-client.js');
const saved=Object.getOwnPropertyDescriptor(globalThis,'Worker');let fake;
try {
 globalThis.Worker=class {constructor(){fake=this;this.sent=[];this.terminated=0;}postMessage(m){this.sent.push(m);}terminate(){this.terminated++;}};
 const loading=createPackingClient(),initFailure=assert.rejects(loading,/bad index/);
 fake.onmessage({data:{id:fake.sent[0].id,error:'bad index'}});await initFailure;assert.equal(fake.terminated,1);
 const ready=createPackingClient();fake.onmessage({data:{id:fake.sent[0].id,value:{count:3}}});const client=await ready;
 assert.equal(client.info.count,3);const record=client.record('12');assert.deepEqual(fake.sent.at(-1).args,[12]);
 const disposed=assert.rejects(record,/disposed/);client.dispose();await disposed;assert.equal(fake.terminated,1);
 await assert.rejects(client.query({}),/disposed/);
} finally {if(saved)Object.defineProperty(globalThis,'Worker',saved);else delete globalThis.Worker;}
console.log('PASS: RPC routing, progress, send failures, worker shutdown, client initialization cleanup and latest-query invalidation.');
