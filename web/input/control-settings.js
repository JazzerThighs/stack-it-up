import {bindOrbitSettings} from './orbit-settings.js';
const key='stack-it-up.controls';
export const controlSettings={hoverRings:true,ringLabels:false,hoverOutline:false,showArrows:false,arrowGuides:false,classicControls:false,freeOrbit:true,perspectiveCamera:true,wideTurns:false};
try {const saved=JSON.parse(globalThis.localStorage?.getItem(key)||'{}');for(const k in controlSettings)if(typeof saved[k]==='boolean')controlSettings[k]=saved[k];}catch{}
const subscribers=new Set();
export function setControlSetting(name,value){
 if(!(name in controlSettings))return;
 controlSettings[name]=!!value;
 try{globalThis.localStorage?.setItem(key,JSON.stringify(controlSettings));}catch{}
 for(const fn of subscribers)fn();
}
export function subscribeControls(fn){subscribers.add(fn);return ()=>subscribers.delete(fn);}
export function bindControlSettings(root,onChange,{explorer=false}={}){
 const get=k=>!explorer&&k==='wideTurns'?null:root.getElementById(k==='perspectiveCamera'&&explorer?'explorerCamera':k);
 const refresh=()=>{
  for(const k in controlSettings){const el=get(k);if(!el)continue;if(explorer&&k==='perspectiveCamera')el.value=controlSettings[k]?'perspective':'orthographic';else el.checked=controlSettings[k];}
  const rings=get('ringLabels'),guides=get('arrowGuides');if(rings)rings.disabled=!controlSettings.hoverRings;if(guides)guides.disabled=!controlSettings.showArrows;
  onChange();
 };
 for(const k in controlSettings){const el=get(k);if(el)el.addEventListener('change',()=>setControlSetting(k,explorer&&k==='perspectiveCamera'?el.value==='perspective':el.checked));}
 refresh();const stopOrbit=bindOrbitSettings(root),stop=subscribeControls(refresh);return()=>{stopOrbit();stop();};
}
