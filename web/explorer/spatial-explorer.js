import {createPackingClient} from './data-client.js';
import {createEngine} from '../engine/wasm.js';
import {createExplorerViews} from './views.js';
import {canonicalColor,cellsOf,practicePair,displayIndex} from './model.js';
import {OFFICIAL_MASKS} from './data-store.js';

export async function initializeSpatialExplorer(root=document,dependencies={}) {
  const $=id=>root.getElementById(id);
  $('status').textContent='Loading local tetracube index…';
  const client=await (dependencies.client||createPackingClient());
  const engine=await (dependencies.engine||createEngine());
  $('positionalColors').closest('label').title='Assign a distinct color to each physical piece ID.';
  $('datasetSelect').value=dependencies.dataset==='classic'?'classic':'spatial';
  const info=client.info,families=new Map(info.families.map(f=>[f.id,f])),membership=new Map();
  let current,position=0,total=0,counts=[],generation=0,active='solved',scramble=[];
  const flags=['surfaceOnly','nonSurfaceOnly','allSurfaceIdentities','oneOfEach','officialOnly','iTunnelOnly','nonFaceboundSurface'];
  const types=['O','T','JL','SZ','B','D','F'];
  for(const id of ['oneOfEach','allSurfaceIdentities','officialOnly','surfaceOnly','nonSurfaceOnly'])$(id).checked=false;
  $('spatialFilters').hidden=false;
  function filters() {
    const f=Object.fromEntries(flags.map(id=>[id,$(id).checked]));
    for(const id of ['extraEdges','extraCorners','extraCenters'])f[id]=$(id).value;
    Object.assign(f,{family:+$('familySelect').value||0,bag:$('familyBag').value||'',spatial:$('datasetSelect').value==='classic'?'none':$('spatialComposition').value,planar:$('planarSpanning').value,coreType:$('corePieceType').value});
    f.counts=types.map(type=>({type,min:+$('countMin'+type).value||0,max:$('countMax'+type).value===''?6:+$('countMax'+type).value}));
    return f;
  }
  function remember(p) {
    if(!p)return p;
    membership.set(p.lineNumber,{family:families.get(p.familyId),bag:p.bag});
    if(membership.size>256)membership.delete(membership.keys().next().value);
    return p;
  }
  const provider={
    record:async id=>remember(await client.record(id)),lookup:(f,m)=>client.lookup(f,m),
    randomPair:async()=>{const pair=await client.pair(filters());return pair?.map(remember);},
    selectionChanged:async p=>{if(p)await query({line:p.lineNumber},false,false);},
    familyOptions:()=>info.families.filter(f=>counts[f.id]>0).map(f=>({...f,matching:counts[f.id]})),
    familyStart:async id=>{const result=await client.query({filters:{...filters(),family:id},random:true});remember(result.record);return result;},
  };
  const views=createExplorerViews({root,meshGenerator:mask=>engine.bandMesh(mask),data:provider});
  function options(select,items,label) {
    const value=select.value;select.replaceChildren();
    const any=document.createElement('option');any.value='';any.textContent=label;select.append(any);
    for(const [value,text]of items){const el=document.createElement('option');el.value=String(value);el.textContent=text;select.append(el);}
    select.value=value;
  }
  options($('familyBag'),info.bags.map(b=>[b,b]),'All identity bags');
  $('familyBag').disabled=false;
  function colors(p) {
    const result=Array(27).fill('w');if(p.extras&(1<<13))result[13]='l';
    const center=cellsOf(p.extras).find(i=>[Math.floor(i/9),Math.floor(i/3)%3,i%3].filter(v=>v!==1).length===1);
    if(center!==undefined)result[center]='k';
    if($('officialColors').checked&&p.familyId===info.officialFamily) {
      const extras=((1<<27)-1)^OFFICIAL_MASKS.reduce((a,b)=>a|b,0),pair=practicePair({masks:OFFICIAL_MASKS,extras},p);
      if(pair.compatible) {
        // Practice pairing rotates the target. Render its matching physical colors
        // in that same aligned orientation, not against unrotated catalog masks.
        return null;
      }
    }
    p.masks.forEach((m,i)=>cellsOf(m).forEach(c=>result[c]=$('positionalColors').checked?'bymogr'[i]:canonicalColor(p.identities[i])));
    return result;
  }
  function displayPacking(p) {
    let palette=colors(p);if(palette)return [p,palette];
    const extras=((1<<27)-1)^OFFICIAL_MASKS.reduce((a,b)=>a|b,0),pair=practicePair({masks:OFFICIAL_MASKS,extras},p);
    const masks=Array(6).fill(0),cellColors=Array(27).fill('w');
    for(let i=0;i<27;i++) {
      const cell=pair.right[displayIndex(i)];
      if(cell.piece>=0){masks[cell.piece]|=1<<i;cellColors[i]='brogym'['bymogr'.indexOf(cell.color)];}
      else cellColors[i]=i===13?'l':'w';
    }
    const ex=((1<<27)-1)^masks.reduce((a,b)=>a|b,0),black=cellsOf(ex).find(i=>[Math.floor(i/9),Math.floor(i/3)%3,i%3].filter(v=>v!==1).length===1);
    if(black!==undefined)cellColors[black]='k';return [{...p,masks,extras:ex},cellColors];
  }
  function paint() {
    if(!current)return;
    const [display,palette]=displayPacking(current);
    $('sourceLine').value=current.lineNumber;
    $('packingIndex').textContent=`${position+1} of ${total.toLocaleString()} matching · tetracubes-v2 line ${current.lineNumber}`;
    $('packingFamily').textContent=`Family ${current.familyId} · ${current.bag} · score ${current.score}`;
    $('packingCode').textContent=current.code;
    $('pieceIdentities').textContent=current.identities.map((c,i)=>`${i+1}: ${c}`).join(' · ');
    $('colorStatus').textContent=$('officialColors').checked&&current.familyId===info.officialFamily?'Official-compatible colors':$('positionalColors').checked?'Distinct physical-piece colors':'Canonical shape colors';
    $('scrambleText').textContent=scramble.join(' ');
    $('solutionText').textContent=scramble.slice().reverse().map(m=>m.endsWith("'")?m.slice(0,-1):m+"'").join(' ');
    views.showPieces(current,palette);
    const solved=$('showSolved').checked,scrambled=$('showScrambled').checked;
    $('solvedPanel').hidden=!solved;$('scrambledPanel').hidden=!scrambled;
    $('cubeLayout').dataset.views=Number(solved)+Number(scrambled);$('emptyView').hidden=solved||scrambled;
    if(active==='solved'&&!solved)active='scrambled';if(active==='scrambled'&&!scrambled)active='solved';
    $('cubeLayout').dataset.active=active;$('viewTabs').hidden=!(solved&&scrambled);
    $('viewSolved').setAttribute('aria-pressed',String(active==='solved'));$('viewScrambled').setAttribute('aria-pressed',String(active==='scrambled'));
    if(solved)views.showCube('solvedCube',display,palette);else views.hide('solvedCube');
    if(scrambled)views.showCube('scrambledCube',display,palette,scramble);else views.hide('scrambledCube');
    $('solvedFacelets').textContent='Native tetracube rendering. Catalog masks above retain the source orientation.';
  }
  function clearFilters() {
      $('datasetSelect').value='spatial';$('spatialComposition').disabled=false;
      for(const id of flags)$(id).checked=false;
      for(const id of ['familySelect','familyBag','spatialComposition','planarSpanning','corePieceType'])$(id).value='';
      for(const id of ['extraEdges','extraCorners','extraCenters'])$(id).value='any';
      for(const t of types){$('countMin'+t).value='0';$('countMax'+t).value='6';}
  }
  async function query(action={},refresh=false,apply=true) {
    const token=++generation;$('status').textContent='Filtering local index…';
    try {
      const f=filters();
      if(f.counts.some(c=>!Number.isInteger(c.min)||!Number.isInteger(c.max)||c.min<0||c.max>6||c.min>c.max)){throw Error('Piece counts must satisfy 0 ≤ minimum ≤ maximum ≤ 6.');}
      let result=await client.query({filters:f,position,...(action.offset&&current?{line:current.lineNumber}:{}),...action});if(token!==generation)return;
      if(!apply&&action.line&&result.record?.lineNumber!==action.line) {
        clearFilters();result=await client.query({filters:filters(),line:action.line});if(token!==generation)return;
      }
      total=result.count;position=result.position;counts=result.familyCounts;
      const optionsList=info.families.filter(f=>counts[f.id]||String(f.id)===$('familySelect').value);
      options($('familySelect'),optionsList.map(f=>[f.id,`Family ${f.id} · ${counts[f.id]} matching`]),'All families');
      for(const id of ['previous','next','random','back100','back10','forward10','forward100'])$(id).disabled=!total;
      $('status').textContent=`${total.toLocaleString()} matching packings in the local ${info.count.toLocaleString()}-packing collection.`;
      $('familySummary').textContent=`${counts.filter(n=>n>0).length.toLocaleString()} matching families`;
      if(result.record){current=remember(result.record);scramble=Array.from({length:20},()=>['U','D','F','B','L','R'][Math.floor(Math.random()*6)]+(Math.random()<.5?"'":''));paint();}
      else {$('packingIndex').textContent='No matches — previous cube retained';}
      if(result.record&&apply)await views.navigate(current);
    }catch(e){if(token===generation)$('status').textContent=e.message;}
  }
  for(const id of [...flags,'familySelect','familyBag','extraEdges','extraCorners','extraCenters','spatialComposition','planarSpanning','corePieceType',...types.flatMap(t=>['countMin'+t,'countMax'+t])])$(id).addEventListener('change',()=>query({position:0},true));
  function collectionChanged() {
    const classic=$('datasetSelect').value==='classic';
    $('spatialComposition').disabled=classic;
    $('spatialComposition').value=classic?'none':'';
    return query({position:0},true);
  }
  $('datasetSelect').onchange=collectionChanged;
  $('spatialComposition').disabled=$('datasetSelect').value==='classic';
  if($('spatialComposition').disabled)$('spatialComposition').value='none';
  $('random').onclick=()=>query({random:true});$('previous').onclick=()=>query({offset:-1});$('next').onclick=()=>query({offset:1});
  for(const [id,offset]of [['back100',-100],['back10',-10],['forward10',10],['forward100',100]])$(id).onclick=()=>query({offset});
  $('sourceJump').onsubmit=async e=>{
    e.preventDefault();try {
      const target=await provider.record(+$('sourceLine').value);
      clearFilters();
      await query({line:target.lineNumber},true);$('jumpStatus').textContent='Filters cleared for this tetracubes-v2 source line.';
    }catch(e){$('jumpStatus').textContent=e.message;}
  };
  $('exploreFamily').onclick=()=>{if(current){$('familySelect').value=String(current.familyId);return query({line:current.lineNumber},true);}};
  for(const id of ['canonicalColors','officialColors','positionalColors'])$(id).onchange=()=>{for(const other of ['canonicalColors','officialColors','positionalColors'])$(other).checked=other===id;paint();};
  $('copyCode').onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify({dataset:info.dataset,version:info.version,line:current.lineNumber,code:current.code}));$('status').textContent='Packing reference copied.';}catch{$('status').textContent='Select and copy the packing code above.';}};
  for(const [id,value]of [['viewSolved','solved'],['viewScrambled','scrambled']])$(id).onclick=()=>{active=value;paint();};
  for(const id of ['showSolved','showScrambled'])$(id).onchange=paint;
  $('closeSettings').onclick=()=>{$('settingsPanel').open=false;};
  $('settingsPanel').addEventListener('keydown',e=>{if(e.key==='Escape')$('settingsPanel').open=false;});
  await query({line:dependencies.initialLine??50152});await views.startMode();
  return {client,query,views,get current(){return current;}};
}
