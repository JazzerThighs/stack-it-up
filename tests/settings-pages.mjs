import assert from 'node:assert/strict';
import fs from 'node:fs';
// Minimal HTML tree for navigation tests; layout height is supplied explicitly.
const tree={tag:'document',attrs:{},children:[]},stack=[tree];
for(const token of fs.readFileSync(new URL('../web/index.html',import.meta.url),'utf8').match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g)) {
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
let budget=144;
const {initializeSettingsPages,openSettingsPage,refreshSettingsPages}=await import('../web/ui/settings-pages.js');
const layerList=doc.getElementById('renderLayers');
for(let i=0;i<17;i++){const row=new Element('li');row.textContent='Layer '+i;layerList.append(row);}
initializeSettingsPages();
const main=doc.getElementById('settingsDialog'),setup=doc.getElementById('setupDialog');main.open=true;
const originalQueue=doc.getElementById('poolPiece10'),originalRules=doc.getElementById('gameplaySettings');
openSettingsPage();assert(!doc.querySelector('.pager-home').hidden);
const visibleUnits=()=>doc.querySelectorAll('[data-page-unit]').filter(e=>{for(let p=e;p;p=p.parentElement)if(p.hidden||p.classes.has('pager-hidden')||p.classes.has('pager-container')&&!p.classes.has('pager-route'))return false;return true;});
openSettingsPage('piecePoolOptions');
assert.equal(doc.querySelectorAll('.settings-page-footer').length,0);
assert(!main.querySelector('.settings-page-toolbar').children.some(e=>e.textContent==='Categories'));
const columns=doc.querySelector('.queue-piece-columns').children;
assert.deepEqual(columns.map(c=>c.querySelectorAll('input').map(e=>e.id)),[
 ['poolPiece1','poolPiece2'],['poolPiece4','poolPiece3','poolPiece5','poolPiece6'],
 ['poolPiece7','poolPiece8','poolPiece9'],['poolPiece10','poolPiece11']]);
assert(!('checked' in doc.getElementById('poolPiece10').attrs));
assert(!('checked' in doc.getElementById('poolPiece11').attrs));
assert.equal(doc.getElementById('poolPiece10'),originalQueue);
// Disabled nested fieldsets retain their real controls and block their page links.
doc.getElementById('gravityDirectionOptions').disabled=true;
openSettingsPage('gameplaySettings');
const gravityLink=doc.querySelectorAll('.settings-page-link').find(b=>b.textContent==='Gravity ›');gravityLink.onclick();
const direction=doc.querySelectorAll('.settings-page-link').find(b=>b.textContent==='Direction ›');assert(direction.disabled);
// The same controls move into the setup dialog, then remain navigable there.
main.open=false;setup.open=true;doc.getElementById('setupRules').append(originalRules);
openSettingsPage('piecePoolOptions',true);assert.equal(doc.getElementById('poolPiece10'),originalQueue);
assert.equal(visibleUnits().flatMap(e=>e.querySelectorAll('input')).length,11);
// Smaller screens retain every control on the same scrollable page.
budget=48;refreshSettingsPages();while(frames.length)frames.shift()();
assert.equal(visibleUnits().flatMap(e=>e.querySelectorAll('input')).length,11);
console.log('PASS: recursive routes, four queue columns, no category shortcut or paging footer, fieldset dependencies and shared setup controls.');
setup.open=false;main.open=true;doc.getElementById('gameplayHome').append(originalRules);
openSettingsPage('renderLayers');assert.equal(visibleUnits().length,17);
doc.getElementById('forecastWitness').hidden=false;
doc.getElementById('forecastSequence').textContent=Array.from({length:200},(_,i)=>'Move'+i).join(' ');
openSettingsPage('forecastWitness');
const sequence=visibleUnits().filter(e=>!e.classes.has('pager-source')).flatMap(e=>e.textContent.split(' '));
assert.equal(sequence.length,200);assert.equal(sequence.at(-1),'Move199');
console.log('PASS: complete layers and forecast sequences remain on a single scrollable route.');
