import assert from 'node:assert/strict';
import {cubeRotations,quaternion,matrix,multiply,axisAngle,identity,distance,snapTarget,dragAxis,dragRotation,frontFace,applyDragRotation,captureSectors,viewAxisFrame} from '../web/input/orbit-math.js';
import {orbitSettings as settings} from '../web/input/orbit-settings.js';
import {createSettlingOrbit} from '../web/input/settling-orbit.js';
import {installCubeDrag} from '../web/input/drag.js';
assert.equal(settings.orbitConfined,true);assert.equal(settings.orbitSettling,true);
settings.orbitConfined=false;
const close=(a,b,e=1e-6)=>assert(Math.abs(a-b)<e,`${a} != ${b}`);
assert.equal(cubeRotations.length,24);
for(const m of cubeRotations)matrix(quaternion(m)).forEach((v,i)=>close(v,m[i]));
const tilted=multiply(axisAngle([1,2,3],1.7),axisAngle([0,1,0],2.1));
for(const q of [identity,tilted,...cubeRotations.map(quaternion)]){
 const s=snapTarget(q,{...settings,orbitHorizontal:23,orbitVertical:-17,orbitRoll:12});
 close(s.error,distance(q,s.q));
 const m=matrix(s.q),n=m.slice(s.face.axis*3,s.face.axis*3+3).map(v=>v*s.face.sign);
 close(Math.atan2(n[0],n[2])*180/Math.PI,23);close(Math.asin(n[1])*180/Math.PI,-17);
}
// Regression: a ten-degree orbit past a 40-degree resting yaw must return
// to that resting pose, even though another face is now nearer the camera.
const rad=Math.PI/180,yawSettings={...settings,orbitHorizontal:40,orbitVertical:0,orbitRoll:0};
const restingYaw=axisAngle([0,1,0],40*rad),smallOrbit=axisAngle([0,1,0],50*rad);
assert.notDeepEqual(frontFace(matrix(smallOrbit)),{axis:2,sign:1});
close(distance(snapTarget(smallOrbit,yawSettings).q,restingYaw),0);
// The switching boundary is halfway between final poses, not camera normals.
close(distance(snapTarget(axisAngle([0,1,0],84*rad),yawSettings).q,restingYaw),0);
close(distance(snapTarget(axisAngle([0,1,0],86*rad),yawSettings).q,axisAngle([0,1,0],130*rad)),0);
// All tilted/rolled resting poses are stable under small perturbations.
for(const [h,v,r] of [[0,0,0],[40,30,25],[-60,55,-70],[90,-90,180]]){
 const config={...settings,orbitHorizontal:h,orbitVertical:v,orbitRoll:r};
 const tilt=multiply(multiply(axisAngle([0,1,0],h*rad),axisAngle([1,0,0],-v*rad)),axisAngle([0,0,1],r*rad));
 const poses=cubeRotations.map(m=>multiply(tilt,quaternion(m)));
 for(const [i,pose] of poses.entries())for(const axis of [[1,0,0],[0,1,0],[0,0,1]])for(const angle of [-10,0,10]){
  const q=multiply(axisAngle(axis,angle*rad),pose),snap=snapTarget(q,config);
  close(distance(snap.q,pose),0);assert.deepEqual(snap.face,frontFace(cubeRotations[i]));
  close(distance(snapTarget(q.map(v=>-v),config).q,pose),0);
 }
 for(const q of [identity,tilted,multiply(tilted,tilt)]){
  const snap=snapTarget(q,config);
  close(snap.error,Math.min(...poses.map(p=>distance(q,p))));
 }
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
 const frame=viewAxisFrame(tilted),localColumn=[0,1,2].find(i=>Math.abs(frame[i*3+column])===1);
 matrix(local).slice(localColumn*3,localColumn*3+3).forEach((v,i)=>close(v,matrix(tilted)[localColumn*3+i]));
 const screen=applyDragRotation(tilted,dx,dy,axis,{...settings,[key]:false},[1,1]);
 close(distance(screen,multiply(dragRotation(dx,dy,axis,settings,[1,1]),tilted)),0);
 assert(distance(local,screen)>.1);
}
// Every upright orientation (including upside down and swapped faces) must
// produce the same screen-space gesture direction, without tracking face names.
for(const orientation of cubeRotations)for(const axis of ['X','Y','Z']){
 const q=quaternion(orientation),rotation=dragRotation(40,30,axis,settings,[1,1]);
 close(distance(applyDragRotation(q,40,30,axis,settings,[1,1]),multiply(rotation,q)),0);
}
// Keep the selected physical axis throughout a long drag, even across 90 degrees.
const frame=viewAxisFrame(tilted);
let incremental=tilted;
for(let i=0;i<10;i++)incremental=applyDragRotation(incremental,30,0,'Y',settings,[1,0],frame);
close(distance(incremental,applyDragRotation(tilted,300,0,'Y',settings,[1,0],frame)),0);
for(const roll of [false,true]){
 const config={...settings,orbitConfined:true,orbitDiagonalRoll:roll};
 for(let angle=0;angle<360;angle+=.5){const radians=angle*Math.PI/180;assert.notEqual(dragAxis(Math.cos(radians),Math.sin(radians),config),'XY');}
 for(const sector of captureSectors(config)){assert.notEqual(sector.axis,'XY');const mid=(sector.start+sector.end)/2*Math.PI/180;assert.equal(dragAxis(Math.cos(mid),Math.sin(mid),config),sector.axis);}
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
controller.start(0,0);controller.move(100,0);const expected=snapTarget(applyDragRotation(tilted,100,0,'Y',settings),settings).q;controller.release();flush();close(distance(quaternion(renderer.orientation),expected),0);
controller.start(0,0);controller.move(100,0);controller.release();controller.cancel();const before=draws;flush();assert.equal(draws,before);
settings.orbitSnap=false;controller.start(0,0);controller.move(100,0);const previous=quaternion(renderer.orientation);controller.release();flush();close(distance(quaternion(renderer.orientation),applyDragRotation(previous,100,0,'Y',settings)),0);
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
// Mouse chord is reported by pointermove when the second button is pressed.
settings.orbitSettling=true;settings.orbitConfined=true;settings.orbitSnap=false;settings.orbitSmoothing=0;
function orbitGesture(type,chord,touchConfined=true){
 settings.orbitConfined=touchConfined;settings.mouseRight='xyz';
 const events={},r={canvas:{style:{},addEventListener:(t,f)=>events[t]=f,setPointerCapture(){}},orientation:matrix(identity),pickHit:()=>({axis:2,p:[0,0,1.5]}),unit:100,setState(){}};
 let turns=0;
 installCubeDrag(r,(_,__,m)=>r.orientation=m,{state:[],invalidate(){},setBusy(){},play:async()=>turns++});
 // Touch background hit; mouse chord starts as a sticker left-click.
 if(type==='touch')r.pickHit=()=>null;
 const e={button:chord?0:2,buttons:chord?1:2,pointerType:type,pointerId:1,clientX:0,clientY:0,preventDefault(){}};
 events.pointerdown(e);
 if(chord)events.pointermove({...e,buttons:3});
 events.pointermove({...e,buttons:chord?3:2,clientX:100,clientY:40});flush();
 const final=r.orientation.slice();events.pointerup(e);flush();r.orbitController.dispose();assert.equal(turns,0);return quaternion(final);
}
const d=1-24/Math.hypot(100,40),confinedExpected=applyDragRotation(identity,100*d,40*d,'Y',settings,[100,40]);
const freeExpected=applyDragRotation(identity,100*d,40*d,'Y',settings,[100,40]);
close(distance(orbitGesture('mouse',true),confinedExpected),0);
close(distance(orbitGesture('mouse',false),confinedExpected),0);
close(distance(orbitGesture('mouse',false,false),freeExpected),0);
close(distance(orbitGesture('mouse',true,false),confinedExpected),0);
close(distance(orbitGesture('touch',false,true),confinedExpected),0);
close(distance(orbitGesture('touch',false,false),freeExpected),0);
settings.orbitConfined=false;settings.orbitSnap=true;
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
