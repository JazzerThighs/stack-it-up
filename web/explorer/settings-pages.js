import {assemblyUsesSolids} from '../render/assembly.js';
// Explorer settings keep their original controls/listeners; only their layout moves.
export function initializeExplorerSettings(root) {
  const content=root.querySelector?.('.settings-content');
  if(!content || content.dataset.paged)return;
  content.dataset.paged='true';
  const $=id=>root.getElementById(id),find=s=>content.querySelector(s);
  const heading=find('.settings-heading');
  heading.querySelector('p')?.remove();
  const title=heading.querySelector('strong');title.tabIndex=-1;
  const pages=[],buttons=[];
  const body=document.createElement('div');body.className='explorer-page-body';
  const back=document.createElement('button');back.type='button';back.textContent='Back';back.className='explorer-page-back';
  const page=(name,parent=null)=>{
    const element=document.createElement('section');element.className='explorer-settings-page';
    element.setAttribute('aria-label',name);const node={name,parent,element};pages.push(node);
    if(parent){const button=document.createElement('button');button.type='button';button.className='explorer-page-link';button.textContent=name+' ›';button.onclick=()=>show(node);parent.element.append(button);buttons.push({node,button});}
    body.append(element);return node;
  };
  const add=(page,...nodes)=>nodes.filter(Boolean).forEach(n=>page.element.append(n));
  const unpack=(page,node)=>{if(!node)return;for(const child of [...node.children])if(!child.matches('legend,summary'))add(page,child);};
  const help=(page,text)=>{const p=document.createElement('p');p.className='settings-help';p.textContent=text;add(page,p);};
  const home=page('Settings');
  const mode=page('Explorer mode',home);unpack(mode,find('.explorer-modes'));
  help(mode,'Turn both modes off to browse target and scrambled cubes.');
  // Retain old controls for saved integrations, but expose only editable counts.
  const legacy=document.createElement('div');legacy.hidden=true;
  for(const node of [$('datasetSelect').closest('label'),$('familyBag').closest('label'),$('spatialFilters'),find('.filter-flags'),$('puzzleShapeFilters'),find('.extra-filters')])if(node)legacy.append(node);
  $('packingPicker').append(legacy);
  const controls=page('Controls',home);
  help(controls,'Shared with the game. Changes apply to both apps.');
  const input=page('Input',controls);unpack(input,$('explorerInputSettings'));
  const hover=page('Hover feedback',controls);unpack(hover,$('explorerHoverSettings'));
  const camera=page('Camera',controls);add(camera,$('explorerCamera').closest('label'),$('freeOrbit').closest('label'));
  const settling=page('Orbit controls',camera);
  for(const [id,name]of [['orbitMouseSettings','Mouse buttons'],['orbitGestureSettings','Drag response'],['orbitAxesSettings','Axis zones'],['orbitAlignmentSettings','Release alignment'],['orbitDebugSettings','Diagnostics']]){const field=$(id);unpack(page(name,settling),field);field.remove();}
  unpack(settling,$('settlingOrbitSettings'));
  const views=page('Views',home);
  unpack(views,find('.window-controls'));
  $('targetComposite').closest('label').hidden=true;add(views,$('targetComposite').closest('label'));
  unpack(page('Cube sizes',views),$('cubeSizeSettings'));
  help(views,'Visible-cube switches apply to standard browsing. Family and practice modes use their own views.');
  const appearance=page('Appearance',home);add(appearance,$('modelShape').closest('label'),$('pieceAppearance').closest('label'));
  unpack(page('Piece assembly',appearance),$('pieceAssemblySettings'));
  unpack(page('Interface theme',appearance),$('interfaceSettings'));
  const colors=page('Colors',appearance);unpack(colors,find('.color-controls'));
  help(colors,'Official uses canonical colors outside family 562. Official-Compatible / Multicolor fallback keeps distinct piece colors in every family.');
  const palette=page('Tetromino palette',colors);unpack(palette,find('.piece-colors'));
  const solids=page('Balls & Platonic Solids',appearance);
  const solidField=$('familySolidIdentities').closest('fieldset');unpack(solids,solidField);
  const tuning={};
  for(const [name,id]of [['Transparency','ditherTransparency'],['Lighting','lightAzimuth'],['Dither tuning','ditherLevels'],['ASCII tuning','asciiSize']]) {
    const sub=page(name,appearance);unpack(sub,$(id).closest('details'));tuning[id]=sub;
    if(id==='lightAzimuth')add(page('Jelly shaping',appearance),$('jellyShaping'));
  }
  const lightClasses=page('Lighting by element',tuning.lightAzimuth);
  const classes=body.querySelector('#lightingClasses');
  unpack(lightClasses,classes);classes.remove();

  let current=home;
  function refresh() {
    const family=$('familyExploreMode').checked,practice=$('practiceMode').checked;
    for(const id of ['showSolved','showScrambled'])$(id).disabled=family||practice;
    $('targetComposite').disabled=family;
    const solidsOn=['familyPieces','practiceStartPieces','practiceTargetPieces','activePieces','stackPieces'].some(id=>assemblyUsesSolids($(id).value));
    $('familySolidIdentities').disabled=!family;
    for(const id of ['solidUniform','solidFixed'])$(id).disabled=!solidsOn;
    $('solidColor').disabled=!solidsOn||!$('solidUniform').checked;
    $('solidGray').disabled=!solidsOn||$('solidUniform').checked;
    const style=$('pieceAppearance').value;
    $('ditherTransparency').disabled=style==='dither';
    for(const {node,button} of buttons) {
      button.disabled=(node===tuning.ditherLevels&&style!=='dither')||(node===tuning.asciiSize&&style!=='ascii');
      button.title=button.disabled?'Select the matching piece style first.':'';
    }
  }
  function show(node) {
    current=node;for(const p of pages)p.element.hidden=p!==node;
    title.textContent=node.name;back.hidden=!node.parent;body.scrollTop=0;refresh();title.focus({preventScroll:true});
  }
  back.onclick=()=>show(current.parent||home);
  content.replaceChildren(heading,back,body);
  content.addEventListener('change',()=>queueMicrotask(refresh));
  $('settingsPanel').addEventListener('toggle',()=>{if($('settingsPanel').open)show(home);});
  show(home);
}
