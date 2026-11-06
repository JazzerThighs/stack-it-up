import {assemblyOptions} from '../render/assembly.js';
export const displaySpecs={
 familyPieces:{value:'whole',options:assemblyOptions.map(([value])=>value)},practiceStartPieces:{value:'cubies',options:assemblyOptions.map(([value])=>value)},practiceTargetPieces:{value:'whole',options:assemblyOptions.map(([value])=>value)},activePieces:{value:'solids',options:assemblyOptions.map(([value])=>value)},stackPieces:{value:'whole',options:assemblyOptions.map(([value])=>value)},
 gameActiveSize:{value:100,min:50,max:160},gameStackSize:{value:100,min:50,max:160},familySize:{value:100,min:50,max:160},practiceStartSize:{value:100,min:50,max:160},practiceTargetSize:{value:100,min:50,max:160},uiTheme:{value:'teal',options:['teal','slate','violet','amber']}
};
export const displaySettings=Object.fromEntries(Object.entries(displaySpecs).map(([k,s])=>[k,s.value]));
const valid=(k,v)=>displaySpecs[k]?.options?displaySpecs[k].options.includes(v):typeof v==='number'&&Number.isFinite(v)&&v>=displaySpecs[k]?.min&&v<=displaySpecs[k]?.max;
try{const saved=JSON.parse(globalThis.localStorage?.getItem('stack-it-up.display')||'{}');for(const [oldKey,key]of [['gameCombinedSize','gameActiveSize'],['targetSize','practiceTargetSize'],['startSize','practiceStartSize']])if(saved[oldKey]!==undefined&&(saved[key]===undefined||saved[key]===100))saved[key]=saved[oldKey];if(saved.gamePieces&&!saved.stackPieces)saved.stackPieces=saved.gamePieces;for(const k in saved)if(valid(k,saved[k]))displaySettings[k]=saved[k];}catch{}
const listeners=new Set();
export function setDisplaySetting(k,v){if(!valid(k,v))return;displaySettings[k]=v;try{globalThis.localStorage?.setItem('stack-it-up.display',JSON.stringify(displaySettings));}catch{}for(const fn of listeners)fn(k);}
export function subscribeDisplay(fn){listeners.add(fn);return()=>listeners.delete(fn);}
export const viewPreferences={solvedCube:['practiceTargetPieces','practiceTargetSize'],scrambledCube:['practiceStartPieces','practiceStartSize'],familyExploreCube:['familyPieces','familySize'],practiceLeft:['practiceStartPieces','practiceStartSize'],practiceRight:['practiceTargetPieces','practiceTargetSize']};
const themes={teal:['#111b20','#192b31','#a7e1cb','#edf6f2','#a5b9bb','#385158'],slate:['#141922','#232c3a','#9fc5ff','#f0f4fa','#aab8ce','#40536c'],violet:['#1b1624','#2b2238','#d1b0ff','#f6f0ff','#bfb0d0','#594569'],amber:['#201b14','#33291d','#efca82','#fff4df','#c4b598','#66553b']};
export function initializeDisplayControls(root,onChange=()=>{}){
 const get=id=>{try{return root.getElementById(id);}catch{return null;}};
 const refresh=()=>{
  for(const [id,spec]of Object.entries(displaySpecs)){const el=get(id);if(el){el.value=displaySettings[id];if(get(id+'Value'))get(id+'Value').textContent=displaySettings[id]+'%';}}
  const host=root.host||root.documentElement;
  if(host?.style?.setProperty){const colors=themes[displaySettings.uiTheme];for(const [i,key]of ['--bg','--panel','--accent','--ink','--muted','--border'].entries())host.style.setProperty(key,colors[i]);host.style.setProperty('--mint',colors[2]);host.style.setProperty('--line',colors[5]);host.setAttribute('data-ui-theme',displaySettings.uiTheme);}
 };
 for(const [id,spec]of Object.entries(displaySpecs)){const el=get(id);el?.addEventListener(spec.options?'change':'input',()=>setDisplaySetting(id,spec.options?el.value:Number(el.value)));}
 get('modelShape')?.addEventListener('change',refresh);
 refresh();return subscribeDisplay(key=>{refresh();onChange(key);});
}
