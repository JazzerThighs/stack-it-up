// Explorer settings keep their original controls/listeners; only their layout moves.
export function initializeExplorerSettings(root) {
  const content=root.querySelector?.('.settings-content');
  if(!content || content.dataset.paged)return;
  content.dataset.paged='true';
  const $=id=>root.getElementById(id),find=s=>content.querySelector(s);
  const heading=find('.settings-heading'),status=find('.status-row');
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
  const filters=page('Packing filters',home);
  add(filters,$('datasetSelect').closest('label'),$('familyBag').closest('label'));
  const puzzles=page('Puzzle shapes',filters);
  add(puzzles,$('iTunnelOnly').closest('label'));
  unpack(puzzles,$('puzzleShapeFilters'));
  const placement=page('Placement & extras',filters);
  add(placement,find('.filter-flags'),find('.extra-filters'));
  const composition=page('Piece composition',filters);
  add(composition,$('spatialComposition').closest('label'),$('planarSpanning').closest('label'),$('corePieceType').closest('label'));
  help(composition,'Classic collection allows planar pieces only.');
  const counts=page('Piece counts',composition);
  for(const [id,label]of [['O','O'],['T','T'],['JL','J / L'],['SZ','S / Z'],['B','Branch'],['D','Right screw'],['F','Left screw']]) {
    const sub=page(label,counts);add(sub,$('countMin'+id).closest('label'),$('countMax'+id).closest('label'));
  }
  help(counts,'Counts range from 0 to 6. J/L and S/Z each share a count.');
  add(filters,$('familySummary'));
  // Keep the legacy container reachable for collection setup code, now empty.
  const spatial=$('spatialFilters');spatial.replaceChildren();spatial.hidden=true;add(filters,spatial);
  const controls=page('Controls',home);
  help(controls,'Shared with the game. Changes apply to both apps.');
  const input=page('Input',controls);unpack(input,$('explorerInputSettings'));
  const hover=page('Hover feedback',controls);unpack(hover,$('explorerHoverSettings'));
  const camera=page('Camera',controls);add(camera,$('explorerCamera').closest('label'),$('freeOrbit').closest('label'));
  const views=page('Views',home);
  unpack(views,find('.window-controls'));
  add(views,$('targetComposite').closest('label'));
  help(views,'Visible-cube switches apply to standard browsing. Family and practice modes use their own views.');
  const appearance=page('Appearance',home);add(appearance,$('modelShape').closest('label'),$('pieceAppearance').closest('label'));
  const colors=page('Colors',appearance);unpack(colors,find('.color-controls'));
  help(colors,'Official colors apply to family 562; other families use canonical colors. Multicolor distinguishes piece IDs.');
  const palette=page('Tetromino palette',colors);unpack(palette,find('.piece-colors'));
  const solids=page('Piece identity shapes',appearance);
  const solidField=$('familySolidIdentities').closest('fieldset');unpack(solids,solidField);
  const tuning={};
  for(const [name,id]of [['Transparency','ditherTransparency'],['Lighting','lightAzimuth'],['Dither tuning','ditherLevels'],['ASCII tuning','asciiSize']]) {
    const sub=page(name,appearance);unpack(sub,$(id).closest('details'));tuning[id]=sub;
  }
  const lightClasses=page('Lighting by element',tuning.lightAzimuth);
  const classes=body.querySelector('#lightingClasses');
  unpack(lightClasses,classes);classes.remove();
  const info=page('Collection status',home);add(info,status);
  let current=home;
  function refresh() {
    const family=$('familyExploreMode').checked,practice=$('practiceMode').checked;
    for(const id of ['showSolved','showScrambled'])$(id).disabled=family||practice;
    $('targetComposite').disabled=family;
    const solidsOn=family&&$('familySolidIdentities').checked;
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
