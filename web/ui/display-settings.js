import {displaySchema} from './display-schema.js';
import {createSettingsStore} from './settings-store.js';
export const displaySpecs=displaySchema.fields;
let storage;try{storage=globalThis.localStorage;}catch{}
const store=createSettingsStore(displaySchema,storage);
export const displaySettings=store.values;
export const setDisplaySetting=store.set;
export const subscribeDisplay=store.subscribe;
export const viewPreferences={solvedCube:['practiceTargetPieces','practiceTargetSize'],scrambledCube:['practiceStartPieces','practiceStartSize'],familyExploreCube:['familyPieces','familySize'],practiceLeft:['practiceStartPieces','practiceStartSize'],practiceRight:['practiceTargetPieces','practiceTargetSize']};
const themes={teal:['#111b20','#192b31','#a7e1cb','#edf6f2','#a5b9bb','#385158'],slate:['#141922','#232c3a','#9fc5ff','#f0f4fa','#aab8ce','#40536c'],violet:['#1b1624','#2b2238','#d1b0ff','#f6f0ff','#bfb0d0','#594569'],amber:['#201b14','#33291d','#efca82','#fff4df','#c4b598','#66553b']};
export function initializeDisplayControls(root,onChange=()=>{}){
 const get=id=>{try{return root.getElementById(id);}catch{return null;}};
 const refresh=()=>{
  for(const [id,spec]of Object.entries(displaySpecs)){const el=get(id);if(el){el.value=displaySettings[id];if(get(id+'Value'))get(id+'Value').textContent=displaySettings[id]+(spec.unit||'');}}
  const host=root.host||root.documentElement;
  if(host?.style?.setProperty){const colors=themes[displaySettings.uiTheme];for(const [i,key]of ['--bg','--panel','--accent','--ink','--muted','--border'].entries())host.style.setProperty(key,colors[i]);host.style.setProperty('--mint',colors[2]);host.style.setProperty('--line',colors[5]);host.setAttribute('data-ui-theme',displaySettings.uiTheme);}
 };
 for(const [id,spec]of Object.entries(displaySpecs)){const el=get(id);el?.addEventListener(spec.commit,()=>setDisplaySetting(id,spec.options?el.value:Number(el.value)));}
 get('modelShape')?.addEventListener('change',refresh);
 refresh();return subscribeDisplay(key=>{refresh();onChange(key);});
}
