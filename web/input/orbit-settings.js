const storageKey='stack-it-up.settling-orbit';
export const orbitSpecs={
 orbitSettling:{value:false},orbitSnap:{value:true},orbitDiagonalRoll:{value:true},orbitAxisLock:{value:true},orbitDebug:{value:false},orbitDebugOverlay:{value:false},
 orbitCubeUD:{value:true},orbitCubeLR:{value:true},orbitCubeFB:{value:true},orbitDragGuide:{value:true},
 orbitSensitivity:{value:0.5,min:0.1,max:2,step:0.05},orbitTolerance:{value:18,min:0,max:40,step:1},
 orbitSmoothing:{value:70,min:0,max:300,step:10},orbitSettleTime:{value:700,min:100,max:2500,step:50},orbitSettleDelay:{value:80,min:0,max:600,step:20},
 orbitHorizontal:{value:-20,min:-60,max:60,step:1},orbitVertical:{value:15,min:-60,max:60,step:1},orbitRoll:{value:0,min:-45,max:45,step:1},
};
export const orbitSettings=Object.fromEntries(Object.entries(orbitSpecs).map(([k,s])=>[k,s.value]));
function valid(k,v){const s=orbitSpecs[k];if(!s)return null;if(typeof s.value==='boolean')return typeof v==='boolean'?v:null;return typeof v==='number'&&Number.isFinite(v)?Math.max(s.min,Math.min(s.max,v)):null;}
try{const saved=JSON.parse(globalThis.localStorage?.getItem(storageKey)||'{}');for(const k in orbitSpecs){const v=valid(k,saved[k]);if(v!==null)orbitSettings[k]=v;}}catch{}
const listeners=new Set(),debugListeners=new Set();
export function subscribeOrbit(fn){listeners.add(fn);return()=>listeners.delete(fn);}
export function setOrbitSetting(k,v){v=valid(k,v);if(v===null)return;orbitSettings[k]=v;try{globalThis.localStorage?.setItem(storageKey,JSON.stringify(orbitSettings));}catch{}for(const f of listeners)f();}
export function publishOrbitDebug(text){for(const fn of debugListeners)fn(text);}
export function bindOrbitSettings(root){
 const $=id=>{try{return root.getElementById(id);}catch{return null;}};
 if(!$('orbitSettling'))return()=>{};
 const refresh=()=>{for(const [k,s]of Object.entries(orbitSpecs)){const el=$(k);if(!el)continue;if(typeof s.value==='boolean')el.checked=orbitSettings[k];else {el.value=orbitSettings[k];if($(k+'Value'))$(k+'Value').textContent=String(orbitSettings[k]);}el.disabled=k!=='orbitSettling'&&!orbitSettings.orbitSettling;}
  if($('orbitCubeFB'))$('orbitCubeFB').disabled=!orbitSettings.orbitSettling||!orbitSettings.orbitDiagonalRoll;
  if($('orbitDiagnostics'))$('orbitDiagnostics').hidden=!orbitSettings.orbitDebug;
  if($('freeOrbit'))$('freeOrbit').disabled=orbitSettings.orbitSettling;
 };
 for(const [k,s]of Object.entries(orbitSpecs)){const el=$(k);if(el){el.addEventListener('change',()=>setOrbitSetting(k,typeof s.value==='boolean'?el.checked:Number(el.value)));if(typeof s.value!=='boolean')el.addEventListener('input',()=>{if($(k+'Value'))$(k+'Value').textContent=el.value;});}}
 if($('resetOrbitSettings'))$('resetOrbitSettings').onclick=()=>{for(const [k,s]of Object.entries(orbitSpecs))setOrbitSetting(k,s.value);};
 const debug=text=>{if(orbitSettings.orbitDebug&&$('orbitDiagnostics'))$('orbitDiagnostics').textContent=text;};debugListeners.add(debug);
 const stop=subscribeOrbit(refresh);refresh();return()=>{stop();debugListeners.delete(debug);};
}
