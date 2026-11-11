import assert from 'node:assert/strict';
import {CubeSession} from '../web/explorer/cube-session.js';
const s=new CubeSession();
s.load(Array.from({length:27},(_,piece)=>({piece,color:piece})));
const initial=s.cells,cache=s.turnCache;
assert(!s.undo());s.commit(0);const turned=s.cells;
assert.equal(s.history.length,1);s.undo();assert.equal(s.cells,initial);
s.commit(0);assert.equal(s.cells,turned);s.commit(15);assert.equal(s.cells,initial);
s.reset();assert.equal(s.cells,initial);assert.equal(s.turnCache,cache);
s.commit(0);s.checkpoint();const floor=s.cells;
assert(!s.undo());assert.notEqual(s.turnCache,cache);
s.commit(2);s.undo();assert.equal(s.cells,floor);s.commit(2);s.reset();assert.equal(s.cells,floor);
// Recoloring transforms the whole reachable branch graph, preserving aliases.
s.commit(2);const old=s.cells;s.mapCells(cells=>cells.map(c=>Object.defineProperties({}, {...Object.getOwnPropertyDescriptors(c),color:{value:99,enumerable:true}})));
const colored=s.cells;assert.notEqual(colored,old);assert(colored.every(c=>c.color===99));
s.undo();s.commit(2);assert.equal(s.cells,colored);assert(!Object.keys(colored[0]).includes('assemblyOrigin'));
s.rebaseInitial();assert.deepEqual(s.initial,s.cells);assert.notEqual(s.initial,s.cells);
s.load(initial);assert.equal(s.history.length,0);assert.notEqual(s.cells,floor);assert(!s.undo());
console.log('PASS: cube history, generated undo floor, reset, inverse/branch cache reuse and recoloring preserve session invariants.');
