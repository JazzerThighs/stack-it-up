import {cellsOf, displayIndex, ROTATIONS} from './model.js';
import {CubeStack} from '../engine/coordinates.js';

const templates = {
  O:[[0,0],[0,1],[1,0],[1,1]], T:[[0,0],[0,1],[0,2],[1,1]],
  J:[[0,0],[0,1],[0,2],[1,0]], L:[[0,0],[0,1],[0,2],[1,2]],
  Z:[[0,1],[0,2],[1,0],[1,1]], S:[[0,0],[0,1],[1,1],[1,2]],
};
const normalized = points => {
  const x=Math.min(...points.map(p=>p[0])), y=Math.min(...points.map(p=>p[1]));
  return points.map(p=>[p[0]-x,p[1]-y]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]).join(';');
};
const patterns=new Map();
for (const [letter,shape] of Object.entries(templates)) {
  let points=shape;
  for(let r=0;r<4;r++) {patterns.set(normalized(points),letter);points=points.map(([x,y])=>[y,-x]);}
}
// Use the explorer's established face coordinates, preserving J/L and S/Z.
const labels='123456789abcdefghijklmnopqr';
const faces=['123456789','jmpknqlor','1aj2bk3cl','9ir8hq7gp','147adgjmp','3cl6fo9ir']
  .map(face=>[...face].map(c=>displayIndex(labels.indexOf(c))));
export function identifyMask(mask) {
  const cells=cellsOf(mask);
  if(cells.length!==4) return null;
  for(const face of faces) {
    if(cells.every(i=>face.includes(i))) {
      return patterns.get(normalized(cells.map(i=>{const n=face.indexOf(i);return [Math.floor(n/3),n%3];}))) || null;
    }
  }
  const points=cells.map(CubeStack.xyz);
  for(let axis=0;axis<3;axis++) if(points.every(p=>p[axis]===points[0][axis])) {
    const letter=patterns.get(normalized(points.map(p=>p.filter((_,a)=>a!==axis))));
    if(letter) return 'JL'.includes(letter)?'J/L':'SZ'.includes(letter)?'S/Z':letter;
  }
  return null;
}
export function detectPieces(cells) {
  const groups=new Map();
  cells.forEach((cell,i)=>{if(cell?.piece>=0) groups.set(cell.piece,(groups.get(cell.piece)||0)|(1<<i));});
  return [...groups].sort(([a],[b])=>a-b).map(([id,mask])=>({id,mask,letter:identifyMask(mask)}));
}
export const maskKey = masks => [...masks].sort((a,b)=>a-b).join(',');
const rotateMask=(mask,rotation)=>cellsOf(mask).reduce((m,i)=>m|(1<<rotation[i]),0);
export function createFamilyLookup(packings) {
  const index=new Map();
  for(const packing of packings) {
    const key=maskKey(packing.masks.map(mask=>rotateMask(mask,Array.from({length:27},(_,i)=>displayIndex(i)))));
    if(!index.has(key)) index.set(key,[]);
    index.get(key).push(packing);
  }
  return cells=>{
    const pieces=detectPieces(cells);
    if(pieces.length!==6 || pieces.some(p=>!p.letter)) return {pieces,matches:[]};
    const matches=new Map();
    for(const rotation of ROTATIONS) {
      const key=maskKey(pieces.map(p=>rotateMask(p.mask,rotation)));
      for(const packing of index.get(key)||[]) matches.set(packing.lineNumber,packing);
    }
    return {pieces,matches:[...matches.values()]};
  };
}
export function chooseFamilyPacking(packings,families,familyId,random=Math.random) {
  const members=packings.filter(p=>String(families.get(p.lineNumber)?.family.id)===String(familyId));
  return members.length ? members[Math.floor(random()*members.length)] : null;
}
