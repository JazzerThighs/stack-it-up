import {pointerRay} from "../render/camera.js";
import { S } from '../engine/snapshot.js';
import { xyz } from '../render/geometry.js';

// Hit-test actual occupied cells, not just the cube's outer faces. This allows
// selecting a recessed white group through a gap without selecting through solids.
export function pickBand(r, e, state) {
  if (!state || r.isStack) return -1;
  const {origin,dir}=pointerRay(r,e);
  let nearest = Infinity, selected = -1;
  for (let i=0;i<27;i++) {
    const floating = !!(state[S.FLOATING] & (1<<i));
    const active = !!(state[S.ACTIVE] & (1<<i));
    if (!floating && !active && !(r.combined && state[i])) continue;
    const p=xyz(i), h=0.46;
    let lo=0, hi=Infinity;
    for(let a=0;a<3;a++) {
      if(Math.abs(dir[a])<1e-8) { if(Math.abs(origin[a]-p[a])>h) hi=-1; }
      else { const t1=(p[a]-h-origin[a])/dir[a],t2=(p[a]+h-origin[a])/dir[a];
        lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2)); }
    }
    if(hi>=lo && lo<nearest) {
      nearest=lo;
      selected=floating && state[S.BAND_IDS+i] ? i : -1;
    }
  }
  return selected;
}
