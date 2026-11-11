import {orbitSchema} from '../ui/orbit-schema.js';
import {createSettingsStore} from '../ui/settings-store.js';
export const orbitSpecs=orbitSchema.fields;
let storage;try{storage=globalThis.localStorage;}catch{}
const store=createSettingsStore(orbitSchema,storage);
export const orbitSettings=store.values;
const debugListeners=new Set();
export const subscribeOrbit=store.subscribe;
export const setOrbitSetting=store.set;
export function setOrbitMode(mode){
 if(mode==='smooth'||mode==='xyz')mode='confined';if(!['classic','confined'].includes(mode))return;
 store.patch({orbitSettling:mode!=='classic',orbitConfined:mode==='confined'});
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
 if($('resetOrbitSettings'))$('resetOrbitSettings').onclick=()=>store.reset();
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
