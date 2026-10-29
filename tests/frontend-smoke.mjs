import fs from 'node:fs';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const enums=new Map(),frames=[],elements=new Map();let buffer;
const gl=new Proxy({createVertexArray:()=>({}),createBuffer:()=>({}),createProgram:()=>({}),createShader:()=>({}),getShaderParameter:()=>true,checkFramebufferStatus:()=>gl.FRAMEBUFFER_COMPLETE,getProgramParameter:()=>true,getAttribLocation:()=>0,getUniformLocation:(_,name)=>name,bindBuffer:(_,b)=>buffer=b,bufferData:(_,data)=>{buffer.data=data;}},{get:(o,k)=>k in o?o[k]:k===k.toUpperCase()?(enums.has(k)?enums.get(k):(enums.set(k,enums.size+1),enums.get(k))):()=>{}});
function element(){return {checked:false,value:'0',style:{},dataset:{},children:[],hidden:false,disabled:false,textContent:'',classList:{toggle(){},add(){},remove(){}},append(...x){this.children.push(...x)},replaceChildren(...x){this.children=x},setAttribute(){},addEventListener(t,f){(this.listeners??={})[t]=f},querySelector(){return this.child??=element()},querySelectorAll(){return []},select(){},closest(){return this.parent??=element()},getContext(type){return type==='webgl2'?gl:new Proxy({},{get:()=>()=>{}})},getBoundingClientRect(){return {left:0,top:0,width:1200,height:800}},setPointerCapture(){},focus(){},showModal(){this.open=true},close(){this.open=false}};}
for(const tag of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)){const e=element();e.checked=/\bchecked\b/.test(tag[0]);e.hidden=/\bhidden\b/.test(tag[0]);e.value=tag[0].match(/\bvalue="([^"]*)"/)?.[1]||'0';elements.set(tag[1],e);}
const $=id=>{assert(elements.has(id),`missing ${id}`);return elements.get(id);};
Object.assign(globalThis,{document:{hidden:false,getElementById:$,createElement:element,querySelector:element,querySelectorAll:()=>[],addEventListener(){}},devicePixelRatio:1,matchMedia:()=>({matches:true}),ResizeObserver:class{observe(){}},requestAnimationFrame:fn=>(frames.push(fn),frames.length),fetch:async url=>({ok:true,arrayBuffer:async()=>fs.readFileSync(url)})});
$('sliceClearMode').value='1';$('rebuildMode').value='2';
$('pieceAppearance').value='jelly';
$('explorer').explorerReady=Promise.resolve();
const {context}=await import('../dist/app.js');
for(let i=0;i<100&&!context.engine;i++)await new Promise(resolve=>setTimeout(resolve,10));
assert.equal($('engineStatus').textContent,'Ready');
const flush=()=>{let n=0;while(frames.length&&n++<100)frames.shift()(800);};flush();
assert($('gamePage').hidden);assert(!$('explorerPage').hidden);assert(!$('setupDialog').open);
$('gameTab').onclick();
assert($('setupDialog').open);
const awaiting=Array.from(context.engine.exportState());await context.play(0);assert.deepEqual(context.engine.exportState(),awaiting);
await $('setupStart').onclick();flush();assert(!$('setupDialog').open);
assert.equal(context.engine.snapshot().length,226);assert(!$('ringLabels').checked);assert($('rearGridOnly').checked);
const before=context.state[55];await $('holdPiece').onclick();flush();assert.equal(context.state[164],before);assert.equal(context.state[165],1);
$('activeSpheres').checked=true;$('activeSpheres').listeners.input();flush();assert(context.renderers[0].activeSpheres);
$('hoverOutline').checked=true;$('hoverOutline').listeners.input();const canvas=$('control');canvas.listeners.pointermove({pointerId:1,pointerType:'mouse',clientX:600,clientY:400});flush();assert(context.renderers[0].hover);
const previous=context.state[54];await context.play(6);flush();assert(context.engine.snapshot()[68]>0);$('stageUndo').onclick();flush();assert.equal(context.state[54],previous);
$('customLayers').checked=true;$('customLayers').onchange();flush();assert($('renderLayers').children.length>=17);$('resetLayers').onclick();flush();assert(!$('customLayers').checked);
console.log('PASS: actual ES modules + real Wasm startup, hold, undo, sphere/hover rendering, custom layers and defaults (mock WebGL).');

