import {turn} from './model.js';
import {turnTransform,composeRotation,movedCell} from '../render/transforms.js';

// Packing state and cached turn branches. No DOM, GPU or animation ownership.
export class CubeSession {
  constructor(){this.cells=[];this.history=[];this.turnCache=new WeakMap();}
  load(cells){
    this.cells=cells.map((cell,i)=>cell?Object.defineProperties({}, {...Object.getOwnPropertyDescriptors(cell),assemblyOrigin:{value:i,enumerable:false,writable:true,configurable:true}}):cell);
    this.initial=this.cells.slice();this.checkpoint();
  }
  checkpoint(){this.history=[];this.turnCache=new WeakMap();this.checkpointCells=this.cells;}
  rebaseInitial(){this.initial=this.cells.slice();}
  commit(move){
    const from=this.cells;
    this.history.push({ cells: from, move });
    let transitions=this.turnCache.get(from);
    if(!transitions){transitions=new Map();this.turnCache.set(from,transitions);}
    if(!transitions.has(move)){
      const next = turn(from.map((cell,i)=>cell && movedCell(i,move)?Object.defineProperties({}, {...Object.getOwnPropertyDescriptors(cell),solidRotation:{value:composeRotation(turnTransform(move,1),cell.solidRotation),configurable:true}}):cell), move);
      transitions.set(move,next);
      let inverse=this.turnCache.get(next);
      if(!inverse){inverse=new Map();this.turnCache.set(next,inverse);}
      inverse.set((move+15)%30,from);
    }
    this.cells=transitions.get(move);
  }
  undo(){if(!this.history.length)return false;this.cells=this.history.pop().cells;return true;}
  reset(){if(!this.checkpointCells)return false;this.cells=this.checkpointCells;this.history=[];return true;}
  mapCells(transform) {
    const mapped=new WeakMap(),pending=[],cache=new WeakMap();
    const map=cells=>{
      if(!mapped.has(cells)){mapped.set(cells,transform(cells));pending.push(cells);}
      return mapped.get(cells);
    };
    this.cells=map(this.cells);this.initial=map(this.initial);this.checkpointCells=map(this.checkpointCells);
    for(const h of this.history)h.cells=map(h.cells);
    for(let i=0;i<pending.length;i++){
      const from=pending[i],transitions=this.turnCache.get(from);
      if(transitions)cache.set(map(from),new Map([...transitions].map(([move,next])=>[move,map(next)])));
    }
    this.turnCache=cache;
  }
}
