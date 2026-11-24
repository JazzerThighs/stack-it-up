import assert from 'node:assert/strict';
import {createBluetoothCube,faceMoves,ganQuaternion} from '../web/input/bluetooth-cube.js';
import {matrix,axisAngle,quaternion,distance,slerp} from '../web/input/orbit-math.js';
import {calibrationFrame} from '../web/input/cube-calibration.js';
import {pairedSlice,correctedFace} from '../web/input/slice-pairing.js';

for (const [face,index] of Object.entries({U:0,D:1,F:2,B:3,R:4,L:5})) {
  assert.deepEqual(faceMoves(face),[index]);
  assert.deepEqual(faceMoves(face+"'"),[index+15]);
  assert.deepEqual(faceMoves(face+'2'),[index,index]);
}
for(const bad of ['M','x','Rw','',"U3"])assert.deepEqual(faceMoves(bad),[]);
assert.equal(ganQuaternion({x:0,y:0,z:0,w:0}),null);
assert.equal(ganQuaternion({x:NaN,y:0,z:0,w:1}),null);
assert.deepEqual(ganQuaternion({x:0,y:0,z:0,w:2}),[-0,0,0,1]);
// Physical red/right, blue/back and white/up axes follow renderer face normals.
assert.deepEqual(ganQuaternion({x:1,y:0,z:0,w:0}),[-1,0,0,0]);
assert.deepEqual(ganQuaternion({x:0,y:1,z:0,w:0}),[-0,0,1,0]);
assert.deepEqual(ganQuaternion({x:0,y:0,z:1,w:0}),[-0,1,0,0]);
const tick = () => new Promise(resolve=>setImmediate(resolve));
const deferred = () => {let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fixture(options={}) {
  let observer, enabled=true, gate, pending, closed=0, unsubscribed=0, clock=0;
  const moves=[], rotations=[], statuses=[];
  const view=matrix(axisAngle([1,0,0],.3));
  const connection={deviceName:'GAN16ui',events$:{subscribe(o){observer=o;return {unsubscribe(){unsubscribed++;}};}},async disconnect(){closed++;}};
  const cube=createBluetoothCube({connect:()=>pending?.promise??Promise.resolve(connection),now:()=>clock,
    active:()=>enabled, play:async m=>{moves.push(m);return gate?await gate.promise:true;},
    orientation:()=>view,rotate:m=>rotations.push(m),status:s=>statuses.push(s),...options});
  return {cube,connection,moves,rotations,statuses,view,emit:e=>observer.next(e),
    enable:v=>enabled=v,gate:v=>gate=v,pending:v=>pending=v,advance:v=>clock+=v,
    get closed(){return closed;},get unsubscribed(){return unsubscribed;}};
}
function calibrate(f, faces={U:'U',F:'F',R:'R'}) {
  f.cube.recalibrate();f.cube.beginCalibration();
  for (const face of ['U','F','R']) { f.emit({type:'MOVE',move:faces[face]}); f.emit({type:'MOVE',move:faces[face]+"'"}); }
  f.emit({type:'GYRO',quaternion:{x:0,y:0,z:0,w:1}});
  f.cube.markDragged();
  assert.equal(f.cube.confirmCalibration(),true);
  f.rotations.length=0;
}
function resetGyro(f,q={x:0,y:0,z:0,w:1}) {
 assert(f.cube.resetGyro());f.emit({type:'GYRO',quaternion:q});f.cube.markDragged();assert(f.cube.confirmCalibration());
}
const f=fixture();f.cube.setMode('bluetooth');await f.cube.connect();calibrate(f);
const g=deferred();f.gate(g);f.emit({type:'MOVE',move:'R'});f.emit({type:'MOVE',move:"U'"});
assert.deepEqual(f.cube.animationBacklog,{playing:true,pending:1,oldestAge:0});
f.advance(80);assert.equal(f.cube.animationBacklog.oldestAge,80);
assert.deepEqual(f.moves,[4]);g.resolve(true);await tick();assert.deepEqual(f.moves,[4,15]);
assert.deepEqual(f.cube.animationBacklog,{playing:false,pending:0,oldestAge:0});
f.gate(null);
f.emit({type:'GYRO',quaternion:{x:0,y:0,z:0,w:1}});
f.rotations[0].forEach((v,i)=>assert.ok(Math.abs(v-f.view[i])<1e-10));
f.emit({type:'GYRO',quaternion:{x:0,y:0,z:Math.SQRT1_2,w:Math.SQRT1_2}});
assert.notDeepEqual(f.rotations[1],f.view);
resetGyro(f,{x:0,y:0,z:1,w:0});f.emit({type:'GYRO',quaternion:{x:0,y:0,z:1,w:0}});
f.rotations.at(-1).forEach((v,i)=>assert.ok(Math.abs(v-f.view[i])<1e-10));
f.enable(false);f.emit({type:'MOVE',move:'F'});assert.deepEqual(f.moves,[4,15]);
f.enable(true);const g2=deferred();f.gate(g2);
f.emit({type:'MOVE',move:'B'});f.emit({type:'MOVE',move:'L'});f.cube.suspend();g2.resolve(true);await tick();
assert.deepEqual(f.moves,[4,15,3]);
f.cube.setMode('manual');await tick();f.emit({type:'MOVE',move:'U'});
assert.deepEqual(f.moves,[4,15,3]);assert.equal(f.closed,1);assert.equal(f.unsubscribed,1);
const late=fixture(),d=deferred();late.pending(d);late.cube.setMode('bluetooth');
const connecting=late.cube.connect();late.cube.setMode('manual');d.resolve(late.connection);await connecting;
assert.equal(late.closed,1);assert.equal(late.statuses.at(-1).mode,'manual');
const rejected=fixture();rejected.cube.setMode('bluetooth');await rejected.cube.connect();calibrate(rejected);
const rejectGate=deferred();rejected.gate(rejectGate);rejected.emit({type:'MOVE',move:'U'});rejected.emit({type:'MOVE',move:'D'});
rejectGate.resolve(false);await tick();assert.deepEqual(rejected.moves,[0]);
rejected.emit({type:'DISCONNECT'});await tick();assert.equal(rejected.closed,1);
// An immediate browser rejection must not be presented as a user cancellation.
for (const stage of [null, 'Connecting.']) {
  const statuses = [];
  let attempted = false, availabilityChecked = false;
  const cube = createBluetoothCube({
    connect: progress => {
      attempted = true;
      assert.equal(availabilityChecked, false, 'Do not await adapter checks before opening the picker');
      if (stage) progress(stage);
      throw new DOMException('Bluetooth adapter not available', 'NotFoundError');
    },
    availability: async () => { availabilityChecked = true; return false; },
    status: s => statuses.push(s),
  });
  cube.setMode('bluetooth');
  const attempt = cube.connect();
  assert.equal(attempted, true, 'Picker must be called synchronously from the click');
  await attempt;
  const result = statuses.at(-1);
  assert.equal(result.connecting, false);
  assert.equal(result.connected, false);
  assert.ok(result.message.includes(stage || 'Opening Bluetooth picker'));
  assert.match(result.message, /NotFoundError: Bluetooth adapter not available/);
  assert.match(result.message, /browser reports Bluetooth unavailable/);
  assert.doesNotMatch(result.message, /Pairing cancelled/);
  availabilityChecked = false;
  await cube.connect(); // Failure leaves Connect usable.
}
// A late adapter diagnostic cannot overwrite a subsequent mode change.
{
  const statuses = [], check = deferred();
  const cube = createBluetoothCube({connect: () => Promise.reject(new Error('Original failure')),
    availability: () => check.promise, status: s => statuses.push(s)});
  cube.setMode('bluetooth');
  const attempt = cube.connect();
  await tick();
  cube.setMode('manual');
  check.resolve(false);
  await attempt;
  assert.equal(statuses.at(-1).message, 'Manual controls active.');
}
// Exactly the 24 rigid cube orientations are valid; mirrored frames are rejected.
let frames=0;
for (const U of 'UDFBRL') for (const F of 'UDFBRL') for (const R of 'UDFBRL') {
  const frame=calibrationFrame({U,F,R});
  if (!frame) continue;
  frames++;
  assert.equal(new Set(Object.values(frame.mapping)).size,6);
  assert.equal(frame.mapping[U],'U'); assert.equal(frame.mapping[F],'F'); assert.equal(frame.mapping[R],'R');
}
assert.equal(frames,24);
assert.equal(calibrationFrame({U:'U',F:'F',R:'L'}),null);
const c=fixture();c.cube.setMode('bluetooth');await c.cube.connect();
c.enable(false);c.cube.beginCalibration();
assert.equal(c.statuses.at(-1).calibration,'pending');
assert.equal(c.cube.resetGyro(),false,'Recenter requires completed calibration');
c.emit({type:'MOVE',move:'R'});assert.deepEqual(c.moves,[]);
c.enable(true);c.cube.beginCalibration();
for (const face of ['U','F','R']) {c.emit({type:'MOVE',move:face});c.emit({type:'MOVE',move:face+"'"});}
assert.equal(c.cube.confirmCalibration(),false,'Manual drag is required');
c.cube.markDragged();assert.equal(c.cube.confirmCalibration(),false,'Gyro sample is required');
calibrate(c,{U:'F',F:'D',R:'R'});
assert.deepEqual(c.moves,[],'Calibration turns never enter gameplay');
c.emit({type:'MOVE',move:"F'"});await tick();assert.deepEqual(c.moves,[15]);
resetGyro(c,{x:0,y:0,z:1,w:0});
c.emit({type:'GYRO',quaternion:{x:0,y:0,z:1,w:0}});
c.rotations.at(-1).forEach((v,i)=>assert.ok(Math.abs(v-c.view[i])<1e-10));
assert.deepEqual(c.moves,[15],'Recentering does not mutate the puzzle');
c.emit({type:'MOVE',move:'D'});await tick();assert.deepEqual(c.moves,[15,2],'Recentering preserves calibrated face mapping');
c.cube.suspend();c.cube.beginCalibration();assert.equal(c.statuses.at(-1).calibration,'ready');
await c.cube.disconnect();await c.cube.connect();assert.equal(c.statuses.at(-1).calibration,'pending');
c.cube.beginCalibration();c.cube.setMode('manual');assert.equal(c.cube.calibrating,false);
assert.equal(c.cube.resetGyro(),false,'Disconnected recenter is ignored');
console.log('Bluetooth mapping, calibration, queue, connection lifecycle and failure diagnostics passed');

function rightSliceGyro(f) {
  const [x,y,z,w]=pairedSlice(4,20).rotation;
  f.emit({type:'GYRO',quaternion:{x,y:-z,z:-y,w}});
}
// Pairing goes through one ordinary command, and only accepted pairs change
// the logical frame. Timers cannot replay suspended/disconnected gestures.
{
  let clock=0,id=0;const timers=new Map();
  const f=fixture({sliceWindow:()=>40,now:()=>clock,
    setTimer:fn=>{timers.set(++id,fn);return id;},cancelTimer:id=>timers.delete(id)});
  const flush=()=>{clock+=40;for(const fn of [...timers.values()])fn();};
  f.cube.setMode('bluetooth');await f.cube.connect();calibrate(f);
  f.emit({type:'MOVE',move:'R',cubeTimestamp:100});
  assert.deepEqual(f.moves,[]);
  clock+=10;rightSliceGyro(f);f.emit({type:'MOVE',move:"L'",cubeTimestamp:110});await tick();
  const pair=pairedSlice(4,20);assert.deepEqual(f.moves,[pair.move]);
  f.emit({type:'MOVE',move:'U'});flush();await tick();
  assert.equal(f.moves.at(-1),correctedFace(0,pair.rotation));
  resetGyro(f);f.emit({type:'GYRO',quaternion:{x:0,y:0,z:0,w:1}});
  f.rotations.at(-1).forEach((v,i)=>assert.ok(Math.abs(v-f.view[i])<1e-8));
  const count=f.moves.length;
  for(const cancel of [()=>f.cube.suspend(),()=>{f.enable(false);},()=>f.cube.recalibrate()]) {
    f.emit({type:'MOVE',move:'F'});cancel();flush();await tick();assert.equal(f.moves.length,count);f.enable(true);
  }
  calibrate(f);
  // Use the fixture's deferred gate shape, as for rule/bandage rejection above.
  f.gate({promise:Promise.resolve(false)});
  f.emit({type:'MOVE',move:'R',cubeTimestamp:200});
  clock+=10;rightSliceGyro(f);f.emit({type:'MOVE',move:"L'",cubeTimestamp:210});
  f.emit({type:'MOVE',move:'U'});await tick();flush();await tick();
  assert.equal(f.moves.length,count+1,'Rejected slice clears even the held unmatched turn');
  f.gate(null);f.emit({type:'MOVE',move:'U'});flush();await tick();assert.equal(f.moves.at(-1),0);
  f.emit({type:'MOVE',move:'F'});await f.cube.disconnect();flush();assert.equal(f.moves.at(-1),0);
}
console.log('Bluetooth paired command, frame correction, rejection, recenter and pending cancellation passed');

// Sensor drift correction changes presentation only, including after a real
// detected slice has changed the discrete frame used for subsequent moves.
{
  const f=fixture({sliceWindow:()=>40});
  f.cube.setMode('bluetooth');await f.cube.connect();calibrate(f);
  f.emit({type:'MOVE',move:'R',cubeTimestamp:100});
  f.advance(10);rightSliceGyro(f);f.emit({type:'MOVE',move:"L'",cubeTimestamp:110});await tick();
  const pair=pairedSlice(4,20);
  const {multiply,quaternion,distance}=await import('../web/input/orbit-math.js');
  const inv=q=>[-q[0],-q[1],-q[2],q[3]];
  const q=multiply(axisAngle([0,1,0],5*Math.PI/180),inv(pair.rotation));
  for(let i=0;i<160;i++){
    f.advance(20);
    f.emit({type:'GYRO',quaternion:{x:-q[0],y:q[2],z:q[1],w:q[3]}});
  }
  assert(distance(quaternion(f.rotations.at(-1)),quaternion(f.view))<.1*Math.PI/180);
  assert.deepEqual(f.moves,[pair.move],'orientation settling never sends a game turn');
  f.emit({type:'MOVE',move:'U'});f.advance(50);await new Promise(r=>setTimeout(r,60));
  assert.equal(f.moves.at(-1),correctedFace(0,pair.rotation),'drift offset never remaps logical faces');
  await f.cube.disconnect();
}
console.log('PASS: post-slice neutral convergence preserves game commands and calibrated face mapping.');

// A late MOVE may arrive after the spring has started chasing the turning
// core. Landing must cancel that momentum before the engine animation resolves.
for(const kind of ['slice','wide']){
  let clock=0, callback, view=matrix([0,0,0,1]);
  const f=fixture({now:()=>clock,sliceWindow:()=>kind==='slice'?80:0,wideWindow:()=>120,
    requestFrame:fn=>{callback=fn;return 1;},cancelFrame:()=>{callback=null;},
    orientation:()=>view,rotate:m=>{view=m;}});
  f.cube.setMode('bluetooth');await f.cube.connect();calibrate(f);
  const grip=quaternion(view), gate=deferred();f.gate(gate);
  const emitGyro=q=>f.emit({type:'GYRO',quaternion:{x:-q[0],y:q[2],z:q[1],w:q[3]}});
  const end=pairedSlice(4,20).rotation.map((v,i)=>i<3?-v:v);
  function step(ms){clock+=ms;const fn=callback;callback=null;fn?.(clock);}
  emitGyro([0,0,0,1]);step(1);
  emitGyro(slerp([0,0,0,1],end,.5));step(12);step(12);
  assert(distance(grip,quaternion(view))>0,'physical motion starts before the face report');
  f.emit({type:'MOVE',move:'R',cubeTimestamp:100});
  if(kind==='slice'){step(5);f.emit({type:'MOVE',move:"L'",cubeTimestamp:105});}
  step(5);emitGyro(end);
  assert.equal(f.moves.length,1);
  let previous=distance(grip,quaternion(view));
  for(let i=0;i<75;i++){
    step(16);emitGyro(end);
    const error=distance(grip,quaternion(view));
    assert(error<=previous+1e-7,kind+' must return without swinging outward');previous=error;
  }
  assert(previous<.001,kind+' returns to the pre-gesture grip while play is pending');
  gate.resolve(true);await tick();step(16);
  assert(distance(grip,quaternion(view))<.001,'engine completion cannot apply a second visual turn');
  await f.cube.disconnect();
}

// Real scheduler path: one packet continues moving between frames; suspending
// cancels old motion and disabling smoothing restores direct sensor following.
{
 const frames=new Map();let next=0,enabled=true;
 const f=fixture({smoothing:()=>enabled,neutralTolerance:()=>0,
  requestFrame:fn=>{frames.set(++next,fn);return next;},cancelFrame:id=>frames.delete(id)});
 const step=time=>{const pending=[...frames.values()];frames.clear();for(const fn of pending)fn(time);};
 f.cube.setMode('bluetooth');await f.cube.connect();calibrate(f);
 f.emit({type:'GYRO',quaternion:{x:0,y:0,z:Math.SQRT1_2,w:Math.SQRT1_2}});
 assert.equal(f.rotations.length,0,'gyro packet schedules presentation instead of jumping');
 step(0);step(16);const early=f.rotations.at(-1);
 step(32);assert.notDeepEqual(f.rotations.at(-1),early,'motion continues without another packet');
 f.cube.suspend();assert.equal(frames.size,0,'suspension cancels queued frames');
 f.emit({type:'GYRO',quaternion:{x:0,y:0,z:0,w:1}});step(1000);
 f.rotations.at(-1).forEach((v,i)=>assert(Math.abs(v-f.view[i])<1e-8,'resume uses visible pose'));
 enabled=false;
 f.emit({type:'GYRO',quaternion:{x:0,y:0,z:Math.SQRT1_2,w:Math.SQRT1_2}});
 assert.equal(frames.size,0);assert.notDeepEqual(f.rotations.at(-1),f.view);
 enabled=true;
 f.emit({type:'GYRO',quaternion:{x:0,y:0,z:0,w:1}});
 assert.equal(frames.size,1);f.cube.resetGyro();assert.equal(frames.size,0);
 await f.cube.disconnect();
}
console.log('PASS: frame-driven gyro continuation, suspension, reset and direct-follow toggle.');

// Guided flow accepts every rigid U/F/R assignment and only advances after
// the matching inverse. Neither calibration mode sends a gameplay command.
{
 const {cubeRotations,quaternion,distance}=await import('../web/input/orbit-math.js');
 for(const U of 'UDFBRL')for(const F of 'UDFBRL')for(const R of 'UDFBRL'){
  if(!calibrationFrame({U,F,R}))continue;
  let view=matrix(axisAngle([1,0,0],.37));
  const f=fixture({orientation:()=>view,rotate:m=>{view=m;}});
  f.cube.setMode('bluetooth');await f.cube.connect();f.cube.beginCalibration();
  f.emit({type:'MOVE',move:U+"'"});assert.equal(f.statuses.at(-1).calibrationStep,0);
  f.emit({type:'MOVE',move:U});
  assert(f.statuses.at(-1).awaitingUndo);
  f.emit({type:'MOVE',move:F+"'"});assert.equal(f.statuses.at(-1).calibrationStep,0);
  f.emit({type:'MOVE',move:U+"'"});
  for(const face of [F,R]){f.emit({type:'MOVE',move:face});f.emit({type:'MOVE',move:face+"'"});}
  assert(f.cube.adjustingNeutral);
  assert.deepEqual(view,[-1,0,0,0,1,0,0,0,-1],'F faces camera with U up');
  assert.equal(f.cube.confirmCalibration(),false,'drag and fresh gyro required');
  view=matrix(axisAngle([1,0,0],.37));f.cube.markDragged();
  f.emit({type:'GYRO',quaternion:{x:0,y:0,z:0,w:1}});assert(f.cube.confirmCalibration());
  assert.deepEqual(f.moves,[]);
  const saved=view.slice();
  assert(f.cube.resetUfr());
  for(const face of [U,F,R]){f.emit({type:'MOVE',move:face});f.emit({type:'MOVE',move:face+"'"});}
  assert.equal(f.statuses.at(-1).calibration,'ready');assert.deepEqual(view,saved,'UFR reset leaves view untouched');
  assert.deepEqual(f.moves,[]);
  assert(f.cube.resetGyro());assert(f.cube.adjustingNeutral);
  f.emit({type:'MOVE',move:F});assert.deepEqual(f.moves,[],'gyro edit consumes turns');
  f.emit({type:'GYRO',quaternion:{x:0,y:0,z:0,w:1}});f.cube.markDragged();assert(f.cube.confirmCalibration());
  f.emit({type:'MOVE',move:F});await tick();assert.deepEqual(f.moves,[2],'gyro reset retains face mapping');
  await f.cube.disconnect();
 }
}
console.log('PASS: guided inverse validation, canonical view and independent UFR/gyro reset across all 24 frames.');

// Calibrate in Game, then send device events to the visible packing cube.
{
  let target;
  const pack = fixture({explorerTurnTarget: () => target, sliceWindow: () => 100, wideWindow: () => 150});
  pack.cube.setMode('bluetooth');
  await pack.cube.connect();
  calibrate(pack, {U:'R', F:'F', R:'D'});
  pack.enable(false);
  const played = [], gate = deferred();
  target = {performTurn: async move => { played.push(move); return gate.promise; }};
  pack.emit({type:'MOVE', move:'R', localTimestamp:10});
  pack.emit({type:'MOVE', move:"L'", localTimestamp:15});
  pack.emit({type:'GYRO', quaternion:{x:0,y:1,z:0,w:0}});
  pack.emit({type:'MOVE', move:'F2', localTimestamp:20});
  assert.deepEqual(played, [0]);
  gate.resolve(true);
  await tick();
  assert.deepEqual(played, [0,16,3,3]);
  assert.deepEqual(pack.moves, []);
  assert.equal(pack.rotations.length, 1);
  assert.notDeepEqual(pack.rotations[0],pack.view);

  const pending = deferred();
  target = {performTurn: () => pending.promise};
  pack.emit({type:'MOVE',move:'R'});
  pack.emit({type:'MOVE',move:'F'});
  target = {performTurn: async move => { played.push(move); return true; }};
  pack.emit({type:'MOVE',move:'D'});
  pending.resolve(true);
  await tick();
  assert.deepEqual(played,[0,16,3,3,5]);
  console.log('PASS: calibrated Explorer face turns, independent opposite turns, doubles and screen switches.');
}

{
  const target = {performTurn: async () => assert.fail('Calibration consumed a puzzle turn')};
  const packing = fixture({explorerTurnTarget: () => target});
  packing.enable(false);
  packing.cube.setMode('bluetooth');
  await packing.cube.connect();
  calibrate(packing);
  assert(packing.cube.resetUfr());
  for (const face of ['U','F','R']) {
    packing.emit({type:'MOVE',move:face});
    packing.emit({type:'MOVE',move:face+"'"});
  }
  assert.equal(packing.statuses.at(-1).calibration,'ready');
  resetGyro(packing);
  const before = packing.rotations.length;
  packing.emit({type:'GYRO',quaternion:{x:0,y:0,z:0,w:1}});
  assert.equal(packing.rotations.length,before+1);
  assert.deepEqual(packing.moves,[]);
  console.log('PASS: full calibration and independent UFR and gyro resets on the packing board.');
}
