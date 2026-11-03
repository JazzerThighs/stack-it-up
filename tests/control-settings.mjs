import assert from 'node:assert/strict';
const saved=new Map();globalThis.localStorage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
const {controlSettings,bindControlSettings,setControlSetting}=await import('../web/input/control-settings.js');
const root=explorer=>{
 const elements=Object.fromEntries(Object.keys(controlSettings).filter(k=>explorer||k!=='wideTurns').map(k=>[explorer&&k==='perspectiveCamera'?'explorerCamera':k,{checked:false,value:'',addEventListener(t,f){this.change=f;}}]));
 return {elements,getElementById:k=>elements[k]};
};
const game=root(false),explorer=root(true);let updates=0;
const offGame=bindControlSettings(game,()=>updates++),offExplorer=bindControlSettings(explorer,()=>updates++,{explorer:true});
assert(game.elements.hoverRings.checked);assert(explorer.elements.hoverRings.checked);
explorer.elements.hoverRings.checked=false;explorer.elements.hoverRings.change();
assert(!game.elements.hoverRings.checked);assert(game.elements.ringLabels.disabled);
game.elements.showArrows.checked=true;game.elements.showArrows.change();
assert(explorer.elements.showArrows.checked);assert(!explorer.elements.arrowGuides.disabled);
explorer.elements.explorerCamera.value='orthographic';explorer.elements.explorerCamera.change();assert(!game.elements.perspectiveCamera.checked);
setControlSetting('wideTurns',true);assert(explorer.elements.wideTurns.checked);
assert(JSON.parse(saved.get('stack-it-up.controls')).wideTurns);
offGame();offExplorer();const before=updates;setControlSetting('wideTurns',false);assert.equal(before,updates);
console.log('PASS: bidirectional control settings, camera mapping, dependencies, persistence and unsubscribe.');
