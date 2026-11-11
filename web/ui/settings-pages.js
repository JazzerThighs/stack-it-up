// Keep the real controls in their fieldsets: disabled inheritance, IDs and handlers
// survive navigation and the shared rules section moving into the new-game dialog.
let pages;
export function openSettingsPage(id=null, setup=false) {
  if (pages) pages.open(id,setup);
  else if (id) {const section=document.getElementById(id);if(section)section.open=true;}
}
export function refreshSettingsPages() { pages?.refresh(); }
export function initializeSettingsPages() {
  if (!document.querySelectorAll('.settings-section').length) return;
  const roots=[...document.querySelectorAll('.settings-section')];
  const nodes=new Map();let next=0, current=null, setup=false, scheduled=false;
  const containers=new Set();
  const labelOf=element=>{
    const heading=[...element.children].find(c=>c.matches('legend,summary'));
    return heading?.childNodes[0]?.textContent.trim() || element.dataset.pageTitle ||
      document.getElementById(element.getAttribute('aria-describedby'))?.textContent.trim() || 'Options';
  };
  const visible=element=>{for(let p=element;p&&!p.matches('dialog');p=p.parentElement)if(p.hidden||p.id==='legacyGameplay')return false;return true;};
  const disabled=element=>{for(let p=element;p&&!p.matches('dialog');p=p.parentElement)if(p.matches('fieldset')&&p.disabled)return true;return false;};
  function unit(children) {
    const wrapper=document.createElement('div');wrapper.className='settings-page-unit';
    children[0].before(wrapper);wrapper.append(...children);wrapper.dataset.pageUnit='';return wrapper;
  }
  function build(element,parent=null,title=labelOf(element)) {
    const node={id:element.id||`settings-page-${++next}`,element,parent,title,items:[]};nodes.set(node.id,node);
    containers.add(element);element.classList.add('pager-container');if(element.matches('details'))element.open=true;
    function walk(container) {
      containers.add(container);container.classList.add('pager-container');
      const children=[...container.children];
      for(let i=0;i<children.length;i++) {
        const child=children[i];
        if(child.matches('legend,summary')||child.id==='legacyGameplay'||child.matches('input[hidden]'))continue;
        if((child.classList.contains('queue-piece-columns')||child.classList.contains('setting-row')||child.classList.contains('style-selector-box'))) {node.items.push({element:unit([child])});}
        else if(child.matches('fieldset,details')||child.id==='scienceOptions'||child.id==='renderLayers') {
          const titles={scienceOptions:'Choose current / held piece',renderLayers:'Layer order',arrowOptions:'Arrow guides',ringOptions:'Ring labels',rebuildShapeOptions:'Group identities',solidOptions:'Solid appearance',solidColorOptions:'Solid color',solidGrayOptions:'Gray shades',splitGridOptions:'Split-view grids',combinedGridOptions:'Combined-view grid',rearGridOptions:'Rear faces',layerOptions:'Customize layers',transparencyStyle:'Transparency method',ditherTuning:'Dither controls',asciiTuning:'ASCII controls'};
          const sub=build(child,node,titles[child.id]||labelOf(child));
          const button=document.createElement('button');button.type='button';button.className='settings-page-link';button.textContent=sub.title+' ›';
          button.onclick=()=>navigate(sub);child.before(button);const wrapped=unit([button]);
          node.items.push({element:wrapped,sub,button});
        } else if(child.matches('div')&&!child.matches('.face-grid')&&!container.matches('.settings-stats')&&container.id!=='net')walk(child);
        else if(child.id==='net')node.items.push({element:unit([child])});
        else {
          const group=[child];
          if(child.matches('label[for]')&&children[i+1]?.id===child.htmlFor) {
            group.push(children[++i]);
            if(children[i+1]?.matches('button')&&/^apply(Current|Held)$/.test(children[i+1].id))group.push(children[++i]);
          }
          node.items.push({element:unit(group),longText:child.id==='forecastSequence'?child:null});
        }
      }
    }
    if(element.id==='renderLayers')node.dynamic=true;
    else if(element.id==='net')node.items=[...element.children].map(c=>({element:unit([c])}));
    else walk(element);
    return node;
  }
  const categories=roots.map(root=>build(root));
  // New game and live settings share the same nodes and control instances.
  const shells=new Map();
  for(const id of ['settingsDialog','setupDialog']) {
    const dialog=document.getElementById(id);dialog.classList.add('settings-paged');
    const toolbar=document.createElement('div');toolbar.className='settings-page-toolbar';
    const back=document.createElement('button');back.type='button';back.textContent='Back';back.onclick=()=>navigate(current?.parent || (setup?nodes.get('gameplaySettings'):null));
    const title=document.createElement('h3');title.tabIndex=-1;title.id=id+'PageTitle';
    toolbar.append(back,title);
    const body=document.createElement('div');body.className='settings-page-body';body.setAttribute('aria-labelledby',title.id);
    if(id==='settingsDialog') {
      const nav=dialog.querySelector('.settings-nav');nav.classList.add('pager-home');body.append(nav);
      body.append(document.getElementById('gameplayHome'),...roots.filter(r=>r.id!=='gameplaySettings'));
      const note=dialog.querySelector(':scope > p');if(note)note.hidden=true;
      dialog.append(toolbar,body);
    } else {
      body.append(document.getElementById('setupRules'));
      dialog.insertBefore(toolbar,dialog.querySelector('.session-actions'));
      dialog.insertBefore(body,dialog.querySelector('.session-actions'));
    }
    shells.set(id,{dialog,body,back,title});
    dialog.addEventListener('input',schedule);dialog.addEventListener('change',schedule);
    new ResizeObserver(schedule).observe(body);
  }
  function navigate(node) {current=node;render(true);}
  function entries(node) {
    if(node?.dynamic)return [...node.element.children].map(element=>{element.classList.add('settings-page-unit');element.dataset.pageUnit='';return {element};});
    return node?.items.filter(item=>visible(item.sub?.element||item.element) && (item.sub || [...item.element.children].some(visible))).flatMap(item=>{
      if(!item.longText)return [item];
      const text=item.longText.textContent;
      if(item.text!==text) {
        for(const part of item.parts||[])part.element.remove();
        item.text=text;item.parts=[];item.element.classList.add('pager-source');
        const words=text.trim().split(/\s+/).filter(Boolean);
        for(let i=0;i<words.length;i+=24) {
          const part=document.createElement('p');part.textContent=words.slice(i,i+24).join(' ');
          item.element.before(part);item.parts.push({element:unit([part])});
        }
      }
      return item.parts;
    }) || [];
  }
  function render(focus=false) {
    const shell=shells.get(setup?'setupDialog':'settingsDialog');
    if(!shell.dialog.open)return;
    if(current&&!visible(current.element))current=current.parent;
    for(const container of containers)container.classList.remove('pager-route');
    for(const el of document.querySelectorAll('[data-page-unit]'))el.classList.add('pager-hidden');
    const nav=document.querySelector('.pager-home');nav.hidden=!!current||setup;
    const actions=document.querySelector('#settingsDialog .settings-actions');actions.hidden=!!current;
    shell.title.textContent=current?.title||'Settings';shell.back.disabled=!current||setup&&current.id==='gameplaySettings';
    shell.back.hidden=shell.back.disabled;
    if(!current) {shell.body.scrollTop=0;return;}
    let items=entries(current);
    for(const item of items)item.element.classList.add("pager-hidden");
    for(const item of items)if(item.sub)item.button.disabled=disabled(item.sub.element);
    for(let p=current.element;p&&p!==shell.dialog;p=p.parentElement)if(containers.has(p))p.classList.add('pager-route');
    // Each route is one complete page; overflow stays inside this pane.
    for(const item of items) {
      item.element.classList.remove('pager-hidden');
      for(let p=item.element.parentElement;p&&p!==shell.dialog;p=p.parentElement)if(containers.has(p))p.classList.add('pager-route');
    }
    if(focus)shell.body.scrollTop=0;
    if(focus)shell.title.focus({preventScroll:true});
  }
  function schedule() {if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;render();});}
  for(const node of categories)document.getElementById('nav'+node.id).onclick=()=>navigate(node);
  pages={open(id,isSetup){setup=isSetup;current=id?nodes.get(id):null;render(true);schedule();},refresh:schedule};
}
