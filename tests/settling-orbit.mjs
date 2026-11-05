import assert from 'node:assert/strict';
import {cubeRotations,quaternion,matrix,multiply,axisAngle,identity,distance,snapTarget,dragAxis,dragRotation,frontFace,applyDragRotation,captureSectors} from '../web/input/orbit-math.js';
import {orbitSettings as settings} from '../web/input/orbit-settings.js';
import {createSettlingOrbit} from '../web/input/settling-orbit.js';
import {installCubeDrag} from '../web/input/drag.js';
const close=(a,b,e=1e-6)=>assert(Math.abs(a-b)<e,`${a} != ${b}`);
assert.equal(cubeRotations.length,24);
for(const m of cubeRotations)matrix(quaternion(m)).forEach((v,i)=>close(v,m[i]));
const tilted=multiply(axisAngle([1,2,3],1.7),axisAngle([0,1,0],2.1));
for(const q of [identity,tilted,...cubeRotations.map(quaternion)]){
 const s=snapTarget(q,{...settings,orbitHorizontal:23,orbitVertical:-17,orbitRoll:12});
 assert.deepEqual(s.face,frontFace(matrix(q)));
 const m=matrix(s.q),n=m.slice(s.face.axis*3,s.face.axis*3+3).map(v=>v*s.face.sign);
 close(Math.atan2(n[0],n[2])*180/Math.PI,23);close(Math.asin(n[1])*180/Math.PI,-17);
}
assert.equal(dragAxis(100,2,settings),'Y');assert.equal(dragAxis(2,100,settings),'X');assert.equal(dragAxis(100,100,settings),'Z');
const step=dragRotation(100,0,'Y',settings);
// Pre-multiplication keeps horizontal rotations camera-relative at every orientation.
const rotated=matrix(multiply(step,tilted)),m=matrix(tilted),r=matrix(step);
for(let c=0;c<3;c++)for(let row=0;row<3;row++)close(rotated[c*3+row],r[row]*m[c*3]+r[3+row]*m[c*3+1]+r[6+row]*m[c*3+2]);
let q=tilted;for(let i=0;i<10000;i++)q=multiply(dragRotation(2,1,'XY',settings),q);close(Math.hypot(...q),1);
for(const [axis,key,column,dx,dy]of [['X','orbitCubeLR',0,0,100],['Y','orbitCubeUD',1,100,0],['Z','orbitCubeFB',2,100,100]]){
 assert.equal(settings[key],true);
 const local=applyDragRotation(tilted,dx,dy,axis,settings,[1,1]);
 // The physical center-to-center axis remains stationary during its rotation.
 matrix(local).slice(column*3,column*3+3).forEach((v,i)=>close(v,matrix(tilted)[column*3+i]));
 const screen=applyDragRotation(tilted,dx,dy,axis,{...settings,[key]:false},[1,1]);
 close(distance(screen,multiply(dragRotation(dx,dy,axis,settings,[1,1]),tilted)),0);
 assert(distance(local,screen)>.1);
}
for(const tolerance of [0,18,30,40])for(const roll of [false,true]){
 const config={...settings,orbitTolerance:tolerance,orbitDiagonalRoll:roll},sectors=captureSectors(config);
 close(sectors.reduce((sum,s)=>sum+s.end-s.start,0),360);
 for(const s of sectors)for(const f of [.1,.5,.9]){const a=(s.start+(s.end-s.start)*f)*Math.PI/180;assert.equal(dragAxis(Math.cos(a),Math.sin(a),config),s.axis);}
}
let frames=[],clock=0;globalThis.requestAnimationFrame=fn=>frames.push(fn);globalThis.document={hidden:false,addEventListener(){}};
const flush=()=>{let n=0;while(frames.length){assert(n++<400);clock+=16;const batch=frames;frames=[];batch.forEach(f=>f(clock));}};
assert.equal(settings.orbitDeadZone,24);
settings.orbitDeadZone=0;settings.orbitSettling=true;let draws=0;
const renderer={orientation:matrix(tilted),canvas:{}},apply=(_,__,m)=>{draws++;renderer.orientation=m;};
const controller=createSettlingOrbit(renderer,apply);
controller.start(0,0);controller.move(100,0);const expected=snapTarget(multiply(tilted,step),settings).q;controller.release();flush();close(distance(quaternion(renderer.orientation),expected),0);
controller.start(0,0);controller.move(100,0);controller.release();controller.cancel();const before=draws;flush();assert.equal(draws,before);
settings.orbitSnap=false;controller.start(0,0);controller.move(100,0);const previous=quaternion(renderer.orientation);controller.release();flush();close(distance(quaternion(renderer.orientation),multiply(previous,step)),0);
// Direction can change inside the dead zone without moving or capturing an axis.
settings.orbitDeadZone=24;settings.orbitAxisLock=true;
renderer.orientation=matrix(identity);const count=draws;
controller.start(0,0);controller.move(20,0);controller.move(0,24);flush();assert.equal(draws,count);
controller.release();flush();assert.equal(draws,count);
controller.start(0,0);controller.move(20,0);controller.move(0,25);flush();
close(distance(quaternion(renderer.orientation),dragRotation(0,1,'X',settings)),0);
// Horizontal input after capture cannot switch the locked vertical axis.
const captured=renderer.orientation.slice();controller.move(40,25);flush();
renderer.orientation.forEach((v,i)=>close(v,captured[i]));controller.cancel();
// A large first event rotates only the distance outside the circle.
renderer.orientation=matrix(identity);controller.start(0,0);controller.move(100,0);controller.release();flush();
close(distance(quaternion(renderer.orientation),dragRotation(76,0,'Y',settings)),0);
controller.dispose();settings.orbitSnap=true;
function gesture(hit,button,readOnly=false){const events={},r={canvas:{style:{},addEventListener:(t,f)=>events[t]=f,setPointerCapture(){}},orientation:matrix(identity),pickHit:()=>hit,orbitOnly:readOnly,unit:100,setState(){},sliceCandidates:()=>[{base:0,baseSign:1,vx:1,vy:0}]};let turns=0,orbits=0;
 installCubeDrag(r,(_,__,m)=>{orbits++;r.orientation=m;},{state:[],invalidate(){},setBusy(){},play:async()=>turns++,animate:async(_,f)=>f(1)});
 const e={button,pointerId:1,clientX:0,clientY:0,preventDefault(){}};events.pointerdown(e);events.pointermove({...e,clientX:100});events.pointerup(e);flush();r.orbitController.dispose();return {turns,orbits};}
