import {moveLabels} from '../engine/coordinates.js';
import {multiply, quaternion, matrix} from './orbit-math.js';
import {calibrationFrame} from './cube-calibration.js';
import {createSlicePairing, pairedSlice, correctedFace} from './slice-pairing.js';
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
export function createBluetoothCube({connect, availability, play, active, orientation, rotate, status, now = () => performance.now(), sliceWindow = () => 0, wideWindow = () => 0, setTimer, cancelTimer}) {
  let mode = 'manual', connection, subscription, generation = 0, connecting = false;
  let queue = [], draining = false, reference, base;
  let playing = false;
  let correction = [0,0,0,1];
  let calibration = 'disconnected', faces = {}, capture = null, dragged = false, latestGyro, frame;
  const report = message => status({mode, connecting, connected:!!connection, message,
    calibration, faces:{...faces}, capture, dragged});
  const recenter = () => { reference = base = null; };
  const clear = () => { queue = []; pairing.clear(); };
  const pairing = createSlicePairing({windowMs:sliceWindow,wideWindowMs:wideWindow,now,setTimer,cancelTimer,emit:command=>{
    if (!active() || calibration !== 'ready' || !connection) { clear(); return; }
    if (queue.length >= 64) { clear(); report('Too many pending turns. Queue cleared; turn more slowly.'); return; }
    queue.push(command); void drain(generation);
  }});
  const calibratedGyro = () => multiply(inverse(frame.rotation),multiply(latestGyro,frame.rotation));
  function updateGyro() {
    if (!latestGyro || !frame) return;
    if (!reference) { reference = latestGyro; base = multiply(quaternion(orientation()),inverse(correction)); }
    const delta = multiply(inverse(frame.rotation), multiply(multiply(inverse(reference), latestGyro), frame.rotation));
    rotate(matrix(multiply(multiply(base,delta),correction)));
  }
  async function disconnect(message = 'Disconnected. Select Connect to pair again.') {
    generation++; connecting = false;
    subscription?.unsubscribe(); subscription = null;
    const old = connection; connection = null; clear(); recenter();
    calibration = 'disconnected'; faces = {}; capture = null; latestGyro = frame = null; report(message);
    try { await old?.disconnect(); } catch { report('Connection closed.'); }
  }
  async function drain(token) {
    if (draining) return;
    draining = true;
    try {
      while (queue.length && token === generation && active()) {
        const {moves,wide} = queue.shift();
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
          correction = multiply(correction,pair.rotation); if(active())updateGyro();
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
  function event(e, token) {
    if (token !== generation || mode !== 'bluetooth') return;
    if (e.type === 'DISCONNECT') { void disconnect('Cube disconnected. Select Connect to reconnect.'); return; }
    if (e.type === 'GYRO') latestGyro = ganQuaternion(e.quaternion);
    if (!active()) { clear(); return; }
    if (calibration !== 'ready') {
      if (calibration === 'calibrating' && capture && e.type === 'MOVE' && faceMoves(e.move).length) {
        faces[capture] = e.move[0]; capture = null;
        report('Face recorded. Undo that physical turn before recording another face.');
      }
      return;
    }
    if (e.type === 'MOVE') {
      const moves = faceMoves((frame.mapping[e.move?.[0]] || '') + (e.move?.slice(1) || ''));
      pairing.push(moves,e);
    } else if (e.type === 'GYRO') {
      const q = ganQuaternion(e.quaternion);
      if (!q) return;
      pairing.gyro(calibratedGyro());
      updateGyro();
    }
  }
  return {
    get mode() { return mode; },
    get animationBacklog() { return {playing, pending:queue.length, oldestAge:queue.length ? Math.max(0,now()-queue[0].received) : 0}; },
    get calibrating() { return calibration === 'calibrating'; },
    beginCalibration() {
      if (!connection || calibration === 'ready' || !active()) return;
      if (calibration === 'calibrating') return;
      clear(); faces = {}; capture = null; dragged = false; calibration = 'calibrating';
      report('Record U, F and R, then drag the displayed cube to match your grip.');
    },
    captureFace(face) {
      if (calibration !== 'calibrating' || !['U','F','R'].includes(face)) return;
      capture = face; report(`Turn the physical face you want to use as ${face}, then undo it.`);
    },
    markDragged() { if (calibration === 'calibrating' && !dragged) { dragged = true; report('View adjusted. Hold the cube in your natural pose and confirm when ready.'); } },
    confirmCalibration() {
      if (calibration !== 'calibrating' || !active()) return false;
      const selected = calibrationFrame(faces);
      if (!selected) { report('U, F and R must be three adjacent faces in a valid cube orientation. Record them again.'); return false; }
      if (!dragged) { report('Drag the displayed cube to match your natural grip before confirming.'); return false; }
      if (!latestGyro) { report('Waiting for orientation data. Gently move the physical cube, then confirm.'); return false; }
      frame = selected; reference = latestGyro; base = quaternion(orientation());
      correction = [0,0,0,1]; clear(); pairing.gyro(calibratedGyro()); capture = null; calibration = 'ready'; report('Cube calibrated. Ready to play.'); return true;
    },
    recenter() {
      if (!connection || calibration !== 'ready') return false;
      pairing.clear();
      recenter();
      report('Gyro recentering: hold your natural pose. Face mapping is unchanged.');
      return true;
    },
    suspend() {
      clear();
      if (capture) { capture = null; report('Face recording paused. Select Record again when ready.'); }
    },
    recalibrate() {
      if (!connection) return;
      clear(); capture = null; calibration = 'pending';
      report('Close settings to calibrate your cube again.');
    },
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
        calibration = 'pending'; latestGyro = null;
        subscription = next.events$.subscribe({next:e=>event(e,token), error:()=>void disconnect('Bluetooth stream failed. Reconnect your cube.'), complete:()=>{if(token===generation)void disconnect('Cube disconnected.');}});
        report(`Connected to ${next.deviceName || 'cube'}. Close settings to calibrate.`);
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
