import {detectPieces} from './family-exploration.js';
import {familyPackingCells} from './family-colors.js';
import {displayIndex} from './model.js';
const inverse=Array.from({length:27},(_,i)=>Array.from({length:27},(_,j)=>j).find(j=>displayIndex(j)===i));
export function createSpatialFamilyExplorer({$,get,getSelected,data}) {
  let view,source,family,generation=0,lookupGeneration=0;
  try{const saved=localStorage.getItem('stack-it-up.family-solids');if(saved!==null)$('familySolidIdentities').checked=saved==='true';}catch{}
  async function changed(cube) {
    const token=++lookupGeneration,group=detectPieces(cube.cells),count=group.filter(p=>p.letter).length;
    $('familyExploreProgress').textContent=`${count}/6 tetracubes${count===6?' — Checking packing…':''}`;
    $('familyExploreLetters').textContent=group.map(p=>`Piece ${p.id+1}: ${p.letter||'separated'}`).join(' · ');
    const host=$('familyExploreMatches');host.replaceChildren();
    if(count!==6)return;
    const masks=group.map(p=>inverse.reduce((m,j,i)=>m|((p.mask&(1<<i))?1<<j:0),0));
    try {
      const matches=await data.lookup(family,masks);if(token!==lookupGeneration)return;
      $('familyExploreProgress').textContent=matches.length?'6/6 tetracubes — Packing found':'6/6 tetracubes — Not listed in this family';
      for(const p of matches) {
        const row=document.createElement('p'),code=document.createElement('code');
        row.textContent=`${p.dataset} · Line ${p.lineNumber} · Family ${p.familyId} · ${p.identities.join('')} · Score ${p.score}`;
        code.textContent=p.code;host.append(row,code);
      }
    }catch(e){if(token===lookupGeneration)$('familyExploreProgress').textContent=e.message;}
  }
  function load(p) {
    if(!p)return;
    ++generation;++lookupGeneration;source=p;family=p.familyId;
    $('familyExploreTitle').textContent=`Family ${family} · Line ${p.lineNumber}`;
    view=get('familyExploreCube',{onChange:changed});view.familyExploration=true;
    view.explorationSolids=$('familySolidIdentities').checked;const shown=data.presentation(source);view.fixedPieceColors=shown.fixed;view.setCells(shown.cells);
  }
  function refreshColors() {
    if(!view||!source)return;
    const shown=data.presentation(source),byId=new Map(shown.cells.filter(c=>c.piece>=0).map(c=>[c.piece,c.color]));
    const recolor=cells=>cells.map(c=>c.piece<0?c:Object.defineProperties({}, {...Object.getOwnPropertyDescriptors(c),color:{value:byId.get(c.piece),writable:true,enumerable:true,configurable:true}}));
    view.fixedPieceColors=shown.fixed;view.cells=recolor(view.cells);view.initial=recolor(view.initial);
    for(const h of view.history)h.cells=recolor(h.cells);
    view.setState(view.cells,view.currentAnimation);
  }
  function enter() {if(!source||source.lineNumber!==getSelected()?.lineNumber)load(getSelected());}
  $('familySolidIdentities').onchange=()=>{
    try{localStorage.setItem('stack-it-up.family-solids',String($('familySolidIdentities').checked));}catch{}
    if(view){view.explorationSolids=$('familySolidIdentities').checked;view.setState(view.cells,view.currentAnimation);changed(view);}
  };
  return {enter,load,refreshColors,refresh(){if($('familyExploreMode').checked)load(getSelected());}};
}
