import {detectPieces} from './family-exploration.js';
import {detectedColor} from './family-colors.js';
import {displayIndex,practicePair} from './model.js';
import {assemblyUsesSolids} from '../render/assembly.js';
import {displaySettings} from '../ui/display-settings.js';
const inverse=Array.from({length:27},(_,i)=>Array.from({length:27},(_,j)=>j).find(j=>displayIndex(j)===i));
const recolor=(cells,reference)=>{
  const byId=new Map(reference.filter(c=>c?.piece>=0).map(c=>[c.piece,c.color]));
  return cells.map(c=>!c||c.piece<0?c:Object.defineProperties({}, {...Object.getOwnPropertyDescriptors(c),color:{value:byId.get(c.piece)||c.color,writable:true,enumerable:true,configurable:true}}));
};
// Capture the visible orientation and physical IDs, rather than the catalogue's orientation.
export function packingFromCells(cells){
  const masks=Array(6).fill(0),cellColors=Array(27);let extras=0;
  cells.forEach((c,i)=>{const j=inverse[i];cellColors[j]=c.color;if(c.piece>=0)masks[c.piece]|=1<<j;else extras|=1<<j;});
  return {masks,extras,cellColors};
}
export function createSpatialFamilyExplorer({$,get,getSelected,data}) {
  let view,source,family,lookupGeneration=0,matched=null,locked=null,run=0,busy=false,worker=null,cancelJob=null;
  const button=$('familyLockShapes'),colorButton=$('familyLockColors');
  function syncButton(){
    for(const [control,mode,label] of [[button,'shapes','shapes'],[colorButton,'colors','colors']]){
      const active=locked?.mode===mode;
      control.disabled=!!locked&&!active || !locked&&(busy||!matched);
      control.textContent=active?`Unlock ${label}`:`Lock ${label}`;
      control.setAttribute('aria-pressed',String(active));
      control.title=active?`Starter line ${locked.record.lineNumber}; navigation stays in family ${family}.`:mode==='colors'?'Keep starting piece colors; rebuild shapes as valid tetracubes are found.':'Keep starting cut shapes; update colors for each destination packing.';
    }
  }
  function cancel(){run++;worker?.terminate();worker=null;cancelJob?.();cancelJob=null;busy=false;if(view){view.generation++;view.busy=false;view.orbitOnly=false;view.playbackMs=null;}syncButton();}
  function path(a,b){
    if(typeof Worker==='undefined')return import('./practice-path.js').then(m=>m.planPracticePath(a,b));
    return new Promise((resolve,reject)=>{worker=new Worker(new URL('./practice-worker.js',import.meta.url),{type:'module'});cancelJob=()=>reject(Error('Path cancelled'));worker.onmessage=({data})=>{worker?.terminate();worker=null;cancelJob=null;data.error?reject(Error(data.error)):resolve(data.moves);};worker.onerror=()=>{worker?.terminate();worker=null;cancelJob=null;reject(Error('Could not construct the family path'));};worker.postMessage({source:a,target:b});});
  }
  async function changed(cube) {
    if(busy)return;
    const token=++lookupGeneration,group=detectPieces(cube.cells,cube.detectionFilters),count=group.filter(p=>p.letter).length;
    matched=null;syncButton();
    $('familyExploreProgress').textContent=`${count}/6 tetracubes${count===6?' - Checking packing.':''}`;
    $('familyExploreLetters').textContent=group.map(p=>`Piece ${p.id+1}: ${p.letter||'separated'}`).join(' · ');
    const host=$('familyExploreMatches');host.replaceChildren();
    if(count!==6)return;
    const masks=group.map(p=>inverse.reduce((m,j,i)=>m|((p.mask&(1<<i))?1<<j:0),0));
    try {
      const matches=await data.lookup(family,masks);if(token!==lookupGeneration)return;
      matched=matches[0]||null;syncButton();
      $('familyExploreProgress').textContent=matches.length?'6/6 tetracubes - Packing found':'6/6 tetracubes - Not listed in this family';
      for(const p of matches) {
        const row=document.createElement('p'),code=document.createElement('code');
        row.textContent=`${p.dataset} · Line ${p.lineNumber} · Family ${p.familyId} · ${p.identities.join('')} · Score ${p.score}`;
        code.textContent=p.code;host.append(row,code);
      }
    }catch(e){if(token===lookupGeneration)$('familyExploreProgress').textContent=e.message;}
  }
  async function load(p) {
    if(!p)return;
    if(locked&&p.familyId!==family)throw Error(`Unlock ${locked.mode} to leave family ${family}.`);
    cancel();++lookupGeneration;source=p;family=p.familyId;
    $('familyExploreTitle').textContent=`Family ${family} · Line ${p.lineNumber}`;
    view=get('familyExploreCube',{onChange:changed});view.familyExploration=true;
    const shown=data.presentation(p);
    if(!locked){view.fixedPieceColors=shown.fixed;view.setCells(shown.cells);return;}
    const token=run;
    busy=true;view.orbitOnly=true;syncButton();
    try{
      const pair=practicePair(locked.packing,shown.packing,{targetColors:locked.mode==='shapes'});
      if(!pair.compatible)throw Error('No compatible physical-piece mapping for this packing.');
      view.fixedPieceColors=true;
      // Always replay from the captured starter; preserve either its colors or its geometry.
      view.setCells(recolor(locked.cells,pair.right));
      $('familyExploreProgress').textContent='Finding and verifying a family path…';
      const moves=await path(pair.left.map(c=>c.piece),pair.right.map(c=>c.piece));
      if(token!==run)return;
      view.playbackMs=45;
      for(let i=0;i<moves.length;i++){
        if(token!==run)return;
        $('familyExploreProgress').textContent=`Family path: ${i+1} / ${moves.length} turns`;
        view.orbitOnly=false;const step=view.play(moves[i]);view.orbitOnly=true;await step;
      }
    }catch(e){if(token===run)$('familyExploreProgress').textContent=e.message;throw e;}
    finally{if(token===run){busy=false;view.orbitOnly=false;view.playbackMs=null;syncButton();}}
    if(token===run)await changed(view);
  }
  function refreshColors() {
    if(!view||!source)return;
    if(locked?.mode==='colors'){view.fixedPieceColors=true;view.setState(view.cells,view.currentAnimation);return;}
    const shown=data.presentation(source),reference=locked?practicePair(locked.packing,shown.packing,{targetColors:true}).right:shown.cells;
    view.fixedPieceColors=locked?true:shown.fixed;view.cells=recolor(view.cells,reference);view.initial=recolor(view.initial,reference);
    for(const h of view.history)h.cells=recolor(h.cells,reference);
    view.setState(view.cells,view.currentAnimation);
  }
  function unlock(){cancel();locked=null;if(view){view.lockedAssembly=null;view.assembly=displaySettings.familyPieces;view.individualPieces=view.assembly==='cubies';view.explorationSolids=assemblyUsesSolids(view.assembly);view.setState(view.cells);}data.lockFamily?.(null);refreshColors();if(view)changed(view);}
  async function lock(mode){
    if(locked){unlock();return;}
    if(busy)return;
    if(!matched||!view||view.busy)return;
    // Capture what is actually visible, including canonical recoloring after manual turns.
    const detected=new Map(detectPieces(view.cells,view.detectionFilters).map(p=>[p.id,p.letter]));
    const cells=recolor(view.cells,view.cells.map(c=>c.piece<0||view.fixedPieceColors?c:{...c,color:detectedColor(detected.get(c.piece),c.color)}));
    locked={mode,record:matched,cells,packing:packingFromCells(cells)};
    source=matched;
    $('familyExploreTitle').textContent=`Family ${family} · Line ${source.lineNumber}`;
    view.lockedAssembly=mode==='shapes'?'retained':'whole';view.assembly=view.lockedAssembly;view.individualPieces=false;view.explorationSolids=false;view.fixedPieceColors=true;view.setCells(locked.cells);
    const token=run;
    await data.selectionChanged?.(source);
    if(!locked||token!==run)return;
    await data.lockFamily?.(family);syncButton();
  };
  button.onclick=()=>lock('shapes');
  colorButton.onclick=()=>lock('colors');
  function enter(){if(!source||source.lineNumber!==getSelected()?.lineNumber)return load(getSelected());}
  $('familySolidIdentities').onchange=()=>{if(view){view.setState(view.cells,view.currentAnimation);changed(view);}};
  syncButton();
  return {enter,load,refreshColors,leave(){if(locked)unlock();else cancel();},refresh(){if($('familyExploreMode').checked)return load(getSelected());}};
}
