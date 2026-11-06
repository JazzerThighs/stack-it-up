import assert from 'node:assert/strict';
import {orbitSettings as s,pointerOrbitAction,setOrbitSetting} from '../web/input/orbit-settings.js';
import {installCubeDrag} from '../web/input/drag.js';
assert.equal(s.mouseLeft,'turn');assert.equal(s.mouseRight,'free');assert.equal(s.mouseBoth,'xyz');assert(s.mouseBothEnabled);
globalThis.document={addEventListener(){}};let frames=[];globalThis.requestAnimationFrame=f=>frames.push(f);let clock=0;
function flush(){let n=0;while(frames.length){assert(n++<400);clock+=16;const batch=frames;frames=[];batch.forEach(f=>f(clock));}}
function run({button=0,hit=true,chord=false,right='free',left='turn',both='xyz',enabled=true}){
 Object.assign(s,{mouseLeft:left,mouseRight:right,mouseBoth:both,mouseBothEnabled:enabled,orbitSnap:false,orbitSmoothing:0});
 const events={},moves=[],orbits=[];let busy=false;
 const r={orientation:[1,0,0,0,1,0,0,0,1],canvas:{getBoundingClientRect:()=>({left:0,top:0,width:500,height:500}),style:{},addEventListener:(k,f)=>events[k]=f,setPointerCapture(){}},unit:100,pickHit:()=>hit?{axis:2,p:[0,0,1.5]}:null,setState(){},sliceCandidates:()=>[{base:0,baseSign:1,vx:1,vy:0}]};
 installCubeDrag(r,(x,y,m)=>{if(m||x||y)orbits.push(m?'smooth':'free');if(m)r.orientation=m;},{state:[],get busy(){return busy;},setBusy:v=>busy=v,invalidate(){},play:async m=>{moves.push(m);busy=false;}});
 const e={pointerId:1,pointerType:'mouse',button,buttons:button===2?2:1,clientX:0,clientY:0,preventDefault(){}};
 events.pointerdown(e);if(chord)events.pointermove({...e,buttons:3});
 events.pointermove({...e,buttons:chord?3:e.buttons,clientX:100});flush();events.pointerup(e);flush();r.orbitController.dispose();return {moves,orbits};
}
assert.equal(run({}).moves.length,1);
assert.deepEqual(run({hit:false}).orbits,['free']);
assert.deepEqual(run({button:2}).orbits,['free']);
assert(run({chord:true}).orbits.includes('smooth'));
assert.equal(run({chord:true,enabled:false}).moves.length,1);
assert.deepEqual(run({button:2,chord:true,enabled:false}).orbits,['free']);
assert.deepEqual(run({chord:true,both:'free'}).orbits,['free']);
assert(run({button:2,right:'xyz'}).orbits.includes('smooth'));
assert.equal(run({button:2,right:'turn'}).moves.length,1);
assert(run({left:'xyz'}).orbits.includes('smooth'));
assert.equal(run({left:'off'}).orbits.length,0);
assert.equal(run({button:2,right:'off'}).orbits.length,0);
assert(run({left:'off',chord:true}).orbits.includes('smooth'));
Object.assign(s,{mouseLeft:'turn',mouseRight:'free',mouseBothEnabled:true,orbitSettling:true,orbitConfined:true});
assert.equal(pointerOrbitAction({pointerType:'touch',button:0,buttons:1}).outside,'xyz');
setOrbitSetting('mouseRight','smooth');assert.equal(pointerOrbitAction({pointerType:'touch'}).outside,'xyz');
console.log('PASS: independent mouse actions, both-button toggle/remapping, disabled inputs, left/right cube turns, and touch independence.');
