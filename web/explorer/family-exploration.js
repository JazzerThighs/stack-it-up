import {pieces as pieceCatalog} from '../engine/pieces.js';
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
const spatialLetters=new Map(pieceCatalog.filter(p=>p.spatial).flatMap(p=>p.placements.map(m=>[m,p.letter])));
export function identifyMask(mask) {
  const cells=cellsOf(mask);
  if(cells.length!==4) return null;
  if(spatialLetters.has(mask))return spatialLetters.get(mask);
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
// Per-piece exclusions come from the same count categories as the catalog.
// Minimum counts constrain complete packings, not an individual four-cell group.
export function allowedDetectedPiece(mask,letter,filters={}) {
  if(!letter)return false;
  const limits=new Map((filters.counts||[]).map(c=>[c.type,c.max]));
  const permits=type=>!limits.has(type)||limits.get(type)>0;
  const type=letter.replace('/',''),core=!!(mask&(1<<13));
  const facebound=faces.some(face=>cellsOf(mask).every(i=>face.includes(i)));
  const spatial='BDF'.includes(letter),placement=core?'CorePieces':facebound?'Facebound':'SurfaceNonface';
  if(!permits(type)||!permits(placement))return false;
  if('JL'.includes(letter)&&!permits('JL')||'SZ'.includes(letter)&&!permits('SZ'))return false;
  if(filters.spatial==='none'&&spatial||filters.spatial==='only'&&!spatial)return false;
  if(filters.allSurfaceIdentities&&!facebound||filters.surfaceOnly&&core||filters.nonFaceboundSurface&&(core||facebound))return false;
  if(filters.planar==='none'&&!spatial&&!facebound)return false;
  if(core&&filters.coreType&&!filters.coreType.toUpperCase().includes(letter[0]))return false;
  return true;
}
export function detectPieces(cells,filters={}) {
  const groups=new Map();
  cells.forEach((cell,i)=>{if(cell?.piece>=0) groups.set(cell.piece,(groups.get(cell.piece)||0)|(1<<i));});
  return [...groups].sort(([a],[b])=>a-b).map(([id,mask])=>({id,mask,letter:allowedDetectedPiece(mask,identifyMask(mask),filters)?identifyMask(mask):null}));
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
