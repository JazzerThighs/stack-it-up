// Shared navigation chrome. Controls stay in their original owners and fieldsets.
export function createSettingsBrowser({nodes, label, parent, select, search, scope}) {
  const toolbar=document.createElement('div');toolbar.className='settings-search';
  const input=document.createElement('input');input.type='search';input.placeholder=`Search ${scope} settings`;
  input.setAttribute('aria-label',input.placeholder);
  const status=document.createElement('span');status.setAttribute('role','status');
  toolbar.append(input,status);
  const nav=document.createElement('nav');nav.className='settings-sidebar';nav.setAttribute('aria-label','Settings categories');
  const path=node=>{const parts=[];for(let p=node;p;p=parent(p))parts.unshift(label(p));return parts.join(' / ');};
  const buttons=new Map();
  for(const node of nodes) {
    const button=document.createElement('button');button.type='button';button.textContent=label(node);
    button.title=path(node);button.dataset.nested=String(!!parent(node));
    button.onclick=()=>{input.value='';search('');select(node);};nav.append(button);buttons.set(node,button);
  }
  input.addEventListener('input',()=>search(input.value.trim().toLowerCase()));
  input.addEventListener('keydown',event=>{if(event.key==='Escape'&&input.value){event.preventDefault();event.stopPropagation();input.value='';search('');}});
  return {toolbar,nav,input,path,update(current,count=null,available=()=>true){
    status.textContent=count===null?'':count?`${count} matching groups`:'No matching settings';
    for(const [node,button]of buttons){button.hidden=!available(node);button.setAttribute('aria-current',String(node===current));}
  }};
}

export function matchesSettings(element, path, query) {
  const controls=[...element.querySelectorAll('input,select,textarea')];
  const text=[path,element.textContent,...controls.map(c=>`${c.id} ${c.getAttribute('aria-label')||''} ${c.title||''}`)].join(' ').toLowerCase();
  return query.split(/\s+/).every(word=>text.includes(word));
}
