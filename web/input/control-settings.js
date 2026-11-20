import {bindOrbitSettings} from './orbit-settings.js';
import {controlsSchema} from '../ui/controls-schema.js';
import {createSettingsStore,matchesSettingCondition} from '../ui/settings-store.js';
let storage;try{storage=globalThis.localStorage;}catch{}
const store=createSettingsStore(controlsSchema,storage);
export const controlSettings=store.values;
// Preserve the command API's boolean coercion; persisted input remains strict.
export const setControlSetting=(name,value)=>store.set(name,typeof controlsSchema.fields[name]?.value==='boolean'?!!value:value);
export const resetControlSettings=store.reset;
export const subscribeControls=store.subscribe;
export function bindControlSettings(root,onChange,{explorer=false}={}){
 const get=k=>controlsSchema.fields[k]?.controlIds?.[explorer?'explorer':'game']===null?null:root.getElementById(k==='perspectiveCamera'&&explorer?'explorerCamera':k);
 const refresh=()=>{
  for(const k in controlSettings){const el=get(k);if(!el)continue;if(explorer&&k==='perspectiveCamera')el.value=controlSettings[k]?'perspective':'orthographic';else if(typeof controlsSchema.fields[k].value==='boolean')el.checked=controlSettings[k];else {el.value=controlSettings[k];const output=root.getElementById(k+'Value');if(output)output.textContent=String(controlSettings[k])+(k==='bluetoothSliceWindow'||k==='bluetoothWideWindow'?' ms':'x');}}
  for(const [id,spec]of Object.entries(controlsSchema.fields))if(spec.enabledWhen&&get(id))get(id).disabled=!matchesSettingCondition(spec.enabledWhen,k=>({checked:controlSettings[k]}));
  onChange();
 };
 for(const k in controlSettings){const el=get(k);if(el)el.addEventListener(controlsSchema.fields[k].commit,()=>setControlSetting(k,explorer&&k==='perspectiveCamera'?el.value==='perspective':typeof controlsSchema.fields[k].value==='boolean'?el.checked:Number(el.value)));}
 if(!explorer)root.getElementById('bluetoothSliceReset')?.addEventListener('click',()=>store.reset('bluetoothSliceWindow'));
 if(!explorer)root.getElementById('bluetoothWideReset')?.addEventListener('click',()=>store.reset('bluetoothWideWindow'));
 root.getElementById('turnAnimationReset')?.addEventListener('click',()=>store.reset('turnAnimationSpeed'));
 refresh();const stopOrbit=bindOrbitSettings(root),stop=subscribeControls(refresh);return()=>{stopOrbit();stop();};
}
