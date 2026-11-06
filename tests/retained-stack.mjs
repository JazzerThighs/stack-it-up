import assert from 'node:assert/strict';
import {seedStackShapes,applyStackShapeEvent,moveFreedShapes} from '../web/engine/stack-shapes.js';
import {retainedStack} from '../web/render/retained-stack.js';
const generate=()=>{throw Error('Angular geometry needs no Wasm');};
const start=new Uint32Array(226),mask=[0,1,3,4].reduce((m,i)=>m|1<<i,0);
for(const i of [0,1,3,4]){start[i]=1;start[27+i]=7;}
let shapes=seedStackShapes(start);start.stackShapes=shapes.stack;
const original=retainedStack(start,generate,'angular');
const event=(kind,board,mask,origins=Array.from({length:27},(_,i)=>i))=>({kind,board:board.slice(0,27),ids:board.slice(27,54),mask,origins});
const cut=start.slice();cut[0]=cut[27]=0;
shapes=applyStackShapeEvent(shapes,event(2,cut,1));cut.stackShapes=shapes.stack;
const pieces=retainedStack(cut,generate,'angular');assert.deepEqual(pieces.fragments[1],original.fragments[1]);assert(!pieces.joined(1,2,-1));
const fall=cut.slice();fall[1]=fall[28]=0;fall[10]=1;fall[37]=7;const origins=Array.from({length:27},(_,i)=>i);origins[10]=1;
shapes=applyStackShapeEvent(shapes,event(3,fall,1<<10,origins));fall.stackShapes=shapes.stack;
assert.equal(shapes.stack[10].origin,1);assert.equal(shapes.stack[10].source.mask,mask);
assert.equal(retainedStack(fall,generate,'angular').fragments[10].length,original.fragments[1].length);
const release=fall.slice();release[10]=release[37]=0;
shapes=applyStackShapeEvent(shapes,event(5,release,1<<10));assert.equal(shapes.floating[10].origin,1);
shapes=moveFreedShapes(shapes,7);const dest=shapes.floating.findIndex(Boolean);assert(dest>=0);
const lock=release.slice();lock[dest]=2;lock[27+dest]=8;
shapes=applyStackShapeEvent(shapes,event(4,lock,1<<dest));lock.stackShapes=shapes.stack;
assert.equal(shapes.stack[dest].source.mask,mask);assert.equal(shapes.stack[dest].origin,1);
const recolored=retainedStack(lock,generate,'angular');assert.equal(recolored.fragments[dest].length,original.fragments[1].length);assert(recolored.mesh().every(Number.isFinite));
assert(shapes.floating.every(c=>!c));
// A new placement owns new geometry even if the native ID is reused later.
const replaced=applyStackShapeEvent(shapes,event(1,lock,1<<dest));assert.notEqual(replaced.stack[dest].source,shapes.stack[dest].source);
assert.equal(start.stackShapes[0].origin,0);assert.equal(start.stackShapes[0].source.mask,mask);
console.log('PASS: stack cuts retain geometry, gravity transports provenance, released/rotated/recolored groups relock with original surfaces; earlier snapshots remain immutable.');