assert.equal(gesture({axis:2,p:[0,0,1.5]},0).turns,1);
assert.equal(gesture({axis:2,p:[0,0,1.5]},0).orbits,0);
assert(gesture(null,0).orbits>0);assert(gesture({axis:2,p:[0,0,1.5]},2).orbits>0);
assert.equal(gesture({axis:2,p:[0,0,1.5]},0,true).orbits,0);
// Guide is static at the start point and removed on release/cancel.
const nodes=[];
document.createElementNS=(_,name)=>({name,attrs:{},style:{},classList:{add(){}},children:[],setAttribute(k,v){this.attrs[k]=v;},append(el){this.children.push(el);},remove(){this.removed=true;}});
const host={scrollLeft:0,scrollTop:0,getBoundingClientRect:()=>({left:10,top:20}),append:el=>nodes.push(el)};
const canvas={parentElement:host,getBoundingClientRect:()=>({left:10,top:20,width:500,height:500})};
const guided=createSettlingOrbit({canvas,orientation:matrix(identity)},()=>{});
guided.start(200,220);assert.equal(nodes.length,1);assert(nodes[0].children.some(n=>n.name==='line'));assert.equal(nodes[0].children.find(n=>n.attrs['data-orbit-dead-zone']==='true').attrs.r,'24');
guided.move(250,220);flush();assert.equal(nodes.length,1);guided.release();assert(nodes[0].removed);flush();
guided.start(200,220);guided.cancel();assert(nodes[1].removed);
settings.orbitDragGuide=false;guided.start(200,220);assert.equal(nodes.length,2);guided.dispose();settings.orbitDragGuide=true;
settings.orbitSettling=false;
console.log('PASS: per-axis cube/window rotation, exact capture sectors, static guide lifecycle, quaternion stability, 24 orientations, face target angles, smooth release, cancellation and cube/background gesture boundaries.');