const savedState=Array.from(context.state);
$('explorer').explorerReady=Promise.resolve();$('explorerTab').onclick();assert($('gamePage').hidden);assert(!$('explorerPage').hidden);assert(!html.includes('<iframe'));assert($('explorer').explorerReady);
$('gameTab').onclick();assert(!$('gamePage').hidden);assert($('explorerPage').hidden);assert.deepEqual(Array.from(context.state),savedState);
console.log('PASS: packing tab lazy load and game state preservation.');
assert(!$('queueForecast').checked);assert(!$('sliceGravity').checked);assert($('gravityOneStep').checked);assert.equal(context.engine.game_gravity_rules(),2);assert($('bandagedFragments').checked);assert($('earlyLock').checked);assert(!$('randomCubies').checked);assert.equal($('rebuildMode').value,'2');assert(!$('fragmentPerk').checked);assert(!$('fragmentOptions').open);assert(context.renderers[0].perspective);
$('fragmentPerk').checked=true;$('fragmentPerk').onchange();assert($('fragmentOptions').open);
$('bandagedFragments').checked=true;$('bandagedFragments').onchange();
$('randomCubies').checked=true;$('randomCubies').onchange();
$('rebuildMode').value='2';$('rebuildMode').onchange();flush();
assert.deepEqual(Array.from(context.state.slice(166,169)),[1,1,2]);
const visual=context.state.slice();visual[159]=3|(1<<8);visual[169]=1<<8;visual[180]=1;visual[199]=visual[200]=1;
context.renderers[0].setState(visual);context.renderers[0].draw();
assert(context.renderers[0].solid.data.every(Number.isFinite));assert(context.renderers[0].bandMesh.count>0);
context.renderers[0].setState(context.state);flush();
console.log('PASS: independent reward settings reach real Wasm; band and reconstruction geometry remains finite.');

$("turnWidth").onclick();flush();assert(context.renderers[0].wideTurns);$("turnWidth").onclick();flush();assert(!context.renderers[0].wideTurns);

assert($('lockBands').hidden);$('lockBands').onclick();assert(!context.lockMode);
const saved=context.engine.exportState(), header=saved.slice(0,22);header[4]=2;header[12]=1;header[13]=1;header[19]=0;
const bandState=[...header,...Array(54).fill(0),2,1,2,2,0,1,1,1,1,1,0,1,3,0,1,0];
assert(context.engine.importState(bandState));context.update();assert(!$('lockBands').hidden);
$('lockBands').onclick();assert(context.lockMode);assert.equal($('lockBands').textContent,'Resume turns');
$('earlyLock').checked=false;$('earlyLock').onchange();assert(!context.lockMode);assert($('lockBands').disabled);
$('earlyLock').checked=true;$('earlyLock').onchange();assert(!$('lockBands').disabled);

assert.equal(context.engine.game_slice_clear_mode(),1);$('sliceClearMode').value='2';$('sliceClearMode').onchange();assert.equal(context.engine.game_slice_clear_mode(),2);$('sliceClearMode').value='1';$('rebuildMode').value='2';
$('pieceAppearance').value='jelly';
$('explorer').explorerReady=Promise.resolve();$('sliceClearMode').onchange();

