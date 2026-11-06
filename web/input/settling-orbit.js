import {showOrbitGuide} from './orbit-guide.js';
import {orbitSettings as sharedSettings,subscribeOrbit,publishOrbitDebug} from './orbit-settings.js';
import {quaternion,matrix,slerp,distance,snapTarget,dragAxis,applyDragRotation,viewAxisFrame,axisLabel,frontFace} from './orbit-math.js';
let activeController=null;
export function stopOrbitMotion(){activeController?.();activeController=null;}
// One animation per gesture; no idle render loop. New gestures cancel settling.
export function createSettlingOrbit(renderer,onOrbit){
 let settings=sharedSettings;
 let current,target,origin,last,axis,direction,active=false,token=0,queued=false,stamp=0,releaseAt=null,from=null,settle=null,angle=0,overlay,guide,frame;
 const reduced=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const report=phase=>{
  if(!settings.orbitDebug)return;
  const m=matrix(current),f=frontFace(m),n=m.slice(f.axis*3,f.axis*3+3).map(v=>v*f.sign),deg=180/Math.PI;
  const text=`${phase} | axis ${axis?axisLabel(axis,settings):'-'}\nDrag ${angle.toFixed(1)} deg | face ${['X','Y','Z'][f.axis]}${f.sign>0?'+':'-'}\nNormal H ${(Math.atan2(n[0],n[2])*deg).toFixed(1)} deg V ${(Math.asin(Math.max(-1,Math.min(1,n[1])))*deg).toFixed(1)} deg\nQuaternion ${current.map(v=>v.toFixed(3)).join(' ')}\nTarget error ${(distance(current,settle?.q||target)*deg).toFixed(1)} deg`;
  publishOrbitDebug(text);
  if(settings.orbitDebugOverlay&&!overlay&&renderer.canvas.parentElement){overlay=document.createElement('pre');overlay.className='orbit-debug-overlay';overlay.style.cssText='position:absolute;bottom:64px;left:12px;z-index:8;pointer-events:none;background:#071116dd;color:#c1f5e1;padding:10px;font:12px/1.5 monospace;white-space:pre-wrap;max-width:calc(100% - 24px)';renderer.canvas.parentElement.append(overlay);}
  if(overlay){overlay.hidden=!settings.orbitDebugOverlay;overlay.textContent=text;}
 };
 const cancel=()=>{token++;queued=false;active=false;releaseAt=null;guide?.remove();guide=null;};
 const schedule=()=>{if(queued)return;queued=true;const generation=token;requestAnimationFrame(now=>{if(generation!==token)return;queued=false;tick(now);});};
 const tick=now=>{
  if(!settings.orbitSettling||globalThis.document?.hidden){cancel();return;}
  const dt=stamp?Math.min(64,now-stamp):16;stamp=now;
  if(releaseAt!==null){
   if(from===null){from=current.slice();releaseAt=now;}
   const t=reduced()?1:Math.max(0,Math.min(1,(now-releaseAt-settings.orbitSettleDelay)/settings.orbitSettleTime));
   current=slerp(from,settle.q,t*t*(3-2*t));onOrbit(0,0,matrix(current));report(t===1?'Aligned':'Settling');
   if(t<1)schedule();else releaseAt=null;
  }else{
   const a=reduced()||!settings.orbitSmoothing?1:1-Math.exp(-dt/settings.orbitSmoothing);
   current=slerp(current,target,a);const pending=distance(current,target)>0.0001;
   if(!pending)current=target.slice();onOrbit(0,0,matrix(current));report(active?'Dragging':'Released');if(pending)schedule();
  }
 };
 const stop=subscribeOrbit(()=>{cancel();settings=sharedSettings;if(overlay)overlay.hidden=!settings.orbitDebug||!settings.orbitDebugOverlay||!settings.orbitSettling;});
 return {
  start(x,y,confined=sharedSettings.orbitConfined){stopOrbitMotion();settings={...sharedSettings,orbitSettling:true,orbitConfined:confined};activeController=cancel;cancel();current=quaternion(renderer.orientation);target=current.slice();frame=viewAxisFrame(current);origin=last=[x,y];axis=null;angle=0;direction=[1,1];active=true;stamp=0;settle=null;guide=showOrbitGuide(renderer.canvas,x,y,settings);report('Ready');},
  move(x,y){if(!active)return;const dx=x-origin[0],dy=y-origin[1],radius=Math.hypot(dx,dy);
   angle=Math.atan2(dy,dx)*180/Math.PI;
   if(!axis){
    if(radius<=settings.orbitDeadZone){report('Choosing direction');return;}
    // Ignore the approach inside the circle; only motion beyond its edge rotates.
    // Once captured, retain the normal drag response, including reversals.
    last=[origin[0]+dx/radius*settings.orbitDeadZone,origin[1]+dy/radius*settings.orbitDeadZone];
   }
   if(!axis||!settings.orbitAxisLock){axis=dragAxis(dx,dy,settings);direction=[dx,dy];}
   target=applyDragRotation(target,x-last[0],y-last[1],axis,settings,direction,frame);last=[x,y];schedule();
  },
  release(abort=false){if(!active)return;active=false;guide?.remove();guide=null;if(abort){cancel();return;}
   if(settings.orbitSnap&&axis){settle=snapTarget(target,settings);releaseAt=0;from=null;schedule();}else if(axis)schedule();
  },cancel,dispose(){cancel();stop();overlay?.remove();}
 };
}
