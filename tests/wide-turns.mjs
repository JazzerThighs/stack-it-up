import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {wideFromFace,wideGyroMatch} from '../web/input/wide-turns.js';
import {createSlicePairing,pairedSlice,correctedFace} from '../web/input/slice-pairing.js';
import {createBluetoothCube} from '../web/input/bluetooth-cube.js';
import {calibrationFrame} from '../web/input/cube-calibration.js';
import {matrix,multiply,quaternion,cubeRotations,axisAngle} from '../web/input/orbit-math.js';
import {turnTransform,transformPoint} from '../web/render/transforms.js';
import {turn} from '../web/explorer/model.js';
import {CubeStack,moveLabels,explorerMoveLabels} from '../web/engine/coordinates.js';
import {adaptTransport} from '../web/engine/transport.js';
import {createGameController} from '../web/game/controller.js';
import {S} from '../web/engine/snapshot.js';
const inverse=q=>[-q[0],-q[1],-q[2],q[3]], identity=[0,0,0,1];
const faces=[...Array(6).keys(),...Array.from({length:6},(_,i)=>i+15)];
const cells=Array.from({length:27},(_,i)=>i);
function rotate(cells,q) {
  const out=[];
  cells.forEach((cell,i)=>{
    const p=transformPoint(CubeStack.xyz(i).map(v=>v-1),{rotation:matrix(q)}).map(v=>Math.round(v)+1);
    out[p[0]*9+p[1]*3+p[2]]=cell;
  });return out;
}
for(const face of faces) {
  const wide=wideFromFace(face), q=inverse(wide.rotation);
  assert(wideGyroMatch(face,identity,q));
  assert(!wideGyroMatch(face,identity,wide.rotation),'Wrong direction is not wide');
  assert(!wideGyroMatch(face,identity,identity),'A face event alone is not wide');
  assert.deepEqual(rotate(turn(cells,wide.move),wide.rotation),turn(cells,face));
  for(const m of cubeRotations) {
    const correction=quaternion(m), mapped=wideFromFace(correctedFace(face,correction));
    assert.deepEqual(rotate(turn(cells,mapped.move),multiply(correction,mapped.rotation)),turn(rotate(cells,correction),face));
  }
}

function detector(slice=40,wide=150,gestureTolerance) {
  let time=0,id=0;const tasks=new Map(),commands=[];
  const options={now:()=>time,setTimer:(f,ms)=>{tasks.set(++id,{f,due:time+ms});return id;},cancelTimer:id=>tasks.delete(id)};
  const d=createSlicePairing({...options,windowMs:()=>slice,wideWindowMs:()=>wide,gestureTolerance,emit:c=>commands.push(c)});
  return {d,commands,options,
    advance(ms){time+=ms;for(const [id,t] of [...tasks])if(t.due<=time){tasks.delete(id);t.f();}},
    move(m,event={}){d.push([m],event);},gyro:q=>d.gyro(q)};
}
const gyro=inverse(wideFromFace(4).rotation);
// Same sensor trace ends 25 degrees short of the expected quarter turn.
for(const degrees of [10,20,25,35]){
  const f=detector(0,150,()=>degrees);f.gyro(identity);f.advance(10);f.move(4);
  const axis=gyro.slice(0,3);
  f.advance(20);f.gyro(axisAngle(axis,65*Math.PI/180));f.advance(150);
  assert.equal(!!f.commands[0].wide,degrees>=25);
}
for(const before of [false,true]) {
  const f=detector();f.gyro(identity);f.advance(10);
  if(before)f.gyro(gyro);
  f.move(4);f.advance(20);if(!before)f.gyro(gyro);
  assert.equal(f.commands.length,0,'Reserve the slice pairing window first');
  f.advance(20);assert.equal(f.commands[0].wide,true);
  f.move(4);f.advance(150);assert.equal(f.commands[1].wide,undefined,'Cannot reuse consumed gyro motion');
}
{
  const f=detector(40,20);f.gyro(identity);f.advance(5);f.move(4);f.advance(5);f.gyro(gyro);f.advance(35);
  assert.equal(f.commands[0].wide,true,'Preserve timely wide evidence while reserving the longer slice window');
}
for(const q of [identity,wideFromFace(4).rotation,axisAngle([0,1,0],Math.PI/2),axisAngle([1,0,0],.2)]) {
  const f=detector();f.gyro(identity);f.advance(10);f.move(4);f.advance(50);f.gyro(q);f.advance(100);
  assert.equal(f.commands[0].wide,undefined,'Reject no motion, inverse motion, wrong axis and small wobble');
}
{
  const f=detector();f.gyro(identity);f.advance(10);f.move(4);f.advance(151);f.gyro(gyro);
  assert.equal(f.commands[0].wide,undefined,'Late gyro cannot change an already committed face');
}
{
  const f=detector(0,0);f.gyro(identity);f.advance(10);f.move(4);f.gyro(gyro);
  assert.equal(f.commands[0].wide,undefined);assert.equal(f.commands.length,1);
}
{
  const f=detector();f.gyro(identity);f.advance(10);f.move(4,{cubeTimestamp:100});f.advance(10);f.gyro(gyro);
  f.move(20,{cubeTimestamp:110});assert.deepEqual(f.commands[0].moves,[4,20]);assert(!f.commands[0].wide,'Slice pair takes precedence');
}
{
  const f=detector();f.gyro(identity);f.advance(10);f.move(4,{localTimestamp:null});f.gyro(gyro);f.advance(150);
  assert(!f.commands[0].wide,'Recovered face timestamps cannot correlate with live gyro');
}
{
  const f=detector();f.gyro(identity);f.advance(10);f.move(4);f.d.clear();f.gyro(gyro);f.advance(150);
  assert.equal(f.commands.length,0,'Cancellation clears the gesture and its gyro history');
}

