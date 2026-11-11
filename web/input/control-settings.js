import {bindOrbitSettings} from './orbit-settings.js';
import {controlsSchema} from '../ui/controls-schema.js';
import {createSettingsStore,matchesSettingCondition} from '../ui/settings-store.js';
let storage;try{storage=globalThis.localStorage;}catch{}
const store=createSettingsStore(controlsSchema,storage);
export const controlSettings=store.values;
// Preserve the command API's boolean coercion; persisted input remains strict.
export const setControlSetting=(name,value)=>store.set(name,!!value);
export const subscribeControls=store.subscribe;
export function bindControlSettings(root,onChange,{explorer=false}={}){
 const get=k=>!explorer&&k==='wideTurns'?null:root.getElementById(k==='perspectiveCamera'&&explorer?'explorerCamera':k);
 const refresh=()=>{
  for(const k in controlSettings){const el=get(k);if(!el)continue;if(explorer&&k==='perspectiveCamera')el.value=controlSettings[k]?'perspective':'orthographic';else el.checked=controlSettings[k];}
  for(const [id,spec]of Object.entries(controlsSchema.fields))if(spec.enabledWhen&&get(id))get(id).disabled=!matchesSettingCondition(spec.enabledWhen,k=>({checked:controlSettings[k]}));
  onChange();
 };
 for(const k in controlSettings){const el=get(k);if(el)el.addEventListener('change',()=>setControlSetting(k,explorer&&k==='perspectiveCamera'?el.value==='perspective':el.checked));}
 refresh();const stopOrbit=bindOrbitSettings(root),stop=subscribeControls(refresh);return()=>{stopOrbit();stop();};
}
