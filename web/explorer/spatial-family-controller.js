import {detectPieces} from './family-exploration.js';
import {displayIndex,practicePair} from './model.js';
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
  const button=$('familyLockShapes');
  function syncButton(){button.disabled=!locked&&(busy||!matched);button.textContent=locked?'Unlock shapes':'Lock shapes';button.setAttribute('aria-pressed',String(!!locked));button.title=locked?`Starter line ${locked.record.lineNumber}; navigation stays in family ${family}.`:'Keep the current matched packing’s cut shapes through turns and family navigation.';}
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
    if(locked&&p.familyId!==family)throw Error(`Unlock shapes to leave family ${family}.`);
    cancel();++lookupGeneration;source=p;family=p.familyId;
    $('familyExploreTitle').textContent=`Family ${family} · Line ${p.lineNumber}`;
    view=get('familyExploreCube',{onChange:changed});view.familyExploration=true;
    const shown=data.presentation(p);
    if(!locked){view.fixedPieceColors=shown.fixed;view.setCells(shown.cells);return;}
    const token=run;
    busy=true;view.orbitOnly=true;syncButton();
    try{
      const pair=practicePair(locked.packing,shown.packing,{targetColors:true});
      if(!pair.compatible)throw Error('No compatible physical-piece mapping for this packing.');
      view.fixedPieceColors=true;
      // Every destination starts from the same captured geometry, never the last destination.
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
    const shown=data.presentation(source),reference=locked?practicePair(locked.packing,shown.packing,{targetColors:true}).right:shown.cells;
    view.fixedPieceColors=locked?true:shown.fixed;view.cells=recolor(view.cells,reference);view.initial=recolor(view.initial,reference);
    for(const h of view.history)h.cells=recolor(h.cells,reference);
    view.setState(view.cells,view.currentAnimation);
  }
  function unlock(){cancel();locked=null;if(view){view.lockedAssembly=null;view.assembly=displaySettings.familyPieces;view.setState(view.cells);}data.lockFamily?.(null);refreshColors();if(view)changed(view);}
  button.onclick=async()=>{
    if(locked){unlock();return;}
    if(busy)return;
    if(!matched||!view||view.busy)return;
    locked={record:matched,cells:view.cells.slice(),packing:packingFromCells(view.cells)};
    source=matched;
    $('familyExploreTitle').textContent=`Family ${family} · Line ${source.lineNumber}`;
    view.lockedAssembly='retained';view.assembly='retained';view.fixedPieceColors=true;view.setCells(locked.cells);
    const token=run;
    await data.selectionChanged?.(source);
    if(!locked||token!==run)return;
    await data.lockFamily?.(family);syncButton();
  };
  function enter(){if(!source||source.lineNumber!==getSelected()?.lineNumber)return load(getSelected());}
  $('familySolidIdentities').onchange=()=>{if(view){view.setState(view.cells,view.currentAnimation);changed(view);}};
  syncButton();
  return {enter,load,refreshColors,leave(){if(locked)unlock();else cancel();},refresh(){if($('familyExploreMode').checked)return load(getSelected());}};
}
