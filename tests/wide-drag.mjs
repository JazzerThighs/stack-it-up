import assert from 'node:assert/strict';
import {installCubeDrag, sliceCandidates} from '../web/input/drag.js';
const keys={};
globalThis.document={addEventListener(type,fn){keys[type]=fn;}};
function setup(wide=false){
  const events={}, moves=[];
  const r={wideTurns:wide,unit:100,orientation:[1,0,0,0,1,0,0,0,1],
    project:p=>p,setState(){},canvas:{getBoundingClientRect:()=>({left:0,top:0,width:600,height:600}),
      addEventListener:(t,f)=>events[t]=f,setPointerCapture(){}}};
  let busy=false,orbits=0;
  installCubeDrag(r,()=>orbits++,{state:[],get busy(){return busy;},setBusy:v=>busy=v,
    play:async m=>{moves.push(m);busy=false;},invalidate(){},animate:async(_,f)=>f(1)});
  const event=(extra={})=>({pointerId:1,pointerType:'mouse',button:0,clientX:400,clientY:230,preventDefault(){},...extra});
  return {r,events,moves,event,orbits:()=>orbits};
}
for(const [toggle,shift,alt,expected] of [[false,false,false,false],[false,true,false,true],[false,false,true,true],[true,false,false,true],[true,true,false,true]]){
  const s=setup(toggle), e=s.event({shiftKey:shift,altKey:alt});
  s.events.pointermove(e);assert.equal(s.r.hover.wide,expected);
  s.events.pointerdown(e);s.events.pointermove({...e,clientX:580});s.events.pointerup(e);
  assert.equal(s.moves.length,1);assert.equal(s.moves[0]%15>=9,expected);assert.equal(s.orbits(),0);
}
const s=setup();s.events.pointermove(s.event());keys.keydown({key:'Shift',shiftKey:true});assert(s.r.hover.wide);
keys.keyup({key:'Shift',shiftKey:false});assert(!s.r.hover.wide);
const middle=sliceCandidates(s.r,{axis:2,p:[0,0,1.5]},true);
assert(middle.every(c=>c.base>=6&&c.base<=8&&!c.wide));
const cancel=setup(true);cancel.events.pointerdown(cancel.event());cancel.events.pointermove(cancel.event({clientX:550}));cancel.events.pointercancel(cancel.event());assert.equal(cancel.moves.length,0);
const orbit=setup(true);orbit.events.pointerdown(orbit.event({button:2}));orbit.events.pointermove(orbit.event({clientX:550}));orbit.events.pointerup(orbit.event());assert.equal(orbit.moves.length,0);assert.equal(orbit.orbits(),1);
console.log('PASS: regular/wide/Shift/Alt drags, live hover modifiers, inner slices, cancellation and right-drag orbit.');
