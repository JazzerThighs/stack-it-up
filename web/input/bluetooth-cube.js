import {moveLabels} from '../engine/coordinates.js';
import {multiply, quaternion, matrix} from './orbit-math.js';
import {calibrationFrame} from './cube-calibration.js';
import {createSlicePairing, pairedSlice, correctedFace} from './slice-pairing.js';
import {createGyroNeutral} from './gyro-neutral.js';
import {createGyroSmoothing} from './gyro-smoothing.js';
import {wideFromFace} from './wide-turns.js';

export function faceMoves(notation) {
  const match = /^([URFDLB])(['2]?)$/.exec(notation);
  if (!match) return [];
  const move = moveLabels.indexOf(match[1]);
  return match[2] === '2' ? [move, move] : [move + (match[2] === "'" ? 15 : 0)];
}

// GAN: +X red, +Y blue, +Z white. Renderer faces: R=-X, B=+Z, U=+Y.
export function ganQuaternion(q) {
  if (!q || ![q.x,q.y,q.z,q.w].every(Number.isFinite)) return null;
  const n = Math.hypot(q.x,q.y,q.z,q.w);
  return n > 1e-6 ? [-q.x/n,q.z/n,q.y/n,q.w/n] : null;
}
const inverse = q => [-q[0],-q[1],-q[2],q[3]];

/** Device/session ownership; all game mutations go through the supplied command. */
export function createBluetoothCube({connect, availability, play, active, explorerTurnTarget = () => null, packingNeutral = () => false, orientation, rotate, status, now = () => performance.now(), sliceWindow = () => 0, wideWindow = () => 0, neutralTolerance = () => 10, neutralDelay = () => 125, neutralSpeed = () => 2.5, neutralCutoff = () => 6, smoothing = () => true, smoothingResponse, smoothingSpeed, smoothingAcceleration, requestFrame = globalThis.requestAnimationFrame?.bind(globalThis), cancelFrame = globalThis.cancelAnimationFrame?.bind(globalThis), setTimer, cancelTimer}) {
  let mode = 'manual', connection, subscription, generation = 0, connecting = false;
  let queue = [], draining = false, reference, base;
  const hasBoard = () => active() || !!explorerTurnTarget();
  let explorerBase, compensating = false;
  let playing = false;
  let correction = [0,0,0,1];
  let calibration = 'disconnected', faces = {}, capture = null, dragged = false, latestGyro, frame;
  let calibrationKind = 'full', calibrationStep = 0, awaitingUndo = false, savedNeutral;
  const report = message => status({mode, connecting, connected:!!connection, message,
    calibration, calibrationKind, calibrationStep, awaitingUndo, faces:{...faces}, capture, dragged});
  const neutralOptions = {tolerance:neutralTolerance, delay:neutralDelay, speed:neutralSpeed, cutoff:neutralCutoff};
  const neutral = createGyroNeutral(neutralOptions);
  const explorerNeutral = createGyroNeutral(neutralOptions);
  const smooth = createGyroSmoothing({response:smoothingResponse,speed:smoothingSpeed,acceleration:smoothingAcceleration});
  let animationFrame=null, lastFrame=null, smoothStarted=false, smoothTarget;
  const stopSmoothing = () => {
    if(animationFrame!==null)cancelFrame?.(animationFrame);
    animationFrame=lastFrame=null; smoothStarted=false;
  };
  function animateGyro(time){
    animationFrame=null;
    if(!active()||calibration!=='ready'||!connection){stopSmoothing();return;}
    if(!smoothing()){rotate(matrix(smoothTarget));stopSmoothing();return;}
    const dt=lastFrame===null?0:(time-lastFrame)/1000;lastFrame=time;
    const result=smooth.step(dt);rotate(matrix(result.pose));
    if(!result.done)animationFrame=requestFrame(animateGyro);
    else lastFrame=null;
  }
  function presentGyro(target){
    smoothTarget=target;
    if(!smoothing()||!requestFrame){stopSmoothing();rotate(matrix(target));return;}
    if(!smoothStarted){smooth.reset(quaternion(orientation()));smoothStarted=true;}
    smooth.target(target);
    if(animationFrame===null)animationFrame=requestFrame(animateGyro);
  }
  const recenter = () => { reference = base = null; neutral.reset(); stopSmoothing(); };
  const clear = () => { queue = []; pairing.clear(); };
  function enqueue(command) {
    if (queue.length >= 64) { clear(); report('Too many pending turns. Queue cleared; turn more slowly.'); return; }
    queue.push(command);
    void drain(generation);
  }
  const pairing = createSlicePairing({windowMs:sliceWindow,wideWindowMs:wideWindow,now,setTimer,cancelTimer,emit:command=>{
    if (!active() || calibration !== 'ready' || !connection) { clear(); return; }
    enqueue(command);
  }});
  const calibratedGyro = () => multiply(inverse(frame.rotation),multiply(latestGyro,frame.rotation));
  function gyroDelta() {
    return multiply(inverse(frame.rotation), multiply(multiply(inverse(reference), latestGyro), frame.rotation));
  }
  function updateGyro(sample = false) {
    if (!latestGyro || !frame) return;
    if (!reference) { reference = latestGyro; base = multiply(quaternion(orientation()),inverse(correction)); neutral.reset(quaternion(orientation())); }
    const pose = multiply(multiply(base,gyroDelta()),correction);
    presentGyro(sample ? neutral.apply(pose,latestGyro,now()) : neutral.orient(pose));
  }
  async function disconnect(message = 'Disconnected. Select Connect to pair again.') {
    generation++; connecting = false;
    subscription?.unsubscribe(); subscription = null;
    const old = connection; connection = null; clear(); recenter();
    calibrationKind='full';calibrationStep=0;awaitingUndo=false;savedNeutral=null;calibration = 'disconnected'; faces = {}; capture = null; latestGyro = frame = null; report(message);
    try { await old?.disconnect(); } catch { report('Connection closed.'); }
  }
  async function drain(token) {
    if (draining) return;
    draining = true;
    try {
      while (queue.length && token === generation) {
        const {moves,wide,target} = queue.shift();
        if (target) {
          if (target !== explorerTurnTarget()) continue;
          playing = true;
          try {
            if (!await target.performTurn(moves[0]) && target === explorerTurnTarget()) {
              clear();
              report('Explorer turn unavailable. Pending turns cleared.');
            }
          } finally { playing = false; }
          continue;
        }
        if (!active()) { clear(); break; }
        const mapped = moves.map(move=>correctedFace(move,correction));
        const pair = mapped.length===2 ? pairedSlice(...mapped) : wide ? wideFromFace(mapped[0]) : null;
        const move = pair ? pair.move : mapped[0];
        const commandFrame = frame;
        let accepted;
        playing = true;
        try { accepted = await play(move); } finally { playing = false; }
        if (token !== generation) break;
        if (!accepted) { clear(); report('Turn unavailable under the current game rules. Pending turns cleared.'); break; }
        if (pair && frame === commandFrame && calibration === 'ready') {
          correction = multiply(correction,pair.rotation); neutral.pause(); if(active())updateGyro();
        }
      }
    } catch (error) {
      if (token === generation) { clear(); report(`Turn failed: ${error.message}`); }
    } finally {
      draining = false;
      if (token !== generation && queue.length) void drain(generation);
      else if (!active()) clear();
    }
  }
  function promptCalibration() {
    const face=['U','F','R'][calibrationStep];
    report(awaitingUndo ? `Step ${calibrationStep+1}/4: undo that ${face} turn (${face}').`
      : `Step ${calibrationStep+1}/4: turn your ${face==='U'?'top':face==='F'?'front':'right'} face clockwise (${face}), then undo it. Keep the same grip.`);
  }
  function neutralStep() {
    calibrationStep=3; capture=null; dragged=false; latestGyro=null;
    // Camera lies on +Z. F is -Z, so half a turn about Y faces F toward
    // the camera with U (+Y) toward the ceiling.
    rotate(matrix([0,1,0,0]));
    report('Step 4/4: hold the calibrated U face up, F forward and R right. Drag either cube to edit your natural angle, then confirm. Use Roll to adjust tilt.');
  }
  function finishFaces() {
    const selected=calibrationFrame(faces);
    if(!selected){faces={};calibrationStep=0;awaitingUndo=false;promptCalibration();return;}
    if(calibrationKind==='ufr') {
      // Rebase at the visible pose when the face basis changes. Retain the
      // previously saved neutral angle; no gyro pose-edit step is required.
      frame=selected;reference=latestGyro;base=quaternion(orientation());explorerBase=base;compensating=false;
      correction=[0,0,0,1];neutral.reset(savedNeutral);stopSmoothing();clear();
      calibration='ready';capture=null;
      report('UFR mapping reset. Your saved neutral angle is unchanged.');
    } else { frame=selected;neutralStep(); }
  }
  function calibrationMove(move) {
    if(calibrationStep>=3)return;
    const logical=['U','F','R'][calibrationStep];
    if(awaitingUndo){
      if(move!==faces[logical]+"'"){report(`Undo the recorded ${logical} turn on the same face before continuing. Restore any accidental turns first.`);return;}
      awaitingUndo=false;calibrationStep++;
      if(calibrationStep===3)finishFaces();else promptCalibration();
      return;
    }
    if(!/^[URFDLB]$/.test(move)){report(`Start with one clockwise ${logical} quarter-turn. Restore any accidental turns first.`);return;}
    const proposed={...faces,[logical]:move};
    // Reject repeated/opposite/mirrored face assignments before accepting them.
    const candidates='UDFBRL';
    const valid=[...candidates].some(U=>[...candidates].some(F=>[...candidates].some(R=>
      Object.entries(proposed).every(([k,v])=>({U,F,R})[k]===v)&&calibrationFrame({U,F,R}))));
    if(!valid){report('That face is inconsistent with the previous faces. Undo that turn, keep the same grip, and try the requested face again.');return;}
    faces=proposed;awaitingUndo=true;promptCalibration();
  }
  function startCalibration(kind) {
    if(!connection)return false;
    if(playing){report('Wait for the current turn to finish, then select reset again.');return false;}
    if(kind!=='full'&&(!frame||!savedNeutral))return false;
    clear();stopSmoothing();neutral.pause();calibrationKind=kind;
    calibration='pending';calibrationStep=0;awaitingUndo=false;capture=null;dragged=false;
    if(kind!=='gyro')faces={};
    report('Close the connection panel to continue cube calibration.');
    return true;
  }
  function beginCalibration() {
    if (!connection || calibration !== 'pending' || !hasBoard() || playing) return;
    clear(); stopSmoothing(); calibration = 'calibrating';
    if (calibrationKind === 'gyro') neutralStep();
    else promptCalibration();
  }
  function event(e, token) {
    if (token !== generation || mode !== 'bluetooth') return;
    if (e.type === 'DISCONNECT') { void disconnect('Cube disconnected. Select Connect to reconnect.'); return; }
    if (e.type === 'GYRO') {const sample=ganQuaternion(e.quaternion);if(!sample)return;latestGyro=sample;}
    if (calibration !== 'ready') {
      if (calibration === 'pending') { beginCalibration(); return; }
      if (calibration === 'calibrating' && hasBoard() && e.type === 'MOVE') calibrationMove(e.move);
      return;
    }
    if (!active()) {
      const target = explorerTurnTarget();
      if (!target) clear();
      else if (e.type === 'MOVE') {
        const moves = faceMoves((frame.mapping[e.move?.[0]] || '') + (e.move?.slice(1) || ''));
        for (const move of moves) enqueue({target, moves:[move], received:now()});
      }
      if (target && e.type === 'GYRO' && reference) {
        const pose = multiply(explorerBase, gyroDelta());
        const enabled = packingNeutral();
        if (enabled && !compensating) explorerNeutral.reset(savedNeutral);
        compensating = enabled;
        rotate(matrix(enabled ? explorerNeutral.apply(pose,latestGyro,now()) : pose));
      }
      neutral.pause();
      stopSmoothing();
      return;
    }
    if (e.type === 'MOVE') {
      const moves = faceMoves((frame.mapping[e.move?.[0]] || '') + (e.move?.slice(1) || ''));
      pairing.push(moves,e);
    } else if (e.type === 'GYRO') {
      const q = ganQuaternion(e.quaternion);
      if (!q) return;
      pairing.gyro(calibratedGyro());
      updateGyro(true);
    }
  }
  return {
    get mode() { return mode; },
    get animationBacklog() { return {playing, pending:queue.length, oldestAge:queue.length ? Math.max(0,now()-queue[0].received) : 0}; },
    get calibrating() { return calibration === 'calibrating'; },
    get adjustingNeutral() { return calibration === 'calibrating' && calibrationStep === 3; },
    beginCalibration,
    markDragged() { if (calibration === 'calibrating' && calibrationStep === 3 && !dragged) { dragged = true; report('Angle adjusted. Hold your physical cube in the matching natural pose and confirm.'); } },
    confirmCalibration() {
      if (calibration !== 'calibrating' || calibrationStep !== 3 || !hasBoard()) return false;
      if (!dragged) { report('Drag the displayed cube to edit your natural grip before confirming.'); return false; }
      if (!latestGyro) { report('Waiting for fresh orientation data. Gently move the physical cube, then confirm.'); return false; }
      reference = latestGyro; savedNeutral=quaternion(orientation()); explorerBase=savedNeutral;compensating=false;
      if(calibrationKind==='full')correction=[0,0,0,1];
      base=multiply(savedNeutral,inverse(correction)); neutral.reset(savedNeutral); stopSmoothing(); clear(); pairing.gyro(calibratedGyro());
      capture = null; calibration = 'ready'; report('Cube calibrated. Ready to play.'); return true;
    },
    resetUfr() { const started=startCalibration('ufr');if(started)this.beginCalibration();return started; },
    resetGyro() { const started=startCalibration('gyro');if(started)this.beginCalibration();return started; },
    suspend() { clear(); neutral.pause(); explorerNeutral.pause(); stopSmoothing(); },
    recalibrate() { return startCalibration('full'); },
    disconnect,
    setMode(value) {
      mode = value === 'bluetooth' ? value : 'manual';
      void disconnect(mode === 'manual' ? 'Manual controls active.' : 'Select Connect to pair your cube.');
    },
    async connect() {
      if (mode !== 'bluetooth' || connecting || connection) return;
      const token = ++generation;
      let stage = 'Opening Bluetooth picker';
      connecting = true; report('Choose your cube in the Bluetooth picker.');
      try {
        const next = await connect(message => {
          if (token !== generation) return;
          stage = message;
          report(message);
        });
        if (token !== generation) { await next.disconnect(); return; }
        connection = next; connecting = false; clear();
        calibrationKind='full';calibrationStep=0;awaitingUndo=false;calibration = 'pending'; latestGyro = null;
        subscription = next.events$.subscribe({next:e=>event(e,token), error:()=>void disconnect('Bluetooth stream failed. Reconnect your cube.'), complete:()=>{if(token===generation)void disconnect('Cube disconnected.');}});
        report(`Connected to ${next.deviceName || 'cube'}. Close the connection panel to calibrate.`);
      } catch (error) {
        if (token !== generation) return;
        connecting = false;
        // NotFoundError also covers unavailable adapters and missing GATT services.
        // Preserve the browser's actual error instead of assuming the user cancelled.
        const detail = `${error?.name || 'Error'}: ${error?.message || String(error)}`;
        const hint = error?.name === 'NotFoundError'
          ? ' If no picker appeared, open the app directly in Chrome or Edge and check site Bluetooth permissions and Windows Bluetooth.'
          : '';
        const message = `Connection failed during ${stage}: ${detail}.${hint}`;
        report(message);
        // Diagnose after requestDevice so the picker keeps the click's user activation.
        try {
          if (await availability?.() === false && token === generation) {
            report(`${message} This browser reports Bluetooth unavailable; check the adapter and browser access.`);
          }
        } catch { /* Availability is optional; keep the original connection error. */ }
      }
    },
  };
}
