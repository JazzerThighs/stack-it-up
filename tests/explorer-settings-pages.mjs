import assert from 'node:assert/strict';
import fs from 'node:fs';
// Minimal HTML tree for navigation tests; layout height is supplied explicitly.
const tree={tag:'document',attrs:{},children:[]},stack=[tree];
for(const token of fs.readFileSync(new URL('../web/explorer/index.html',import.meta.url),'utf8').match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g)) {
 if(token.startsWith('<!'))continue;
 if(token.startsWith('</')) {const tag=token.match(/^<\/([^\s>]+)/)[1];for(let i=stack.length-1;i>0;i--)if(stack[i].tag===tag){stack.length=i;break;}continue;}
 if(token.startsWith('<')) {
  const tag=token.match(/^<([^\s/>]+)/)[1],attrs={};
  for(const [,name,quoted,single,bare] of token.slice(tag.length+1,-1).matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attrs[name]=quoted??single??bare??null;
  const node={tag,attrs,children:[]};stack.at(-1).children.push(node);
  if(!['input','img','br','hr','meta','link','source','wbr'].includes(tag))stack.push(node);
 }else stack.at(-1).children.push(token);
}
class Element {
 constructor(tag,attrs={}){this.tag=tag;this.attrs=attrs;this.childNodes=[];this.dataset={};this.hidden='hidden' in attrs;this.disabled='disabled' in attrs;this.open='open' in attrs;this.listeners={};this.className=attrs.class||'';this.classList={add:(...c)=>c.forEach(x=>this.classes.add(x)),remove:(...c)=>c.forEach(x=>this.classes.delete(x)),contains:c=>this.classes.has(c)};}
 closest(selector){for(let p=this;p;p=p.parentElement)if(p.matches(selector))return p;return null;}
 replaceChildren(...nodes){for(const c of this.children)c.parentElement=null;this.childNodes=[];this.append(...nodes);}
 get className(){return [...this.classes].join(' ');} set className(v){this.classes=new Set(v.split(/\s+/).filter(Boolean));}
 get id(){return this.attrs.id||'';} set id(v){this.attrs.id=v;}
 get htmlFor(){return this.attrs.for;}
 get children(){return this.childNodes.filter(n=>n instanceof Element);}
 get textContent(){return this.childNodes.map(n=>n.textContent).join('');} set textContent(t){this.childNodes=[{textContent:t}];}
 append(...nodes){for(const n of nodes){if(n.parentElement)n.parentElement.childNodes=n.parentElement.childNodes.filter(x=>x!==n);n.parentElement=this;this.childNodes.push(n);}}
 remove(){if(this.parentElement)this.parentElement.childNodes=this.parentElement.childNodes.filter(n=>n!==this);this.parentElement=null;}
 before(node){this.parentElement.insertBefore(node,this);}
 insertBefore(node,ref){if(node.parentElement)node.parentElement.childNodes=node.parentElement.childNodes.filter(x=>x!==node);node.parentElement=this;this.childNodes.splice(this.childNodes.indexOf(ref),0,node);}
 getAttribute(k){return this.attrs[k]??null;}setAttribute(k,v){this.attrs[k]=v;}
 matches(selector){return selector.split(',').some(part=>{part=part.trim();if(part.startsWith('#'))return this.id===part.slice(1);if(part.startsWith('.'))return this.classes.has(part.slice(1));const match=part.match(/^(\w+)?(?:\[([^\]]+)\])?$/);if(!match)return false;const [,tag,attr]=match;return (!tag||this.tag===tag)&&(!attr||(attr==='data-page-unit'?'pageUnit' in this.dataset:attr in this.attrs));});}
 querySelectorAll(selector){
  if(selector.startsWith(':scope > '))return this.children.filter(c=>c.matches(selector.slice(9)));
  const parts=selector.split(' '),last=parts.pop(),out=[];
  const visit=n=>{for(const c of n.children){if(c.matches(last)){let parent=c.parentElement,ok=!parts.length;while(parent&&!ok){if(parent.matches(parts.join(' ')))ok=true;parent=parent.parentElement;}if(ok)out.push(c);}visit(c);}};visit(this);return out;
 }
 querySelector(s){return this.querySelectorAll(s)[0]||null;}
 addEventListener(t,f){(this.listeners[t]??=[]).push(f);}focus(){document.activeElement=this;}
 get clientHeight(){return this.classes.has('settings-page-body')?budget:0;}
 get scrollHeight(){
  const height=n=>{
   if(n.hidden||n.classes.has('pager-source')||n.classes.has('pager-hidden')||n.classes.has('pager-container')&&!n.classes.has('pager-route'))return 0;
   if(n.classes.has('settings-page-unit'))return 48;
   return n.children.reduce((sum,c)=>sum+height(c),0);
  };return height(this);
 }
}
function convert(n){if(typeof n==='string')return {textContent:n};const e=new Element(n.tag,n.attrs);e.append(...n.children.map(convert));return e;}
const doc=convert(tree);doc.createElement=tag=>new Element(tag);doc.getElementById=id=>doc.querySelector('#'+id);
globalThis.document=doc;const frames=[];globalThis.requestAnimationFrame=f=>frames.push(f);globalThis.ResizeObserver=class{observe(){}};

