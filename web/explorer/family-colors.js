// Permanent ID colors maximize canonical matches, then minimize RGB distance
// for duplicate letters. Rendering can recolor completed shapes independently.
import {packingCells,CANONICAL_COLORS,cellsOf} from './model.js';
import {detectPieces} from './family-exploration.js';
import {defaultColors} from '../render/palette.js';
import {rgb} from '../render/geometry.js';
const keys=[...'ymobgr'];
const reference=Object.fromEntries(keys.map((key,i)=>[key,rgb(defaultColors[i+1])]));
const targets=letter=>(letter||'').split('/').map(l=>CANONICAL_COLORS[l]).filter(Boolean);
const distance=(a,b)=>reference[a].reduce((sum,v,i)=>sum+(v-reference[b][i])**2,0);
export function assignIdentityColors(letters) {
  let best, bestExact=-1,bestCost=Infinity;
  function visit(colors,unused,exact,cost) {
    if(!unused.length) {
      if(exact>bestExact || exact===bestExact && cost<bestCost) {best=colors;bestExact=exact;bestCost=cost;}
      return;
    }
    const desired=targets(letters[colors.length]);
    for(const key of unused)visit([...colors,key],unused.filter(k=>k!==key),exact+Number(desired.includes(key)),
      cost+(desired.length?Math.min(...desired.map(d=>distance(key,d))):0));
  }
  visit([],keys,0,0);return best;
}
export function detectedColor(letter,identityColor) {
  const desired=targets(letter);
  if(!desired.length)return identityColor;
  if(desired.includes(identityColor))return identityColor;
  if(!reference[identityColor])return desired[0];
  // Internal J/L and S/Z have no unique outward-facing handedness.
  return desired.reduce((best,key)=>distance(key,identityColor)<distance(best,identityColor)?key:best,desired[0]);
}
export function familyPackingCells(packing) {
  const colors=Array(27).fill('w');colors[13]='l';
  const extraCenter=cellsOf(packing.extras).find(i=>[Math.floor(i/9),Math.floor(i/3)%3,i%3].filter(v=>v!==1).length===1);
  if(extraCenter!==undefined)colors[extraCenter]='k';
  const cells=packingCells(packing,colors),detected=detectPieces(cells);
  const assigned=assignIdentityColors(detected.map(p=>p.letter));
  for(const cell of cells)if(cell.piece>=0)cell.color=assigned[cell.piece];
  return cells;
}
