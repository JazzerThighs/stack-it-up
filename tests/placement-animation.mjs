import assert from 'node:assert/strict';
import {S} from '../web/engine/snapshot.js';
import {landedState,createAnimations} from '../web/ui/animations.js';
import {turn} from '../web/explorer/model.js';
const before=new Uint32Array(226);before[S.ACTIVE]=15;before[S.PIECE]=1;before[S.FLOATING]=1<<20;before[S.BAND_IDS+20]=1;
for(let move=0;move<30;move++) {
 const cells=Array.from({length:27},(_,i)=>!!(before[S.ACTIVE]&(1<<i)));
 const mask=turn(cells,move).reduce((m,v,i)=>v?m|(1<<i):m,0);
 assert.equal(landedState(before,move)[S.ACTIVE],mask);
}
const board=new Uint32Array(27);for(let i=0;i<4;i++)board[i]=1;
const ids=board.slice(),after=before.slice();after.set(board);after.set(ids,27);after[S.ACTIVE]=1<<26;
const event={kind:1,mask:15,board,ids,floatMask:1<<20,origins:Array.from({length:27},(_,i)=>i)};
let current, inflated=false, sawSource=false;
const renderer={setState(s){current=s.slice();if(!inflated && s[S.ACTIVE]===15)sawSource=true;},stackFrame(from,to,e,t){assert.equal(current[S.ACTIVE],15,'sources persist during inflation');assert.equal(current[0],0,'new stack is not flagged as overlap');assert.equal(t,1);inflated=true;},draw(){}};
globalThis.document={getElementById:()=>({textContent:''})};
const context={animations:{checked:false},renderers:[renderer],state:after,busy:true,invalidate(){},invalidateMesh(){},update(){assert(inflated);assert.equal(current[S.ACTIVE],0,"sources disappear after inflation, before spawning");}};
const animations=createAnimations(context);await animations.resolveAnimations(before,after,[event]);animations.clearGhost();
assert(sawSource);assert(inflated);assert.equal(current[S.ACTIVE],after[S.ACTIVE]);
console.log('PASS: all move orientations and placement inflation before active removal.');
