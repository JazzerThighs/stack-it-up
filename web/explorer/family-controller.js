import {createFamilyLookup,chooseFamilyPacking} from './family-exploration.js';
import {familyPackingCells} from './family-colors.js';
import {identityShapeNames} from '../render/identity-solids.js';

export function createFamilyExplorer({$,get,getPackings,getFamilies,getSelected}) {
  let lookup,familyId,source,view;
  try { $('familySolidIdentities').checked=globalThis.localStorage?.getItem('stack-it-up.family-solids')==='true'; } catch {}
  $('familySolidIdentities').onchange=()=>{
    const enabled=$('familySolidIdentities').checked;
    try {globalThis.localStorage?.setItem('stack-it-up.family-solids',String(enabled));} catch {}
    if(view) {
      view.explorationSolids=enabled;
      view.setState(view.cells,view.currentAnimation);
      changed(view);
    }
  };
  function changed(cube) {
    if(!lookup)return;
    const {pieces,matches}=lookup(cube.cells),count=pieces.filter(p=>p.letter).length;
    $('familyExploreProgress').textContent=`${count}/6 tetrominos`+
      (count===6?(matches.length?` · Packing found · line ${matches[0].lineNumber}`:' · Complete, not cataloged in this family'):' · Explore / details');
    $('familyExploreLetters').textContent=pieces.map(p=>`Piece ${p.id+1}${cube.explorationSolids ? ` (${identityShapeNames[p.id]})` : ''}: ${p.letter||'separated'}`).join(' · ');
    const host=$('familyExploreMatches');host.replaceChildren();
    for(const packing of matches) {
      const row=document.createElement('p'),code=document.createElement('code');
      row.textContent=`Source line ${packing.lineNumber} · Family ${familyId} · Bag ${packing.bag||'unknown'}`;
      code.textContent=packing.masks.map(m=>m.toString(16).padStart(7,'0')).join(' ')+
        ` extras=${packing.extras.toString(16).padStart(7,'0')}`;
      host.append(row,code);
    }
    if(count===6) {
      const note=document.createElement('p');
      note.textContent='Catalog masks use the catalog orientation; matches ignore whole-cube rotation and color assignments.';
      host.append(note);
    }
  }
  function start() {
    const id=$('familyExploreSelect').value;
    const packing=chooseFamilyPacking(getPackings(),getFamilies(),id);
    if(!packing){$('familyExploreProgress').textContent='No packings in this family.';return;}
    familyId=id;source=packing;
    const members=getPackings().filter(p=>String(getFamilies().get(p.lineNumber)?.family.id)===id);
    lookup=createFamilyLookup(members);
    $('familyExploreTitle').textContent=`Family ${id} · ${members.length} packings`;
    const cube=view=get('familyExploreCube',{onChange:changed});
    cube.explorationSolids=$('familySolidIdentities').checked;
    cube.familyExploration=true;
    // ID colors stay fixed in state; completed shapes use canonical render colors.
    cube.setCells(familyPackingCells(packing));
  }
  function enter() {
    if(source)return;
    const families=[...new Map([...getFamilies().values()].map(m=>[m.family.id,m.family])).values()];
    $('familyExploreSelect').replaceChildren();
    for(const family of families) {
      const option=document.createElement('option');option.value=String(family.id);
      option.textContent=`Family ${family.id} · ${family.count||family.members.length} packings`;
      $('familyExploreSelect').append(option);
    }
    $('familyExploreSelect').value=$('familySelect').value || String(getFamilies().get(getSelected()?.lineNumber)?.family.id||families[0]?.id||'');
    start();
  }
  $('familyExploreSelect').onchange=start;
  $('familyExploreRandom').onclick=start;
  return {enter};
}
