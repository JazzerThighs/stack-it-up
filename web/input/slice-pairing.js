import {CubeStack} from '../engine/coordinates.js';
import {turnTransform, transformPoint} from '../render/transforms.js';
import {matrix, quaternion} from './orbit-math.js';
import {wideGyroMatch} from './wide-turns.js';

// Opposite outer layers rotating in the same spatial direction equal a
// whole-cube rotation followed by the inverse middle-layer turn.
export function pairedSlice(a,b) {
  if (a%15 > 5 || b%15 > 5) return null;
  const [,axis,layer] = CubeStack.moves[a%15];
  const [,otherAxis,otherLayer] = CubeStack.moves[b%15];
  if (axis !== otherAxis || layer === otherLayer || (a>=15) === (b>=15)) return null;
  const rotation = turnTransform(a,1), middle = 6+axis;
  const same = turnTransform(middle,1).every((v,i)=>Math.abs(v-rotation[i])<1e-8);
  return {move:middle+(same?15:0), rotation:quaternion(rotation)};
}

// correction maps virtual puzzle coordinates into the original calibrated frame.
export function correctedFace(move,correction) {
  const [,axis,layer] = CubeStack.moves[move%15];
  const normal = [0,0,0]; normal[axis] = layer-1;
  const m = matrix(correction), inverse = [m[0],m[3],m[6],m[1],m[4],m[7],m[2],m[5],m[8]];
  const n = transformPoint(normal,{rotation:inverse});
  const index = CubeStack.moves.findIndex(([,a,l])=>typeof l==='number' && l!==1 && Math.abs(n[a]-(l-1))<1e-8);
  return index+(move>=15?15:0);
}

export function createSlicePairing({emit,windowMs,wideWindowMs=()=>0,now,setTimer=setTimeout,cancelTimer=clearTimeout}) {
  let pending, timer, samples=[];
  const resetPending = () => { cancelTimer(timer); timer=undefined; pending=undefined; };
  const clear = () => { resetPending(); samples=[]; };
  const consumeGyro = () => { samples=samples.slice(-1); };
  // Both gestures rotate the physical core opposite the reported face. Keep
  // samples from before MOVE delivery and use one clock for the whole gesture.
  function match(window) {
    const end=samples.at(-1);
    if(!window || !end || now()-pending.received>window)return;
    return samples.find(start=>start.time<=pending.received && end.time>start.time &&
      now()-start.time<=window && wideGyroMatch(pending.move,start.q,end.q));
  }
  function observe() {
    pending.sliceStart ??= match(pending.slice);
    pending.wideStart ??= match(pending.wide);
  }
  function flush() {
    const old=pending;
    resetPending(); consumeGyro();
    if(!old)return;
    if(old.second!==undefined) {
      if(old.sliceStart)emit({moves:[old.move,old.second],received:old.received,start:old.sliceStart.q,window:old.slice});
      else {
        emit({moves:[old.move],received:old.received});
        emit({moves:[old.second],received:old.secondTime});
      }
    } else if(old.wideStart)emit({moves:[old.move],received:old.received,wide:true,start:old.wideStart.q,window:old.wide});
    else emit({moves:[old.move],received:old.received});
  }
  function check() {
    if(!pending)return;
    observe();
    const age=now()-pending.received;
    const paired=pending.second!==undefined;
    const deadline=paired || pending.wideStart ? pending.slice : pending.wait;
    if((paired && pending.sliceStart) || age>=deadline){flush();return;}
    cancelTimer(timer);
    timer=setTimer(check,Math.max(1,deadline-age));
  }
  function gyro(q) {
    const time=now();
    samples=samples.filter(s=>time-s.time<=500);
    samples.push({q,time});
    if(samples.length>256)samples.shift();
    if(pending)check();
  }
  function push(moves,event) {
    const received=now(), window=Math.max(0,Math.min(150,Number(windowMs())||0));
    const wide=event.localTimestamp===null?0:Math.max(0,Math.min(500,Number(wideWindowMs())||0));
    const next={move:moves[0],received,cube:event.cubeTimestamp,local:event.localTimestamp,
      slice:window,wide,wait:Math.max(window,wide)};
    if(pending && pending.second===undefined && moves.length===1 && window) {
      // Prefer device intervals, including batched delivery. Missing/recovered
      // timestamps never become an apparent simultaneous pair on arrival.
      const device=Number.isFinite(pending.cube)&&Number.isFinite(next.cube);
      const local=pending.local!==null&&next.local!==null;
      const dt=device?next.cube-pending.cube:
        local?(Number.isFinite(next.local)&&Number.isFinite(pending.local)?next.local-pending.local:received-pending.received):NaN;
      if(dt>=0 && dt<=window && (device || dt>0) && received-pending.received<=window && pairedSlice(pending.move,next.move)) {
        pending.second=next.move; pending.secondTime=received; check(); return;
      }
    }
    if(pending)flush();
    if(!moves.length)return;
    if(!next.wait || moves.length!==1 || (event.localTimestamp===null && !Number.isFinite(event.cubeTimestamp))) {
      consumeGyro();
      for(const move of moves)emit({moves:[move],received});
      return;
    }
    pending=next; check();
  }
  return {push,clear,gyro};
}
