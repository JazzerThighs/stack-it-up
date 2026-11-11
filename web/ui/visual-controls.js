import {refreshStyleTuning} from './style-tuning.js';
import {visualSpecs,visualSettings,setVisualSetting,resetVisualSettings,faceLight,subscribeVisualSettings} from '../render/visual-settings.js';
export function initializeVisualControls(root,invalidate) {
  const $=id=>root.getElementById(id);
  const refresh=()=>{
    for(const [key,s] of Object.entries(visualSpecs)) {
      if(s.checkbox) $(key).checked=!!visualSettings[key];
      else $(key).value=visualSettings[key];
      if(!s.select && $(key+'Value')) $(key+'Value').textContent=s.checkbox ? (visualSettings[key]?'On':'Off') : visualSettings[key]+(s.unit || "");
    }
    refreshStyleTuning(root);
    invalidate();
  };
  for(const [key,s] of Object.entries(visualSpecs)) $(key).addEventListener(s.commit,()=>setVisualSetting(key,s.checkbox?Number($(key).checked):(s.color?$(key).value:Number($(key).value))));
  // Rebuild geometry on release, not at every intermediate slider tick.
  for(const [key,s] of Object.entries(visualSpecs))if(s.commit==='change'&&!s.checkbox&&!s.select&&!s.color)$(key).addEventListener('input',()=>{$(key+'Value').textContent=$(key).value+(s.unit||'');});
  for(const prefix of ['light','dither','ascii']) $('reset'+prefix).onclick=()=>resetVisualSettings(prefix);
  $('faceLight').onclick=faceLight;
  for(const id of ['modelShape','pieceAppearance'])$(id).addEventListener('change',()=>refreshStyleTuning(root));
  refresh();return subscribeVisualSettings(refresh);
}
