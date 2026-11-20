import assert from 'node:assert/strict';
import {createBluetoothCube,faceMoves,ganQuaternion} from '../web/input/bluetooth-cube.js';
import {matrix,axisAngle} from '../web/input/orbit-math.js';
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
  f.cube.beginCalibration();
  for (const face of ['U','F','R']) { f.cube.captureFace(face); f.emit({type:'MOVE',move:faces[face]}); }
  f.emit({type:'GYRO',quaternion:{x:0,y:0,z:0,w:1}});
  f.cube.markDragged();
  assert.equal(f.cube.confirmCalibration(),true);
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
f.cube.recenter();f.emit({type:'GYRO',quaternion:{x:0,y:0,z:1,w:0}});
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
assert.equal(c.cube.recenter(),false,'Recenter requires completed calibration');
c.emit({type:'MOVE',move:'R'});assert.deepEqual(c.moves,[]);
c.enable(true);c.cube.beginCalibration();
for (const face of ['U','F','R']) {c.cube.captureFace(face);c.emit({type:'MOVE',move:face});}
assert.equal(c.cube.confirmCalibration(),false,'Manual drag is required');
c.cube.markDragged();assert.equal(c.cube.confirmCalibration(),false,'Gyro sample is required');
calibrate(c,{U:'F',F:'D',R:'R'});
assert.deepEqual(c.moves,[],'Calibration turns never enter gameplay');
c.emit({type:'MOVE',move:"F'"});await tick();assert.deepEqual(c.moves,[15]);
assert.equal(c.cube.recenter(),true);
c.emit({type:'GYRO',quaternion:{x:0,y:0,z:1,w:0}});
c.rotations.at(-1).forEach((v,i)=>assert.ok(Math.abs(v-c.view[i])<1e-10));
assert.deepEqual(c.moves,[15],'Recentering does not mutate the puzzle');
c.emit({type:'MOVE',move:'D'});await tick();assert.deepEqual(c.moves,[15,2],'Recentering preserves calibrated face mapping');
c.cube.suspend();c.cube.beginCalibration();assert.equal(c.statuses.at(-1).calibration,'ready');
await c.cube.disconnect();await c.cube.connect();assert.equal(c.statuses.at(-1).calibration,'pending');
c.cube.beginCalibration();c.cube.setMode('manual');assert.equal(c.cube.calibrating,false);
assert.equal(c.cube.recenter(),false,'Disconnected recenter is ignored');
console.log('Bluetooth mapping, calibration, queue, connection lifecycle and failure diagnostics passed');

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
  clock+=10;f.emit({type:'MOVE',move:"L'",cubeTimestamp:110});await tick();
  const pair=pairedSlice(4,20);assert.deepEqual(f.moves,[pair.move]);
  f.emit({type:'MOVE',move:'U'});flush();await tick();
  assert.equal(f.moves.at(-1),correctedFace(0,pair.rotation));
  f.cube.recenter();f.emit({type:'GYRO',quaternion:{x:0,y:0,z:0,w:1}});
  f.rotations.at(-1).forEach((v,i)=>assert.ok(Math.abs(v-f.view[i])<1e-8));
  const count=f.moves.length;
  for(const cancel of [()=>f.cube.suspend(),()=>{f.enable(false);},()=>f.cube.recalibrate()]) {
    f.emit({type:'MOVE',move:'F'});cancel();flush();await tick();assert.equal(f.moves.length,count);f.enable(true);
  }
  calibrate(f);
  // Use the fixture's deferred gate shape, as for rule/bandage rejection above.
  f.gate({promise:Promise.resolve(false)});
  f.emit({type:'MOVE',move:'R',cubeTimestamp:200});
  clock+=10;f.emit({type:'MOVE',move:"L'",cubeTimestamp:210});
  f.emit({type:'MOVE',move:'U'});await tick();flush();await tick();
  assert.equal(f.moves.length,count+1,'Rejected slice clears even the held unmatched turn');
  f.gate(null);f.emit({type:'MOVE',move:'U'});flush();await tick();assert.equal(f.moves.at(-1),0);
  f.emit({type:'MOVE',move:'F'});await f.cube.disconnect();flush();assert.equal(f.moves.at(-1),0);
}
console.log('Bluetooth paired command, frame correction, rejection, recenter and pending cancellation passed');