const controls=doc.querySelectorAll('input,select,button').filter(n=>n.id);
const {initializeExplorerSettings}=await import('../web/explorer/settings-pages.js');
initializeExplorerSettings(doc);
for(const control of controls)assert.equal(doc.getElementById(control.id),control,`Retain ${control.id}`);
const pages=doc.querySelectorAll('.explorer-settings-page');
assert.equal(pages.filter(p=>!p.hidden).length,1);
const links=doc.querySelectorAll('.explorer-page-link');
const go=name=>links.find(b=>b.textContent===name+' ›').onclick();
assert(!links.some(b=>b.textContent==='Packing filters >'));
for(const id of ['countFilterPanel','familySelect','status'])assert(doc.getElementById(id).closest('.packing-picker'));
for(const id of ['D','J','S','ExtraV','ExtraCore','Facebound']){assert(!doc.getElementById('countMin'+id).closest('section').hidden);assert.equal(doc.getElementById('countMin'+id).closest('section'),doc.getElementById('countMax'+id).closest('section'));}

doc.getElementById('familyExploreMode').checked=true;
doc.getElementById('familyPieces').value='solids';
doc.getElementById('solidUniform').checked=true;
go('Export 3D model');
for(const id of ['familyExportModel','familyExportSize','familyExportStatus','familyExportLayout','familyExportGap']){
 const page=doc.getElementById(id).closest('.explorer-settings-page');
 assert(page&&!page.hidden,`${id} is accessible in the export settings page`);
}
go('Balls & Platonic Solids');
assert(!doc.getElementById('solidColor').disabled);assert(doc.getElementById('solidGray').disabled);
assert(doc.getElementById('showSolved').disabled);
doc.getElementById('pieceAppearance').value='ascii';go('Appearance');
assert(!doc.getElementById('asciiInline').hidden);
assert(doc.getElementById('ditherInline').hidden);
assert(!links.some(b=>/Categories|Previous|Next/.test(b.textContent)));
console.log('PASS: all explorer controls retained, recursive navigation, single visible page and mode/style dependencies.');

// Embed the same live explorer controls in the application's one settings modal.
const {initializeSharedSettings,settingsScope,attachExplorerSettings}=await import('../web/ui/shared-settings.js');
Element.prototype.after=function(node){this.parentElement.insertBefore(node,this.parentElement.children[this.parentElement.children.indexOf(this)+1]);};
Element.prototype.attachShadow=function(){const shadow=new Element('shadow');shadow.host=this;shadow.getElementById=id=>shadow.querySelector('#'+id);this.shadowRoot=shadow;return shadow;};
Element.prototype.removeAttribute=function(key){delete this.attrs[key];};
Element.prototype.cloneNode=function(){return new Element(this.tag,{...this.attrs});};
Element.prototype.showModal=function(){this.open=true;};Element.prototype.close=function(){this.open=false;};
const dialog=new Element('dialog',{id:'settingsDialog'}),heading=new Element('div',{class:'settings-title'});dialog.append(heading);doc.append(dialog);
let loads=0;
const menu=initializeSharedSettings({loadExplorer:()=>{loads++;}});
menu.host.style={};doc.host=new Element('host');doc.host.style={cssText:'--bg:#123456'};
globalThis.MutationObserver=class{observe(){}};
const scope=settingsScope(doc),model=scope.getElementById('modelShape');
let changed=0;model.addEventListener('change',()=>changed++);
attachExplorerSettings(doc,scope);
assert.equal(doc.getElementById('modelShape'),null,'Controls leave the explorer root');
assert.equal(scope.getElementById('modelShape'),model,'Scoped lookup follows the same control');
assert.equal(menu.portal.getElementById('modelShape'),model);
assert.equal(scope.querySelector('#modelShape'),model);
assert.equal(scope.querySelectorAll('#modelShape').length,1);
model.listeners.change.at(-1)();assert.equal(changed,1,'Existing listener survives relocation');
await menu.open('explorer');assert(dialog.open);assert.equal(dialog.dataset.settingsScope,'explorer');assert(!menu.host.hidden);assert.equal(loads,0,'Existing explorer reused');
model.value='gameboy';await menu.open('game');assert(menu.host.hidden);await menu.open('explorer');assert.equal(model.value,'gameboy');
assert.equal(menu.host.style.cssText,'--bg:#123456');
scope.getElementById('closeSettings').onclick();assert(!dialog.open);
console.log('PASS: one modal retains explorer control identity/listeners, scoped lookups, theme and selections across context switches.');
