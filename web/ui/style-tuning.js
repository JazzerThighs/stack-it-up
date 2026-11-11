import {appearanceSchema} from './appearance-schema.js';
import {matchesSettingCondition} from './settings-store.js';
export function refreshStyleTuning(root){
 for(const [id,condition]of Object.entries(appearanceSchema.availability)){
  const element=root.getElementById(id);
  if(element)element.hidden=!matchesSettingCondition(condition,key=>root.getElementById(key));
 }
}