// Real game controller + compiled engine: one active center, fixed stack marker.
// Ordinary faces cannot change that center, while slices and wide moves do.
const bytes=readFileSync(new URL('../target/wasm32-unknown-unknown/release/cube_stack.wasm',import.meta.url));
const engine=adaptTransport((await WebAssembly.instantiate(bytes)).instance.exports);
const commands=createGameController({engine:()=>engine,state:()=>engine.snapshot(),isBusy:()=>false,
  isStarting:()=>false,isLockMode:()=>false,setBusy:()=>{},copyState:s=>s.slice(),effects:{turn:{}}});
function setup(center) {
  engine.game_init(123);engine.game_set_gravity(0);
  const saved=engine.exportState();
  saved[3]=1<<center; // Versioned transport fixture: active mask.
  saved[4]=1; // One placed piece; board and identity arrays begin at 22 and 49.
  saved[22]=1;saved[49]=1;
  assert(engine.importState(saved));
  return engine.snapshot();
}
const tick=()=>new Promise(r=>setImmediate(r));
const asEvent=q=>({type:'GYRO',quaternion:{x:-q[0],y:q[2],z:q[1],w:q[3]}});
for(const grip of [{U:'U',F:'F',R:'R'},{U:'F',F:'D',R:'R'}])
for(const face of faces)for(const kind of ['slice','wide']) {
  const opposite=(face%15)^1;
  const second=opposite+(face>=15?0:15);
  const logical=kind==='slice'?pairedSlice(face,second):wideFromFace(face);
  const center=[4,10,12,14,16,22].find(i=>turn(cells,logical.move)[i]!==i);
  const before=setup(center);
  for(const m of faces) {
    assert(await commands.play(m));assert.equal(engine.snapshot()[S.ACTIVE],1<<center,'All regular faces leave centers fixed');
  }
  setup(center);
  assert(await commands.play(logical.move));const expected=engine.snapshot();
  assert.notEqual(expected[S.ACTIVE],before[S.ACTIVE]);
  assert.deepEqual(expected.slice(S.BOARD,S.BOARD+27),before.slice(S.BOARD,S.BOARD+27),'Placed stack stays fixed');
  setup(center);
  let observer,gameVisible=true,pose=matrix(identity),packingMove;
  const packing={performTurn:async move=>{packingMove=move;return true;}};
  const f=detector();
  const cube=createBluetoothCube({...f.options,sliceWindow:()=>40,wideWindow:()=>150,
    connect:async()=>({events$:{subscribe(o){observer=o;return{unsubscribe(){}};}}}),active:()=>gameVisible,explorerTurnTarget:()=>gameVisible?null:packing,
    play:m=>commands.play(m),orientation:()=>pose,rotate:value=>{pose=value;},status:()=>{}});
  cube.setMode('bluetooth');await cube.connect();cube.beginCalibration();
  const frame=calibrationFrame(grip);
  for(const face of ['U','F','R']){observer.next({type:'MOVE',move:grip[face]});observer.next({type:'MOVE',move:grip[face]+"'"});}
  observer.next(asEvent(identity));cube.markDragged();assert(cube.confirmCalibration());
  const event=m=>({type:'MOVE',move:Object.keys(frame.mapping).find(key=>frame.mapping[key]===moveLabels[m%15])+(m>=15?"'":'')});
  f.advance(10);observer.next(event(face));
  if(kind==='slice'){
    f.advance(10);observer.next(event(second));f.advance(5);
    observer.next(asEvent(multiply(frame.rotation,multiply(inverse(logical.rotation),inverse(frame.rotation)))));
  }
  else {f.advance(50);observer.next(asEvent(multiply(frame.rotation,multiply(inverse(logical.rotation),inverse(frame.rotation)))));}
  await tick();
  assert.equal(engine.snapshot()[S.ACTIVE],expected[S.ACTIVE],`${kind}: Bluetooth moves the same center as manual`);
  assert.deepEqual(engine.snapshot().slice(S.BOARD,S.BOARD+27),expected.slice(S.BOARD,S.BOARD+27));
  // Regrip, then switch views with the physical cube held still.
  const sample=asEvent(axisAngle([1,2,3],.7));
  f.advance(200);observer.next(sample);
  const gamePose=pose;gameVisible=false;cube.suspend();observer.next(sample);
  assert(pose.every((v,i)=>Math.abs(v-gamePose[i])<1e-8),'calibrated pose survives view switch after '+kind);
  for(const next of faces){
    observer.next(event(next));await tick();
    const gameMove=correctedFace(next,logical.rotation);
    assert.equal(explorerMoveLabels[packingMove%15],moveLabels[gameMove%15]);
    assert.equal(packingMove>=15,gameMove>=15);
  }
  await cube.disconnect();
}
console.log('PASS: wide gyro direction/timing, slice precedence, 24 frames and real-engine center movement relative to the fixed stack.');
