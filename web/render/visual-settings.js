// Shared display preferences; no puzzle state or mesh data is changed.
export const visualSpecs = {"solidUniform":{"min":0,"max":1,"step":1,"value":1,"unit":"","checkbox":true},"solidColor":{"value":"#c8c8c8","color":true},"solidFixed":{"min":0,"max":1,"step":1,"value":0,"unit":"","checkbox":true},"solidGray":{"min":0,"max":1,"step":1,"value":1,"unit":"","checkbox":true},"ditherTransparency":{"min":0,"max":1,"step":1,"value":1,"unit":"","checkbox":true},"lightAzimuth": {"min": -180, "max": 180, "step": 1, "value": -20, "unit": "\u00b0"}, "lightElevation": {"min": -85, "max": 85, "step": 1, "value": 25, "unit": "\u00b0"}, "lightIntensity": {"min": 0, "max": 3, "step": 0.05, "value": 1, "unit": "\u00d7"}, "lightAmbient": {"min": 0, "max": 1, "step": 0.05, "value": 0.35, "unit": ""}, "ditherLevels": {"min": 2, "max": 17, "step": 1, "value": 5, "unit": ""}, "ditherSize": {"min": 1, "max": 6, "step": 0.5, "value": 2, "unit": "px"}, "ditherContrast": {"min": 0.5, "max": 5, "step": 0.1, "value": 2.5, "unit": "\u00d7"}, "ditherMidpoint": {"min": 0, "max": 1, "step": 0.05, "value": 0.6, "unit": ""}, "asciiSize": {"min": 0.5, "max": 2, "step": 0.1, "value": 1, "unit": "\u00d7"}, "asciiExposure": {"min": 0.5, "max": 3, "step": 0.1, "value": 1, "unit": "\u00d7"}, "asciiDensity": {"min": 0.5, "max": 2, "step": 0.1, "value": 1, "unit": "\u00d7"}, "asciiCoverage": {"min": 0.02, "max": 0.6, "step": 0.02, "value": 0.16, "unit": ""}, "asciiBlend": {"min": 0, "max": 1, "step": 0.1, "value": 1, "unit": ""}};
// 0: model default, 1: surface-angle lighting, 2: positional lighting.
for(const [key,value] of [['lightPieces',0],['lightCubies',1],['lightSolids',1],['lightOther',1]])
  visualSpecs[key]={min:0,max:2,step:1,value,unit:'',select:true};
visualSpecs.jellyCornerO={min:0,max:1,step:1,value:0,checkbox:true};
visualSpecs.jellyBevel={min:1,max:41,step:1,value:15,unit:""};
visualSpecs.jellyProfile={min:1.05,max:6,step:0.05,value:2,unit:""};
visualSpecs.jellyElbows={min:0,max:100,step:5,value:100,unit:"%"};
visualSpecs.jellyOpening={min:1,max:48,step:1,value:24,unit:""};
export function jellyStyleKey(){return [visualSettings.jellyCornerO,visualSettings.jellyBevel,visualSettings.jellyOpening,visualSettings.jellyProfile,visualSettings.jellyElbows].join(":");}
export const visualSettings = Object.fromEntries(Object.entries(visualSpecs).map(([k,s])=>[k,s.value]));
const listeners=new Set();
function valid(key,value) {
  const spec=visualSpecs[key];
  if(spec?.color)return typeof value==='string' && /^#[0-9a-f]{6}$/i.test(value)?value:null;
  if(!spec || typeof value !== 'number' || !Number.isFinite(value)) return null;
  const n=Math.max(spec.min,Math.min(spec.max,value));
  return Number((spec.min+Math.round((n-spec.min)/spec.step)*spec.step).toFixed(4));
}
try {
  const saved=JSON.parse(globalThis.localStorage?.getItem('stack-it-up.visual') || 'null');
  for(const key of Object.keys(visualSpecs)) {
    const n=valid(key,saved?.[key]);if(n!==null) visualSettings[key]=n;
  }
} catch {}
function publish() {
  try {globalThis.localStorage?.setItem('stack-it-up.visual',JSON.stringify(visualSettings));} catch {}
  for(const fn of listeners) fn();
}
export function setVisualSetting(key,value) {
  const n=valid(key,value);if(n===null)return false;
  visualSettings[key]=n;publish();return true;
}
export function resetVisualSettings(prefix='') {
  for(const [key,s] of Object.entries(visualSpecs)) if(key.startsWith(prefix)) visualSettings[key]=s.value;
  publish();
}
export function faceLight() {visualSettings.lightAzimuth=0;visualSettings.lightElevation=0;publish();}
export function lightDirection() {
  const a=visualSettings.lightAzimuth*Math.PI/180,e=visualSettings.lightElevation*Math.PI/180;
  return [Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e)];
}
export function subscribeVisualSettings(fn) {listeners.add(fn);return ()=>listeners.delete(fn);}
