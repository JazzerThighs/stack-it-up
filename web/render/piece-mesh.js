import {bracketCell,bracketPiece} from './text-mesh.js';
import {assemblyKind} from './assembly.js';
import {identitySolid,solidColor} from './identity-solids.js';
import {angularPiece} from './angular-mesh.js';
import {jellyStyleKey} from './visual-settings.js';
import {visualSettings} from './visual-settings.js';
import {gameboyPiece,gameboyCell} from './gameboy-mesh.js';
import {identifyMask} from '../explorer/family-exploration.js';
import {placedTetracubeColor} from './tetracube-colors.js';
import {tagCoverage} from './transparency.js';
import {joinMeshes} from './cell-fragments.js';
// Shared native surfaces and retained colored pieces. Fragments can key their
// cache by these stable arrays, independent of the current packing or piece ID.
import {rgb, xyz} from './geometry.js';
const cache=new Map(),colored=new Map();
let coloredBytes=0;
export function compositeParts(board,ids,palette,generate,appearance='jelly',spatialColors=false,extrasMask=0,individual=false) {
  const groups=new Map();
  for(let i=0;i<27;i++)if(board[i]) {
    const key=ids[i]+':'+board[i],g=groups.get(key)||{mask:0,color:board[i],id:ids[i]};
    g.mask|=1<<i;groups.set(key,g);
  }
  const slots=new Map([...new Set([...groups.values()].map(g=>g.id))].map((id,i)=>[id,i]));
  const pieces=[...groups.values()].flatMap(g=>{
    const kind=typeof individual==='string'?assemblyKind(individual,!!identifyMask(g.mask),!!(g.mask&extrasMask)):individual?'cubies':'whole';
    return kind==='whole'?[g]:Array.from({length:27},(_,i)=>i).filter(i=>g.mask&(1<<i)).map(i=>({...g,wholeMask:g.mask,mask:1<<i,solidIdentity:kind==='solids'}));
  });
  return pieces.map(({mask,color,wholeMask,id,solidIdentity})=>{
    if(solidIdentity){const out=[],cell=31-Math.clz32(mask),slot=slots.get(id)||0;identitySolid(out,xyz(cell),.465,solidColor(slot,rgb(palette[color])),slot);return tagCoverage(new Float32Array(out),xyz(cell));}
    const cornerO=appearance==='jelly' && !!visualSettings.jellyCornerO && identifyMask(mask)==='O';
    const geometryKey=mask+':'+cornerO+':'+jellyStyleKey();
    const bomb=!!(mask&extrasMask);
    const hex=(spatialColors && placedTetracubeColor(wholeMask||mask)) || palette[color],key=mask+':'+hex+':'+appearance+':'+bomb+':'+cornerO+':'+jellyStyleKey();
    if(colored.has(key))return colored.get(key);
    const out=[],c=rgb(hex);
    if(appearance==='angular') {
      for(const v of angularPiece(mask,c))out.push(v);
    } else if(appearance==='text') {
      for(const v of bracketPiece(mask,c))out.push(v);
    } else if(appearance==='gameboy') {
      const letter=bomb?'bomb':identifyMask(mask)||'loose';
      for(const v of gameboyPiece(mask,c,letter))out.push(v);
    } else {
      if(!cache.has(geometryKey)) {
        if(cache.size>=192)cache.delete(cache.keys().next().value);
        cache.set(geometryKey,generate(mask,cornerO));
      }
      const source=cache.get(geometryKey);
      for(let i=0;i<source.length;i+=9)out.push(...source.subarray(i,i+6),...c);
    }
    const mesh=tagCoverage(new Float32Array(out),xyz(31-Math.clz32(mask&-mask)));
    while(coloredBytes+mesh.byteLength>16*1024*1024 && colored.size) {
      const first=colored.keys().next().value;coloredBytes-=colored.get(first).byteLength;colored.delete(first);
    }
    colored.set(key,mesh);coloredBytes+=mesh.byteLength;return mesh;
  });
}
export function compositeMesh(board,ids,palette,generate,appearance='jelly') {
  const parts=compositeParts(board,ids,palette,generate,appearance);
  return joinMeshes(parts);
}

// Loose jelly cells use the same native surface and shaping-keyed cache as
// connected fragments. Keep identity solids and current-piece spheres distinct.
export function jellyCell(out,cell,color,generate,halfSize=0.465,appearance='jelly') {
  if(appearance==='text'){bracketCell(out,xyz(cell),halfSize,color);return;}
  if(appearance==='gameboy'){gameboyCell(out,xyz(cell),halfSize,color,'loose');return;}
  const board=Array(27).fill(0),ids=Array(27).fill(1);board[cell]=1;
  const mesh=compositeParts(board,ids,['','#ffffff'],generate,appearance)[0];
  const center=xyz(cell),scale=halfSize/0.465;
  for(let i=0;i<mesh.length;i+=9) {
    for(let k=0;k<3;k++)out.push(center[k]+(mesh[i+k]-center[k])*scale);
    out.push(mesh[i+3],mesh[i+4],mesh[i+5],...color);
  }
}
