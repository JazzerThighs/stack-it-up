import {identitySolid} from '../render/identity-solids.js';
import {detectedColor} from './family-colors.js';
import {detectPieces} from './family-exploration.js';
import {PALETTE} from './model.js';
import {CubeStack} from '../engine/coordinates.js';
import {compositeMesh} from '../render/piece-mesh.js';
import {balloon,box,xyz,rgb,rotateCell} from '../render/geometry.js';
import {clipMesh} from '../render/slice-mesh.js';

export function explorationMeshes(cells,generate,appearance,solidIdentities=false) {
  const detected=new Map(detectPieces(cells).filter(p=>p.letter).map(p=>[p.id,p.letter]));
  const groups=new Map();
  cells.forEach((cell,i)=>{
    if(!cell)return;
    const id=detected.has(cell.piece)?cell.piece:i+100;
    if(!groups.has(id))groups.set(id,[]);
    groups.get(id).push(i);
  });
  return [...groups.values()].map(indices=>{
    if(indices.length===4) {
      const board=Array(27).fill(0),ids=Array(27).fill(1);
      indices.forEach(i=>board[i]=detectedColor(detected.get(cells[i].piece),cells[i].color));
      return compositeMesh(board,ids,PALETTE,generate,appearance);
    }
    const out=[];
    for(const i of indices) {
      const color=rgb(PALETTE[cells[i].color]||PALETTE.d);
      if(solidIdentities && cells[i].piece>=0) identitySolid(out,xyz(i),.465,color,cells[i].piece);
      else (appearance==='voxel'?box:balloon)(out,xyz(i),.465,color);
    }
    return new Float32Array(out);
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
