import {S} from '../engine/snapshot.js';
import {choices} from '../engine/queue-pieces.js';
import {landedState} from './animations.js';

// Stack cells stay fixed. Only the active/freed occupancy follows the held turn.
export function faceMapLevels(before, after, cell, t) {
  t=Math.max(0,Math.min(1,t));
  const has=(s,field)=>Number(!!(s[field] & (1<<cell)));
  return {
    active:has(before,S.ACTIVE)*(1-t)+has(after,S.ACTIVE)*t,
    floating:has(before,S.FLOATING)*(1-t)+has(after,S.FLOATING)*t,
  };
}
export function createFaceMap(copies,colors,names,faceLabels) {
  let cachedState,cachedMove,landed;
  return (state,animation=null)=>{
    if(!state)return;
    const turning=animation?.kind==='turn',move=turning?animation.move:null;
    if(state!==cachedState || move!==cachedMove){
      cachedState=state;cachedMove=move;
      landed=turning?landedState(state,move):state;
    }
    const t=turning?animation.t:0,activeColor=colors[choices(state[S.PIECE])[0]];
    for(let f=0;f<6;f++)for(let c=0;c<9;c++){
      const i=state[80+f*9+c],levels=faceMapLevels(state,landed,i,t);
      const total=Math.min(1,levels.active+levels.floating),stack=state[i];
      const floating=levels.floating*100,active=total*100;
      for(const cells of copies){
        const el=cells[f][c];
        el.style.backgroundColor=stack?colors[stack]:'#2a343b';
        el.style.backgroundImage=total>0?`linear-gradient(to top, #ffffff 0% ${floating}%, ${activeColor} ${floating}% ${active}%, transparent ${active}% 100%)`:'';
        el.classList.toggle('active',total>0);
        el.classList.toggle('overlap',total>0 && !!stack);
        el.title=`${faceLabels[f]} ${c+1}: ${stack?`${names[stack]} stack`:'empty'}${total>0?`, active ${Math.round(total*100)}%`:''}`;
      }
    }
  };
}
