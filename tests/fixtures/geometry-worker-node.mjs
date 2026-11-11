// Node adapter for the actual browser module worker and transfer protocol.
import {parentPort,workerData} from 'node:worker_threads';
import fs from 'node:fs';
globalThis.self={postMessage:(value,transfer)=>parentPort.postMessage(value,transfer)};
globalThis.fetch=async url=>{
 if(!String(url).endsWith('/cube_stack.wasm'))throw Error('Unexpected worker fetch: '+url);
 const data=fs.readFileSync(new URL(workerData.wasm));return {ok:true,arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};
};
await import(workerData.module||'../../web/workers/geometry-worker.js');
parentPort.on('message',data=>self.onmessage({data}));
