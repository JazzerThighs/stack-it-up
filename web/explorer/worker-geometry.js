import {createGeometryClient} from '../workers/geometry-client.js';
import {visualSettings} from '../render/visual-settings.js';
import {PALETTE} from './model.js';
import {withCoverage} from '../render/transparency.js';
import {CubeStack} from '../engine/coordinates.js';
export function partitionKey(move){const [,axis,layer,side]=CubeStack.moves[move%15];return axis*5+(layer==='wide'?(side===0?3:4):layer);}
const unpack=mesh=>mesh.coverage?withCoverage(mesh.data,mesh.coverage):mesh.data;
// Session provenance is deliberately non-enumerable. Materialize it before
// structured cloning so retained cuts and identity rotations survive transport.
const packCells=cells=>cells.map(cell=>cell?{...cell,assemblyOrigin:cell.assemblyOrigin,solidRotation:cell.solidRotation}:cell);

export class WorkerGeometry {
  constructor(view,createWorker){
    this.view=view;this.createWorker=createWorker;this.pending=false;this.disposed=false;this.revision=0;
    this.retry=document.createElement('button');this.retry.type='button';this.retry.textContent='Retry graphics';this.retry.hidden=true;
    this.retry.onclick=()=>{this.failedToken=null;this.error=null;view.setState(view.cells,view.currentAnimation);};
    view.status.parentElement?.append(this.retry);
  }
  sync(cells,animation,key){
    this.base={key,cells,initial:this.view.initial,shape:this.view.modelShape,assembly:this.view.assembly,
      settings:{...visualSettings},palette:{...PALETTE},
      solids:this.view.explorationSolids,gray:this.view.explorationGray,fixedColors:this.view.familyExploration?this.view.fixedPieceColors:true,
      individual:this.view.individualPieces,filters:this.view.detectionFilters||{}};
    return this.prepare(animation?.kind==='turn'?animation.move:undefined);
  }
  prepare(move){
    const view=this.view,key=this.base.key,partition=move===undefined?null:partitionKey(move),token=key+':'+partition;
    if(!this.pending&&this.readyKey===key&&(partition===null||view.motionPartitions.has(partition)))return Promise.resolve(true);
    if(this.pending&&this.token===token)return this.task;
    if(this.failedToken===token)return Promise.resolve(false);
    const revision=++this.revision,started=performance.now();
    this.token=token;this.pending=true;this.error=null;this.refreshStatus();
    const request=structuredClone({...this.base,cells:packCells(this.base.cells),initial:packCells(this.base.initial),...(move===undefined?{}:{move})});
    this.task=Promise.resolve().then(()=>{
      if(this.disposed||this.revision!==revision)return null;
      this.client??=createGeometryClient(this.createWorker());
      return this.client.request(request);
    }).then(result=>{
      if(!result||this.disposed||this.revision!==revision)return false;
      const uploadStarted=performance.now();
      const upload=(target,mesh)=>{view.upload(target,unpack(mesh));};
      if(this.readyKey!==key){
        view.fixedSolidBuffers??=Array.from({length:27},()=>view.buffer());
        view.explorationLayers??=Array.from({length:45},()=>view.buffer());
        upload(view.solid,result.solid);
        result.fixed.forEach((mesh,i)=>upload(view.fixedSolidBuffers[i],mesh));
        view.motionPartitions=new Set();this.readyKey=key;
      }
      if(result.motion){result.motion.meshes.forEach((mesh,i)=>upload(view.explorationLayers[result.motion.key*3+i],mesh));view.motionPartitions.add(result.motion.key);}
      this.timings={...result.timings,uploadMs:performance.now()-uploadStarted,requestMs:performance.now()-started};
      view.canvas.dataset.geometrySource='worker';return true;
    }).catch(error=>{
      if(!this.disposed&&this.revision===revision){this.error=error;this.failedToken=token;this.client?.dispose();this.client=null;}
      return false;
    }).finally(()=>{
      if(!this.disposed&&this.revision===revision){this.pending=false;this.refreshStatus();view.invalidate();}
    });
    return this.task;
  }
  async ready(){while(this.pending&&!this.disposed)await this.task;return !this.error&&!this.disposed;}
  refreshStatus(){
    this.view.onAvailabilityChange?.(this.view);
    this.view.canvas.setAttribute('aria-busy',String(this.pending));this.retry.hidden=!this.error;
    if(this.error)this.view.status.textContent='Graphics preparation failed. Retry graphics.';
    else if(this.pending)this.view.status.textContent='Preparing geometry…';
    else this.view.status.textContent=this.view.history.length+' turns';
    if(this.view.undoButton)this.view.undoButton.disabled=this.pending||!!this.error||!this.view.history.length;
  }
  dispose(){this.disposed=true;this.client?.dispose();this.retry.remove();}
}
