const storageKey='stack-it-up.settling-orbit';
export const orbitSpecs={
 mouseLeft:{value:'turn',options:['turn','free','xyz','off']},mouseRight:{value:'free',options:['turn','free','xyz','off']},mouseBoth:{value:'xyz',options:['free','xyz']},mouseBothEnabled:{value:true},
 orbitSettling:{value:true},orbitConfined:{value:true},orbitSnap:{value:true},orbitDiagonalRoll:{value:true},orbitAxisLock:{value:true},orbitDebug:{value:false},orbitDebugOverlay:{value:false},
 orbitCubeUD:{value:true},orbitCubeLR:{value:true},orbitCubeFB:{value:true},orbitDragGuide:{value:true},
 orbitDeadZone:{value:24,min:0,max:96,step:2},
 orbitSensitivity:{value:0.5,min:0.1,max:2,step:0.05},
 orbitSmoothing:{value:70,min:0,max:300,step:10},orbitSettleTime:{value:700,min:100,max:2500,step:50},orbitSettleDelay:{value:80,min:0,max:600,step:20},
 orbitHorizontal:{value:-20,min:-60,max:60,step:1},orbitVertical:{value:15,min:-60,max:60,step:1},orbitRoll:{value:0,min:-45,max:45,step:1},
};
export const orbitSettings=Object.fromEntries(Object.entries(orbitSpecs).map(([k,s])=>[k,s.value]));
function valid(k,v){const s=orbitSpecs[k];if(!s)return null;if(s.options){if(v==='smooth')v='xyz';return s.options.includes(v)?v:null;}if(typeof s.value==='boolean')return typeof v==='boolean'?v:null;return typeof v==='number'&&Number.isFinite(v)?Math.max(s.min,Math.min(s.max,v)):null;}
try{const saved=JSON.parse(globalThis.localStorage?.getItem(storageKey)||'{}');for(const k in orbitSpecs){const v=valid(k,saved[k]);if(v!==null)orbitSettings[k]=v;}}catch{}
const listeners=new Set(),debugListeners=new Set();
export function subscribeOrbit(fn){listeners.add(fn);return()=>listeners.delete(fn);}
function publish(){try{globalThis.localStorage?.setItem(storageKey,JSON.stringify(orbitSettings));}catch{}for(const f of listeners)f();}
export function setOrbitSetting(k,v){v=valid(k,v);if(v===null)return;orbitSettings[k]=v;publish();}
export function setOrbitMode(mode){
 if(mode==='smooth'||mode==='xyz')mode='confined';if(!['classic','confined'].includes(mode))return;
 orbitSettings.orbitSettling=mode!=='classic';orbitSettings.orbitConfined=mode==='confined';publish();
}
export function usedOrbitActions(s=orbitSettings){
 return [s.mouseLeft==='turn'?'free':s.mouseLeft,s.mouseRight==='turn'?'free':s.mouseRight,...(s.mouseBothEnabled?[s.mouseBoth]:[]),s.orbitSettling?'xyz':'free'];
}
export function orbitAvailability(s=orbitSettings){
 const actions=usedOrbitActions(s),advanced=actions.includes('xyz');
 const enabled=Object.fromEntries(Object.keys(orbitSpecs).map(k=>[k,advanced]));
 for(const k of ['orbitSettling','orbitConfined','mouseLeft','mouseRight','mouseBothEnabled'])enabled[k]=true;
 enabled.mouseBoth=s.mouseBothEnabled;
 enabled.orbitCubeFB=advanced&&s.orbitDiagonalRoll;
 for(const k of ['orbitHorizontal','orbitVertical','orbitRoll','orbitSettleTime','orbitSettleDelay'])enabled[k]=advanced&&s.orbitSnap;
 enabled.orbitDebugOverlay=advanced&&s.orbitDebug;
 return enabled;
}
export function pointerOrbitAction(e,s=orbitSettings){
 if(e.pointerType==='touch')return {action:'turn',outside:s.orbitSettling?'xyz':'free',chord:false};
 const chord=s.mouseBothEnabled&&(e.buttons&3)===3;
 return {action:chord?s.mouseBoth:e.button===2?s.mouseRight:e.button===0?s.mouseLeft:'off',outside:'free',chord};
}
export function publishOrbitDebug(text){for(const fn of debugListeners)fn(text);}
export function bindOrbitSettings(root){
 const $=id=>{try{return root.getElementById(id);}catch{return null;}};
 if(!$('orbitSettling'))return()=>{};
 const refresh=()=>{
  const available=orbitAvailability();
  if($('orbitMode'))$('orbitMode').value=orbitSettings.orbitSettling?'confined':'classic';
  for(const [k,s]of Object.entries(orbitSpecs)){
   const el=$(k);if(!el)continue;
   if(typeof s.value==='boolean')el.checked=orbitSettings[k];else{el.value=orbitSettings[k];if($(k+'Value'))$(k+'Value').textContent=String(orbitSettings[k]);}
   el.disabled=!available[k];el.closest?.('label')?.classList?.toggle('camera-setting-disabled',!available[k]);
  }
  if($('orbitModeHelp'))$('orbitModeHelp').textContent=orbitSettings.orbitSettling?'Touch: XYZ Orbit uses only X/Y/Z zones.':'Touch: free camera drags. Mouse assignments are configured separately.';
  if($('orbitSnapHelp'))$('orbitSnapHelp').textContent=orbitSettings.orbitSnap?'Aligns the nearest face after release. Zero angles give a straight-on face.':'Release alignment is off. Target angles and timing are inactive.';
  if($('orbitDiagnostics'))$('orbitDiagnostics').hidden=!available.orbitDebug||!orbitSettings.orbitDebug;
  if($('freeOrbit'))$('freeOrbit').disabled=!usedOrbitActions().includes('free');
 };
 if($('orbitMode'))$('orbitMode').addEventListener('change',()=>setOrbitMode($('orbitMode').value));
 for(const [k,s]of Object.entries(orbitSpecs)){const el=$(k);if(el){el.addEventListener('change',()=>setOrbitSetting(k,typeof s.value==='boolean'?el.checked:s.options?el.value:Number(el.value)));if(typeof s.value!=='boolean')el.addEventListener('input',()=>{if($(k+'Value'))$(k+'Value').textContent=el.value;});}}
 if($('resetOrbitSettings'))$('resetOrbitSettings').onclick=()=>{for(const [k,s]of Object.entries(orbitSpecs))orbitSettings[k]=s.value;publish();};
 const debug=text=>{if(orbitSettings.orbitDebug&&$('orbitDiagnostics'))$('orbitDiagnostics').textContent=text;};debugListeners.add(debug);
 const stop=subscribeOrbit(refresh);refresh();return()=>{stop();debugListeners.delete(debug);};
}

// Shared viewport toggle; touch users need no mouse-button chord.
export function bindOrbitToggle(button){
 const enabled=()=>orbitSettings.orbitSettling&&orbitSettings.orbitConfined;
 const refresh=()=>{button.textContent='XYZ Orbit';button.setAttribute('aria-pressed',String(enabled()));button.hidden=false;};
 button.onclick=()=>setOrbitMode(enabled()?'classic':'confined');
 button.title='Touch orbit toggle. On: XYZ Orbit. Off: free drag. Drag outside the cube to orbit; stickers still turn. Mouse assignments stay unchanged.';
 refresh();return subscribeOrbit(refresh);
}
