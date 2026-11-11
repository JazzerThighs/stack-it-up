import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {adaptTransport} from '../web/engine/transport.js';
import {S} from '../web/engine/snapshot.js';
const bytes=readFileSync(new URL('../target/wasm32-unknown-unknown/release/cube_stack.wasm',import.meta.url));
const raw=adaptTransport((await WebAssembly.instantiate(bytes)).instance.exports);
raw.game_init(1);
const initial=raw.exportState();
assert(!('solidRotations' in raw.snapshot()));
assert(!('stackShapes' in raw.snapshot()));
// Execute the real worker entry point with a local Wasm response.
const previousFetch=globalThis.fetch,previousSelf=globalThis.self;
const messages=[];
try {
 globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
 globalThis.self={postMessage:message=>messages.push(message)};
 await import('../web/engine/forecast-worker.js');
 await self.onmessage({data:{words:initial,horizon:1}});
 assert.equal(messages.at(-1).status,'safe',JSON.stringify(messages.at(-1)));
} finally {globalThis.fetch=previousFetch;globalThis.self=previousSelf;}
const {adaptEngine}=await import('../web/engine/wasm.js');
const presented=adaptEngine((await WebAssembly.instantiate(bytes)).instance.exports);
presented.game_init(1);
for(let step=0;step<100;step++) {
 assert.deepEqual(presented.exportState(),raw.exportState());
 const snapshot=raw.snapshot();
 assert.deepEqual(Array.from(presented.snapshot()),Array.from(snapshot));
 assert.equal(presented.snapshot().solidRotations.length,27);
 if(snapshot[S.OVER])break;
 const pending=snapshot[S.PENDING_FACES],wins=snapshot[S.WINNING_MOVES];
 const method=pending?'game_choose':step%17===0?'game_hold':'game_turn';
 const arg=pending?Math.log2(pending&-pending):wins?Math.log2(wins&-wins):step%30;
 assert.equal(presented[method](arg),raw[method](arg));
 assert.deepEqual(presented.exportState(),raw.exportState());
 if(step%13===8)assert.equal(presented.game_undo(),raw.game_undo());
}
// Returned buffers must remain detached from future engine mutations/memory growth.
const held=raw.snapshot(),copy=held.slice();raw.game_init(77);assert.deepEqual(Array.from(held),Array.from(copy));

console.log('PASS: real forecast worker uses pure transport; presentation preserves commands/state and copied buffers survive mutation.');

