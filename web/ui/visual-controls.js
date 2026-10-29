import {visualSpecs,visualSettings,setVisualSetting,resetVisualSettings,faceLight,subscribeVisualSettings} from '../render/visual-settings.js';
export function initializeVisualControls(root,invalidate) {
  const $=id=>root.getElementById(id);
  const refresh=()=>{
    for(const [key,s] of Object.entries(visualSpecs)) {
      $(key).value=visualSettings[key];
      $(key+'Value').textContent=visualSettings[key]+s.unit;
    }
    invalidate();
  };
  for(const key of Object.keys(visualSpecs)) $(key).addEventListener('input',()=>setVisualSetting(key,Number($(key).value)));
  for(const prefix of ['light','dither','ascii']) $('reset'+prefix).onclick=()=>resetVisualSettings(prefix);
  $('faceLight').onclick=faceLight;
  refresh();return subscribeVisualSettings(refresh);
}
