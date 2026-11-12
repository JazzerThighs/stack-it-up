import {explorationMeshes} from '../explorer/exploration-mesh.js';
import {capturePieceFragments,retainedPieceFragments} from '../explorer/retained-pieces.js';
import {mergeFragments,joinMeshes,exposedFragment,neighborCell} from '../render/cell-fragments.js';
import {visualSettings} from '../render/visual-settings.js';
import {colors,packingPalette} from '../render/palette.js';
import {CubeStack} from '../engine/coordinates.js';

export function motionPartition(move) {
  const [,axis,layer,side]=CubeStack.moves[move%15];
  const mode=layer==='wide'?(side===0?3:4):layer;
  return {axis,mode,key:axis*5+mode};
}
// This owner runs serially in a geometry-only worker, never against live game state.
export function createGeometryPreparation(generate) {
  let state=null,retainedSource=null,retainedKey=null;
  return request=>{
    const started=performance.now();
    Object.assign(visualSettings,request.settings);
    for(const key of ['w','k','l','d'])packingPalette[key]=request.palette[key];
    for(const [index,key] of [...'ymobgr','B','D','F'].entries())colors[index+1]=request.palette[key];
    if(state?.key!==request.key) {
      const {cells,initial,shape,assembly}=request;
      let retained=null;
      if(assembly==='retained') {
        const key=JSON.stringify([initial,shape,request.settings,request.palette]);
        if(retainedKey!==key){retainedSource=capturePieceFragments(initial,generate,shape,request.palette);retainedKey=key;}
        retained=retainedPieceFragments(retainedSource,cells);
      }
      const meshStart=performance.now(),exportParts=[];
      const meshes=retained?retained.fragments.map((mesh,i)=>exposedFragment(mesh,i,(axis,side)=>!retained.joined(i,axis,side))):
        explorationMeshes(cells,generate,shape,request.solids,request.gray,request.fixedColors,request.individual,request.filters,assembly==='solids',assembly,exportParts);
      if(retained)meshes.forEach((mesh,i)=>{if(mesh.length)exportParts.push({piece:cells[i].piece,cells:[i],data:mesh});});
      const meshMs=performance.now()-meshStart;
      const cutting=performance.now(),turning=meshes.filter(m=>m.identityCell===undefined);
      const fragments=retained?.fragments||mergeFragments(turning);
      const fragmentMs=performance.now()-cutting;
      const assembling=performance.now();
      const solid=joinMeshes(turning);
      const fixed=Array.from({length:27},(_,cell)=>joinMeshes(meshes.filter(m=>m.identityCell===cell)));
      state={key:request.key,exportParts,solid,fixed,fragments,retained,partitions:new Map(),timings:{meshMs,fragmentMs,assemblyMs:performance.now()-assembling}};
    }
    let motion=null;
    if(request.move!==undefined) {
      const {axis,mode,key}=motionPartition(request.move);
      if(!state.partitions.has(key)) {
        const moving=cell=>mode<3?cell===mode:cell!==(mode===3?2:0);
        const visible=state.fragments.map((mesh,cell)=>exposedFragment(mesh,cell,(a,sign)=>{
          const neighbor=neighborCell(cell,a,sign);
          return neighbor<0||(state.retained&&!state.retained.joined(cell,a,sign))||moving(CubeStack.xyz(cell)[axis])!==moving(CubeStack.xyz(neighbor)[axis]);
        }));
        const layers=Array.from({length:3},(_,slice)=>{
          const mesh=joinMeshes(visible.filter((_,cell)=>CubeStack.xyz(cell)[axis]===slice));
          return mesh;
        });
        // Keep one prepared motion partition; other partitions can be recomputed.
        state.partitions.clear();state.partitions.set(key,layers);
      }
      motion={key,meshes:state.partitions.get(key)};
    }
    return {exportParts:request.exportModel?state.exportParts:undefined,key:state.key,solid:state.solid,fixed:state.fixed,motion,timings:{...state.timings,jobMs:performance.now()-started}};
  };
}

// Typed-array custom properties do not survive structured cloning. Pack coverage
// explicitly and transfer COPIES: worker caches must never become detached.
export function packGeometry(result) {
  const transfer=[];
  const pack=source=>{
    const data=source.slice(),coverage=source.coverage?.slice();
    transfer.push(data.buffer);if(coverage)transfer.push(coverage.buffer);
    return {data,coverage};
  };
  const value={...result,exportParts:result.exportParts?.map(part=>({...part,data:pack(part.data).data})),solid:pack(result.solid),fixed:result.fixed.map(pack),motion:result.motion&&{key:result.motion.key,meshes:result.motion.meshes.map(pack)}};
  value.timings={...value.timings,transferBytes:transfer.reduce((sum,b)=>sum+b.byteLength,0)};
  return {value,transfer};
}
