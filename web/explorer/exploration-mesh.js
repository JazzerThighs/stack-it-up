import {cubieScale} from '../render/cubie-size.js';
import {bracketCell} from '../render/text-mesh.js';
import {assemblyKind} from '../render/assembly.js';
import {joinMeshes} from '../render/cell-fragments.js';
import {gameboyCell} from '../render/gameboy-mesh.js';
import {tagCoverage} from '../render/transparency.js';
import {identitySolid,identityGray,solidColor} from '../render/identity-solids.js';
import {detectedColor} from './family-colors.js';
import {detectPieces} from './family-exploration.js';
import {PALETTE} from './model.js';
import {CubeStack} from '../engine/coordinates.js';
import {compositeParts,jellyCell} from '../render/piece-mesh.js';
import {balloon,box,xyz,rgb,rotateCell} from '../render/geometry.js';
import {clipMesh} from '../render/slice-mesh.js';

export function explorationMeshes(cells,generate,appearance,solidIdentities=false,gray=true,fixedColors=false,individual=false,filters={},allSolids=false,assembly=null,exportParts=null) {
  const detected=new Map(detectPieces(cells,filters).filter(p=>p.letter).map(p=>[p.id,p.letter]));
  const kind=cell=>assembly?assemblyKind(assembly,detected.has(cell.piece),cell.piece<0):cell.piece<0?'cubies':allSolids?'solids':detected.has(cell.piece)?individual?'cubies':'whole':solidIdentities?'solids':'cubies';
  const groups=new Map();
  cells.forEach((cell,i)=>{
    if(!cell)return;
    const id=kind(cell)==='whole'?cell.piece:i+100;
    if(!groups.has(id))groups.set(id,[]);
    groups.get(id).push(i);
  });
  return [...groups.values()].map(indices=>{
    const finish=mesh=>{exportParts?.push({data:mesh,piece:cells[indices[0]].piece,cells:indices.slice()});return mesh;};
    if(indices.length===4) {
      const board=Array(27).fill(0),ids=Array(27).fill(1);
      indices.forEach(i=>board[i]=fixedColors?cells[i].color:detectedColor(detected.get(cells[i].piece),cells[i].color));
      const parts=compositeParts(board,ids,PALETTE,generate,appearance,false,0,individual);
      // Keep immutable cached geometry identity: fragment caches are keyed by it.
      // A one-piece join used to copy every vertex and force the same cuts again.
      return finish(parts.length===1?parts[0]:joinMeshes(parts));
    }
    const out=[];
    for(const i of indices) {
      const key=!fixedColors&&detected.has(cells[i].piece)?detectedColor(detected.get(cells[i].piece),cells[i].color):cells[i].color;
      const color=rgb(PALETTE[key]||PALETTE.d);
      if(kind(cells[i])==='solids') identitySolid(out,xyz(i),.465,cells[i].piece<0?color:solidColor(cells[i].piece,color,gray),cells[i].piece<0?5:cells[i].piece,cells[i].solidRotation);
      else if(['jelly','angular'].includes(appearance))jellyCell(out,i,color,generate,.465,appearance);
      else (appearance==='text'?bracketCell:appearance==='gameboy'?gameboyCell:scaledBalloon)(out,xyz(i),.465,color,cells[i].piece<0?'bomb':'loose');
    }
    const mesh=tagCoverage(new Float32Array(out),xyz(indices[0]));
    if(kind(cells[indices[0]])==='solids')Object.defineProperty(mesh,"identityCell",{value:indices[0]});
    return finish(mesh);
  });
}
export function sliceForTurn(meshes,move) {
  const [,axis,layer,side]=CubeStack.moves[move%15];
  const rotating=[],stationary=[];
  const append=(out,mesh)=>{for(const v of mesh)out.push(v);};
  for(const mesh of meshes) {
    if(layer===1) {
      append(stationary,clipMesh(mesh,axis,-.5,-1));
      append(stationary,clipMesh(mesh,axis,.5,1));
      append(rotating,clipMesh(clipMesh(mesh,axis,-.5,1),axis,.5,-1));
    } else {
      const sign=side===2?1:-1, plane=(layer==='wide'?-.5:.5)*sign;
      append(rotating,clipMesh(mesh,axis,plane,sign));
      append(stationary,clipMesh(mesh,axis,plane,-sign));
    }
  }
  const representative=Array.from({length:27},(_,i)=>i).find(i=>{
    const p=CubeStack.xyz(i)[axis];return layer==='wide'?p!==2-side:p===layer;
  });
  return {rotating,stationary,representative};
}
export function animateSlices(parts,move,t) {
  const out=parts.rotating.slice();
  rotateCell(out,0,parts.representative,move,t);
  for(const v of parts.stationary)out.push(v);
  return new Float32Array(out);
}

function scaledBalloon(out,p,h,color){balloon(out,p,h*cubieScale(),color);}
