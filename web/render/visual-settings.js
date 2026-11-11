import {appearanceSchema} from '../ui/appearance-schema.js';
import {createSettingsStore} from '../ui/settings-store.js';
export const visualSpecs=appearanceSchema.fields;
let storage;try{storage=globalThis.localStorage;}catch{}
const store=createSettingsStore(appearanceSchema,storage);
export const visualSettings=store.values;
export const setVisualSetting=store.set;
export const resetVisualSettings=store.reset;
export const subscribeVisualSettings=store.subscribe;
export function faceLight(){store.patch({lightAzimuth:0,lightElevation:0});}
export function jellyStyleKey(includeSize=true){return [includeSize?visualSettings.cubieScale:100,visualSettings.jellyCornerO,visualSettings.jellyBevel,visualSettings.jellyOpening,visualSettings.jellyProfile,visualSettings.jellyElbows].join(':');}
export function lightDirection(){
 const a=visualSettings.lightAzimuth*Math.PI/180,e=visualSettings.lightElevation*Math.PI/180;
 return [Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e)];
}