// Session controls use the real Wasm transport and queue mutation.
$('chooseNext').checked=true;$('chooseNext').onchange();assert(!$('nextPieceControls').hidden);
$('nextPiece').value='6';$('setNextPiece').onclick();assert.equal(context.engine.snapshot()[56],6);
$('shareState').onclick();assert($('stateDialog').open);const shared=$('stateText').value;
const exported=context.engine.exportState();$('stateText').value='{"bad":true}';$('loadState').onclick();assert.deepEqual(context.engine.exportState(),exported);assert($('stateDialog').open);
$('stateText').value=shared;$('loadState').onclick();assert(!$('stateDialog').open);assert.deepEqual(context.engine.exportState(),exported);
$('new').onclick();assert($('setupDialog').open);const beforeSetup=context.engine.exportState();
$('gravityMode').value='1';$('gravityMode').onchange();assert.deepEqual(context.engine.exportState(),beforeSetup);
await $('setupStart').onclick();flush();assert.equal(context.engine.snapshot()[158],1);
// Lightweight feedback uses 144 vertices per marker, not three sphere meshes.
const renderer=context.renderers[0], previews=context.engine.placement_previews;
context.engine.placement_previews=()=>[{sourceMask:1,mask:1,piece:1}];renderer.arrowHover=0;renderer.hintKey=null;renderer.draw();
assert.equal(renderer.decorBuffers['hints:0'].count,144);context.engine.placement_previews=previews;
const ended=context.engine.exportState();ended[18]=1;assert(context.engine.importState(ended));context.update();assert(!$('gameOver').hidden);assert(renderer.orbitOnly);
console.log('PASS: setup confirmation, conditional band locking, state sharing/load validation, next-piece selection, top-out inspection, and lightweight markers.');

// Display controls may change rendering, never the exported puzzle state.
const visualState=Array.from(context.engine.exportState());
$('animations').checked=true;
for(const style of ['jelly','dither','matte','voxel','cel','ascii','jelly']) {
  $('pieceAppearance').value=style;
  $('pieceAppearance').listeners.input();flush();
  for(const r of context.renderers) {
    assert.equal(r.appearance,style);assert(r.breathing);
    if(r.canvas.dataset.appearance) assert.equal(r.canvas.dataset.appearance,style);
    assert(r.stackMesh.data.every(Number.isFinite));
  }
  assert.deepEqual(Array.from(context.engine.exportState()),visualState);
}
$('pieceColorT').value='#123456';$('pieceColorT').listeners.input();flush();
const palette=await import('../dist/render/palette.js');
assert.equal(palette.colors[2],'#123456');assert.equal(palette.packingPalette.m,'#123456');
assert.deepEqual(Array.from(context.engine.exportState()),visualState);
// A white current piece remains in the active buffer, not the fragment buffer.
const colorState=context.state.slice();colorState[54]=1;colorState[55]=2;
colorState[159]=0;colorState[169]=0;colorState.fill(0,172,226);
$('pieceColorT').value='#ffffff';$('pieceColorT').listeners.input();
context.renderers[0].setState(colorState);
assert(context.renderers[0].activeOnly.count>0);assert.equal(context.renderers[0].floatingMesh.count,0);
$('resetPieceColors').onclick();flush();
assert.deepEqual(palette.colors,palette.defaultColors);
console.log('PASS: explorer-first startup, six styles, breathing, shared palettes, white-piece identity and unchanged puzzle state.');

const settingsState=Array.from(context.engine.exportState());
const retainedMesh=context.renderers[0].stackMesh.data;
$('lightAzimuth').value='0';$('lightAzimuth').listeners.input();
$('lightElevation').value='0';$('lightElevation').listeners.input();
$('ditherLevels').value='3';$('ditherLevels').listeners.input();flush();
const visualPrefs=await import('../dist/render/visual-settings.js');
assert.equal(visualPrefs.visualSettings.ditherLevels,3);assert.deepEqual(visualPrefs.lightDirection(),[0,0,1]);
assert.equal(context.renderers[0].stackMesh.data,retainedMesh);
assert.deepEqual(Array.from(context.engine.exportState()),settingsState);
$('resetdither').onclick();$('resetlight').onclick();
console.log('PASS: game lighting/filter sliders update live without rebuilding meshes or altering puzzle state.');
