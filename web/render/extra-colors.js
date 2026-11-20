import {visualSettings} from './visual-settings.js';
export const extraColorFields = ['extraCoreColor','extraCenterColor','extraEdgeColor','extraCornerColor'];
export function extraCubieType(cell) {
  return [Math.floor(cell/9),Math.floor(cell/3)%3,cell%3].filter(v=>v!==1).length;
}
export function extraCubieColor(cell,settings=visualSettings) {
  return settings[extraColorFields[extraCubieType(cell)]];
}
