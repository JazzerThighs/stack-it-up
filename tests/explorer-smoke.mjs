import fs from "node:fs";
import assert from "node:assert/strict";
import {createBrowserFixture} from "./fixtures/browser.mjs";
const buildInfo=JSON.parse(fs.readFileSync(new URL('../dist/build-info.json',import.meta.url),'utf8'));
const assetRoot=new URL(`../dist/${buildInfo.assets}/`,import.meta.url);
const html = fs.readFileSync(
  new URL("explorer/index.html", assetRoot),
  "utf8",
);
const browser=createBrowserFixture(html,{
  defaultValue:'',
  uniformLocation:()=>({}),
  globals:{window:{},cancelAnimationFrame:()=>{}},
  fetch:async url=>({
    ok:true,arrayBuffer:async()=>fs.readFileSync(url),
    text:async()=>fs.readFileSync(new URL(url,new URL('explorer/',assetRoot)),'utf8'),
  }),
});
const {$,elements,element,gl,frames,flush}=browser;
browser.install();

$("targetTransparency").value = "0";
for (const id of ["extraEdges", "extraCorners", "extraCenters"])
  $(id).value = "any";
const {PackingCube}=await import(new URL("explorer/cube-view.js",assetRoot));
const observed=new Map(), originalSetState=PackingCube.prototype.setState;
PackingCube.prototype.setState=function(cells,animation){observed.set(this.host,{view:this,animation});return originalSetState.call(this,cells,animation);};
const getExplorerElement = document.getElementById;
// The application document has no explorer IDs when mounted in a shadow root.
const applicationPage = {hidden:false};
document.getElementById = id => id === "explorerPage" ? applicationPage : id === "cubeLayout" ? null : getExplorerElement(id);
const { ready, initializeExplorer } = await import(new URL("explorer/script.js",assetRoot));
assert.equal(ready,null);
const {client,store,official,manifest}=await import('./packing-fixture.mjs');
const settle=async predicate=>{for(let n=0;n<200&&!predicate();n++)await new Promise(r=>setTimeout(r,10));assert(predicate());};
const initial=await initializeExplorer({getElementById:getExplorerElement},{client});
await settle(()=>$('familyExploreProgress').textContent.includes('Packing found'));
assert.match($('status').textContent,/matching packings/);
if(process.env.HOVER_ONLY){
  const view=observed.get($('familyExploreCube')).view,cells=view.cells,history=view.history,original=view.solid.data;
  assert(!$('hoverIdentities').checked);$('hoverIdentities').checked=true;$('hoverIdentities').listeners.change();
  const i=cells.findIndex(c=>c?.piece>=0),p=[Math.floor(i/9)-1,Math.floor(i/3)%3-1,i%3-1];
  view.identityHover={p};view.draw();assert(view.hoverIdentityBuffer.count>0);
  assert.equal(view.solid.data,original);assert.equal(view.cells,cells);assert.equal(view.history,history);
  view.identityHover=null;view.draw();$('hoverIdentities').checked=false;$('hoverIdentities').listeners.change();
  assert.equal(view.solid.data,original);
  console.log('PASS: optional hover identities render through the explorer pipeline and preserve packing geometry/history.');
  process.exit(0);
}
if(process.env.FAMILY_LOCK_ONLY){
  assert($('canonicalColors').checked);assert(!html.includes('id="officialColors"'));assert(!html.includes('id="officialMulticolor"'));
  const cube=observed.get($('familyExploreCube')).view;
  const starter=cube.cells.map(c=>c.piece),original=cube.solid.data.slice();
  assert(!$('familyLockShapes').disabled);await $('familyLockShapes').onclick();
  assert.equal(cube.assembly,'retained');assert.equal($('familySelect').value,'562');assert($('familySelect').disabled);
  const captured=cube.retainedSource;await cube.play(0);assert.equal(cube.retainedSource,captured);
  $('familyPieces').value='cubies';$('familyPieces').listeners.change();assert.equal(cube.assembly,'retained');
  await $('resetPackingFilters').onclick();assert($('familySelect').disabled);
  const target=await client.query({filters:{family:562},line:50152,offset:1});
  await initial.query({line:target.record.lineNumber});
  assert.equal(initial.current.lineNumber,target.record.lineNumber);assert.equal(cube.history.length,0);assert(cube.undoButton.disabled);
  const generated=cube.cells;cube.undo();assert.equal(cube.cells,generated);
  await cube.play(0);const cachedTurn=cube.cells;cube.undo();await cube.play(0);assert.equal(cube.cells,cachedTurn,'repeated turn uses cached state');cube.undo();
  cube.reset();assert.equal(cube.cells,generated,'reset returns to generated destination');
  const oldLookup=client.lookup;let lookups=0;client.lookup=(...args)=>{lookups++;return oldLookup(...args);};
  await cube.play(0);cube.undo();await settle(()=>$('familyExploreProgress').textContent.includes('Packing found'));
  assert.equal(lookups,0,'revisiting a known packing reuses its lookup');client.lookup=oldLookup;
  $('canonicalColors').onchange();
  assert(cube.turnCache.get(cube.cells).has(0),'color refresh retains cached turn branches');
  const recoloredCached=cube.turnCache.get(cube.cells).get(0);await cube.play(0);assert.equal(cube.cells,recoloredCached);cube.undo();
  const cache=cube.turnCache,manualHistory=cube.history;
  await $('resetPackingFilters').onclick();assert.equal(cube.turnCache,cache);assert.equal(cube.history,manualHistory);

  assert($('familyPackingLedger').children.length>=2);
  assert.deepEqual(cube.initial.map(c=>c.piece),starter);
  const {practicePair}=await import(new URL('explorer/model.js',assetRoot));
  const {packingPresentation}=await import(new URL('explorer/presentation.js',assetRoot));
  const pair=practicePair(packingPresentation(official).packing,packingPresentation(target.record).packing,{targetColors:true});
  assert.deepEqual(cube.cells.map(c=>c.piece),pair.right.map(c=>c.piece));
  assert.deepEqual(cube.cells.filter(c=>c.piece>=0).map(c=>c.color),pair.right.filter(c=>c.piece>=0).map(c=>c.color));
  const geometry=cube.solid.data.filter((_,i)=>i%9<6),history=cube.history;
  $('canonicalColors').onchange();
  const canonical=practicePair(packingPresentation(official).packing,packingPresentation(target.record).packing,{targetColors:true});
  assert.deepEqual(cube.cells.filter(c=>c.piece>=0).map(c=>c.color),canonical.right.filter(c=>c.piece>=0).map(c=>c.color));
  assert.deepEqual(cube.solid.data.filter((_,i)=>i%9<6),geometry);assert.equal(cube.history,history);
  $('positionalColors').onchange();
  await initial.query({line:50152});assert.deepEqual(cube.cells.map(c=>c.piece),starter);assert.equal(cube.history.length,0);
  const other=await client.query({filters:{counts:[{type:'O',min:6,max:6}]}});
  await initial.query({line:other.record.lineNumber});assert.match($('status').textContent,/Unlock/);assert.equal(initial.current.lineNumber,50152);
  await $('familyLockShapes').onclick();assert.equal(cube.assembly,'cubies');assert(!$('familySelect').disabled);
  console.log('PASS: lock matched packing, pin family across filter resets, replay verified path from starter, update colors, reject other families, unlock and restore assembly.');
  await settle(()=>$('familyExploreProgress').textContent.includes('Packing found'));
  $('canonicalColors').onchange();
  await $('familyLockColors').onclick();assert.equal(cube.assembly,'whole');assert(cube.fixedPieceColors);
  const lockedColors=new Map(cube.cells.filter(c=>c.piece>=0).map(c=>[c.piece,c.color]));
  assert(!$('familyLockShapes').disabled);assert($('familySelect').disabled);
  await initial.query({line:target.record.lineNumber});assert.equal(cube.assembly,'whole');
  for(const cell of cube.cells)if(cell.piece>=0)assert.equal(cell.color,lockedColors.get(cell.piece));
  const {explorationMeshes}=await import(new URL('explorer/exploration-mesh.js',assetRoot));
  const {joinMeshes}=await import(new URL('render/cell-fragments.js',assetRoot));
  const expected=joinMeshes(explorationMeshes(cube.cells,cube.meshGenerator,cube.modelShape,false,cube.explorationGray,true,false,cube.detectionFilters,false,'whole'));
  assert.deepEqual(cube.solid.data,expected,'geometry follows current detected tetracubes');
  const live=cube.cells,liveHistory=cube.history;
  $('positionalColors').onchange();assert.equal(cube.cells,live);assert.equal(cube.history,liveHistory);
  for(const cell of cube.cells)if(cell.piece>=0)assert.equal(cell.color,lockedColors.get(cell.piece));
  await cube.play(0);for(const cell of cube.cells)if(cell.piece>=0)assert.equal(cell.color,lockedColors.get(cell.piece));
  cube.undo();assert.deepEqual(cube.solid.data,expected);
  await initial.query({line:50152});assert.deepEqual(cube.cells.map(c=>c.piece),starter);
  await $('familyLockColors').onclick();assert.equal(cube.assembly,'cubies');assert(!$('familySelect').disabled);
  console.log('PASS: original colors persist across family navigation, manual turns, undo and color-mode changes while detected shapes rebuild; unlock restores preferences.');
  await settle(()=>$('familyExploreProgress').textContent.includes('Packing found'));
  for(const first of ['Shapes','Colors']){
    const second=first==='Shapes'?'Colors':'Shapes';
    await $('familyLock'+first).onclick();assert(!$('familyLock'+second).disabled);
    await $('familyLock'+second).onclick();
    assert.equal($('familyLockShapes').textContent,'Unlock shapes');assert.equal($('familyLockColors').textContent,'Unlock colors');
    assert.equal(cube.assembly,'retained');assert($('familySelect').disabled);
    const colors=new Map(cube.cells.filter(c=>c.piece>=0).map(c=>[c.piece,c.color]));
    const shape=cube.retainedSource;await cube.play(0);assert.equal(cube.retainedSource,shape);cube.undo();
    await initial.query({line:target.record.lineNumber});assert.equal(cube.assembly,'retained');
    for(const cell of cube.cells)if(cell.piece>=0)assert.equal(cell.color,colors.get(cell.piece));
    await $('familyLock'+first).onclick();assert($('familySelect').disabled);
    assert.equal(cube.assembly,first==='Shapes'?'whole':'retained');
    assert.equal($('familyLock'+second).textContent,'Unlock '+second.toLowerCase());
    await $('familyLock'+second).onclick();assert(!$('familySelect').disabled);assert.equal(cube.assembly,'cubies');
    await initial.query({line:50152});await settle(()=>$('familyExploreProgress').textContent.includes('Packing found'));
  }
  console.log('PASS: both lock orders preserve shapes and colors across turns/navigation; each unlock preserves the other and only the last releases the family.');process.exit(0);
}
if(process.env.RETAINED_ONLY){
  $('practiceMode').checked=true;await $('practiceMode').onchange();
  $('practiceStartPieces').value='retained';$('practiceStartPieces').listeners.change();
  const start=observed.get($('practiceLeft')).view,target=observed.get($('practiceRight')).view;
  const original=start.solid.data.slice(),source=start.retainedSource,targetCells=target.cells;
  assert(source);assert.equal(start.assembly,'retained');
  await start.play(0);assert.equal(start.retainedSource,source);assert.notDeepEqual(start.solid.data,original);
  const moved=start.solid.data.slice(),cells=start.cells,history=start.history;
  start.setState(cells,{kind:'turn',move:1,t:.5});assert.equal(start.retainedSource,source);start.setState(cells);
  $('practiceStartPieces').value='cubies';$('practiceStartPieces').listeners.change();
  $('practiceStartPieces').value='retained';$('practiceStartPieces').listeners.change();
  assert.equal(start.cells,cells);assert.equal(start.history,history);assert.deepEqual(start.solid.data,moved);
  start.undo();assert.deepEqual(start.solid.data,original);
  await start.play(7);start.reset();assert.deepEqual(start.solid.data,original);assert.equal(target.cells,targetCells);
  console.log('PASS: retained Start geometry survives turns, partial drags, assembly switches, undo and reset without changing Target.');
  process.exit(0);
}
if(process.env.INSPECTION_ONLY){
  assert($('familyInspectFilters').checked);
  const inspected=observed.get($('familyExploreCube')).view,cells=inspected.cells,history=inspected.history,line=initial.current.lineNumber;
  const {detectPieces:detect}=await import(new URL('explorer/family-exploration.js',assetRoot));
  $('familyPieces').value='wholeSolids';$('familyPieces').listeners.change();
  $('countMinO').value='0';$('countMaxO').value='0';await $('countMaxO').listeners.change();
  assert.equal(initial.current.lineNumber,line);assert.equal(inspected.cells,cells);assert.equal(inspected.history,history);
  assert(!detect(cells,inspected.detectionFilters).some(p=>p.letter==='O'));
  assert(inspected.explorationGeometry.some(m=>m.identityCell!==undefined));
  await $('resetPackingFilters').onclick();assert.equal(inspected.cells,cells);assert(detect(cells,inspected.detectionFilters).some(p=>p.letter==='O'));
  const next=await client.query({filters:{family:562},line,offset:1});
  await initial.query({line:next.record.lineNumber},true);assert.equal(initial.current.lineNumber,next.record.lineNumber);assert.notEqual(inspected.cells,cells);
  const duplicate=await client.query({filters:{counts:[{type:'O',min:6,max:6}]}});
  await initial.query({line:duplicate.record.lineNumber});
  $('positionalColors').checked=true;$('positionalColors').onchange();
  assert(inspected.fixedPieceColors);assert.equal(new Set(inspected.cells.filter(c=>c.piece>=0).map(c=>c.color)).size,6);
  console.log('PASS: default live inspection, excluded/re-enabled O geometry, explicit source navigation, and distinct fallback colors.');
  process.exit(0);
}
assert($('familyInspectFilters').checked);
$('familyInspectFilters').checked=false;$('familyInspectFilters').onchange();
assert.equal(initial.current.lineNumber,50152);assert.equal(initial.current.familyId,562);
assert.deepEqual(initial.current.masks,[0xf,0xf0,0x40e00,0x780000,0x3018000,0x4024100]);
assert.equal($('sourceLine').value,50152);
assert(!$('packingNavigation').hidden);
assert(!html.includes('ungroupedOnly'));
assert($("familyExploreMode").checked && !$("familyExplorePanel").hidden);
assert($("cubeLayout").hidden && $("practicePanel").hidden);
assert(observed.has($("familyExploreCube")),"family cube is initialized on startup");
flush();
assert.match($('solvedFacelets').textContent,/Native tetracube/);
assert($("solvedCube").children.length >= 2);
assert($("scrambledCube").children.length >= 2);
// Switching only the color scheme must not rotate, reflect, or recolor the
// official source packing, including its white edge and black center.
$('canonicalColors').onchange();
assert(observed.get($('solvedCube')).view.cells.some(c=>c.color==='r'));
$('positionalColors').onchange();
assert(!html.includes('id="piece3d"')); assert.equal($("cubeLayout").dataset.views,2);
$("practiceMode").checked = true;
await $("practiceMode").onchange();
flush();
assert(!$("practicePanel").hidden);
assert($("cubeLayout").hidden);
assert.match($("practiceStatus").textContent, /Compatible pair/);
await $('practiceRandom').onclick();
assert.notEqual($('practiceA').value,$('practiceB').value);
await $('practiceDemonstrate').onclick();assert.equal($('practiceProgress').textContent,'Target matched!');assert.match($('practiceStatus').textContent,/Verified path/);
$("practiceA").value = String(official.lineNumber);
$("practiceB").value = String(official.lineNumber);
await $("practiceLoad").onsubmit({ preventDefault() {} });
flush();
assert.equal($("practiceProgress").textContent, "Target matched!");
const practiceTarget=observed.get($('practiceRight')).view.cells.slice();
await $('practiceScramble').onclick();assert.deepEqual(observed.get($('practiceRight')).view.cells,practiceTarget);
await $('practiceDemonstrate').onclick();assert.equal($('practiceProgress').textContent,'Target matched!');
console.log('PASS: arbitrary compatible pair demonstration, target-preserving scramble, and verified return path.');

const { practicePair, turn } = await import(new URL("explorer/model.js",assetRoot));
const host = element(),
  cube = new PackingCube(host);
const cells = Array.from({ length: 27 }, (_, i) => ({
  color: "bymogr"[i % 6],
  piece: i % 6,
}));
cube.setCells(cells);
flush();
await cube.play(5);
flush();
assert.deepEqual(cube.cells, turn(cells, 5));
cube.undo();
assert.deepEqual(cube.cells, cells);
await cube.play(0);
cube.reset();
assert.deepEqual(cube.cells, cells);

const { sliceCandidates } = await import(new URL("input/drag.js",assetRoot));
const p = cube.project([0, 0, -1.5]),
  c = sliceCandidates(cube, { p: [0, 0, -1.5], axis: 2 })[0];
const x = 600 + p[0] * cube.unit,
  y = 400 - p[1] * cube.unit;
const down = {
  pointerId: 7,
  pointerType: "mouse",
  button: 0,
  clientX: x,
  clientY: y,
  preventDefault() {},
};
cube.canvas.listeners.pointerdown(down);
cube.canvas.listeners.pointermove({
  ...down,
  clientX: x + c.vx * cube.unit,
  clientY: y + c.vy * cube.unit,
});
cube.canvas.listeners.pointerup(down);
await new Promise((resolve) => setImmediate(resolve));
flush();
assert.deepEqual(cube.cells, turn(cells, c.base));
cube.reset();
cube.opacity = 0.4;
cube.connected = true;
cube.setState(cube.cells);
flush();
cube.destroy();
$("practiceB").value = "99999999";
await $("practiceLoad").onsubmit({ preventDefault() {} });
assert.match($("practiceStatus").textContent, /Source line not found/);
$("practiceMode").checked = false;
await $("practiceMode").onchange();
assert(!$("cubeLayout").hidden);
await $("playSolution").onclick();
flush();
console.log(
  "PASS: full catalog startup, native views, retained facelets, practice selection/random/match/invalid input, turn/undo/reset/opacity, solution playback (mock DOM/WebGL).",
);

const source=observed.get($('scrambledCube')).view;
const target=observed.get($('solvedCube')).view;
assert(target.orbitOnly);assert(target.connected);assert(target.meshGenerator);
const composite=target.solid.data.slice();assert(composite.every(Number.isFinite));
$('practiceTargetPieces').value='cubies';$('practiceTargetPieces').listeners.change();assert(target.individualPieces);assert.notEqual(target.solid.data.length,composite.length);
$('practiceTargetPieces').value='whole';$('practiceTargetPieces').listeners.change();assert.deepEqual(target.solid.data,composite);
$('targetTransparency').value='25';$('targetTransparency').listeners.input();assert.equal(target.opacity,.75);
console.log('PASS: two views, native seamless target composites, cubie toggle, and transparency.');
flush();applicationPage.hidden=true;assert(!source.isVisible());
const pendingFrames=frames.length;source.invalidate();source.draw();assert.equal(frames.length,pendingFrames);
applicationPage.hidden=false;assert(source.isVisible());source.invalidate();assert(frames.length>pendingFrames);flush();
console.log('PASS: hidden explorer stops scheduling GPU frames and resumes when shown.');

const explorerState=[structuredClone(source.cells),structuredClone(target.cells)];
for(const camera of ['orthographic','perspective']) {
  $('explorerCamera').value=camera;$('explorerCamera').listeners.change();flush();
  assert.equal(source.perspective,camera==='perspective');assert.equal(target.perspective,source.perspective);
}
for(const shape of ['jelly','gameboy','text']) for(const style of ['jelly','dither','matte','cel','ascii']) {
  $('modelShape').value=shape;
  $('pieceAppearance').value=style;$('pieceAppearance').listeners.change();flush();
  assert.equal(target.modelShape,shape);assert.equal(source.modelShape,shape);assert.equal(target.appearance,style);assert.equal(source.appearance,style);
  assert.equal(target.canvas.dataset.appearance,style);assert.equal(source.canvas.dataset.appearance,style);
  assert.deepEqual([source.cells,target.cells],explorerState);
}
$('pieceColorO').value='#123456';$('pieceColorO').listeners.input();flush();
const palette=await import(new URL("render/palette.js",assetRoot));
assert.equal(palette.colors[1],'#123456');assert.equal(palette.packingPalette.y,'#123456');
assert(target.solid.data.some((value,i)=>i%9===6 && Math.abs(value-0x12/255)<1e-6));
assert.deepEqual([source.cells,target.cells],explorerState);
$('resetPieceColors').onclick();assert.deepEqual(palette.colors,palette.defaultColors);
console.log('PASS: explorer cameras, all configured shape/effect combinations and custom colors preserve packings and practice state.');

const retainedSurface=target.solid.data;
$('asciiSize').value='1.5';$('asciiSize').listeners.input();
$('faceLight').onclick();flush();
const visual=await import(new URL("render/visual-settings.js",assetRoot));
assert.equal(visual.visualSettings.asciiSize,1.5);assert.deepEqual(visual.lightDirection(),[0,0,1]);
assert.equal(target.solid.data,retainedSurface);
assert.deepEqual([source.cells,target.cells],explorerState);
$('resetascii').onclick();$('resetlight').onclick();
console.log('PASS: explorer filter controls preserve geometry and practice state.');

// Family mode owns one interactive cube and leaves the other modes intact.
$("familyExploreMode").checked=true;
await $("familyExploreMode").onchange();
flush();
assert(!$("familyExplorePanel").hidden && $("practicePanel").hidden && $("cubeLayout").hidden);
assert(!$("practiceMode").checked);
const familyView=observed.get($("familyExploreCube")).view;
assert(familyView.familyExploration && !familyView.orbitOnly);
const familyStart=structuredClone(familyView.cells);
const initialStatus=$("familyExploreProgress").textContent;
await familyView.play(0);flush();
assert.deepEqual(familyView.cells,turn(familyStart,0));
assert.match($("familyExploreProgress").textContent,/\d\/6 tetracubes/);
familyView.undo();flush();
await settle(()=>$("familyExploreProgress").textContent.includes("Packing found"));
assert.deepEqual(familyView.cells,familyStart);
assert.equal($("familyExploreProgress").textContent,initialStatus);
familyView.setState(familyView.cells,{kind:'turn',move:6,t:.5});
assert(familyView.explorationLayers.some(buffer=>buffer.count>0));
familyView.setState(familyView.cells);
$("familyExploreMode").checked=false;await $("familyExploreMode").onchange();
assert(!$("cubeLayout").hidden && $("familyExplorePanel").hidden);
$("familyExploreMode").checked=true;await $("familyExploreMode").onchange();
assert.deepEqual(familyView.cells,familyStart,'switching modes retains the exploration puzzle');
$('familySelect').value=String(official.familyId);await $('familySelect').listeners.change();
assert.match($("familyExploreTitle").textContent,new RegExp(`Family ${official.familyId}`));
assert.equal(familyView.history.length,0);
console.log('PASS: single-cube family exploration, sliced drag mesh, turn/undo, family selection and mode retention.');

const {detectPieces}=await import(new URL("explorer/family-exploration.js",assetRoot));
const splitMove=Array.from({length:30},(_,i)=>i).find(m=>detectPieces(turn(familyView.cells,m)).some(p=>!p.letter));
assert.notEqual(splitMove,undefined);
await familyView.play(splitMove);flush();
$('familyPieces').value='whole';$('familyPieces').listeners.change();
const beforeShapes=structuredClone(familyView.cells),roundMesh=familyView.solid.data.slice();
$('familyPieces').value='solids';$('familyPieces').listeners.change();flush();
assert(familyView.explorationSolids);
assert.deepEqual(familyView.cells,beforeShapes);
assert.notDeepEqual(familyView.solid.data,roundMesh);
assert.match($("familyExploreLetters").textContent,/Piece 1/);
familyView.setState(familyView.cells,{kind:'turn',move:6,t:.5});
assert(familyView.solid.data.every(Number.isFinite));
familyView.setState(familyView.cells);
await $('random').onclick();
assert(familyView.explorationSolids,'solid identities survive packing reloads');
assert(familyView.cells.filter(c=>c.piece>=0).every(c=>c.color));
$('familyPieces').value='whole';$('familyPieces').listeners.change();
assert(!familyView.explorationSolids);
console.log('PASS: family startup and solid-identity setting, live geometry changes and reload retention.');

let prepared=0;const prepareUpload=familyView.upload;familyView.upload=function(...args){prepared++;return prepareUpload.apply(this,args);};
for(let move=0;move<15;move++)familyView.setState(familyView.cells,{kind:'turn',move,t:0});
familyView.upload=prepareUpload;assert(prepared<=45,'only three buffers per requested partition');
const retained=familyView.explorationLayers.map(b=>b.data);
let turnUploads=0;const originalUpload=familyView.upload;
familyView.upload=function(...args){turnUploads++;return originalUpload.apply(this,args);};
for(let move=0;move<30;move++)for(const t of [0,.25,.75,1]) {
  familyView.setState(familyView.cells,{kind:'turn',move,t});familyView.draw();
}
familyView.upload=originalUpload;
assert.equal(turnUploads,0,'all drag frames use GPU transforms without geometry uploads');
familyView.explorationLayers.forEach((b,i)=>assert.equal(b.data,retained[i]));
familyView.setState(familyView.cells);
console.log('PASS: 120 family turn frames reuse static GPU geometry with zero uploads.');

$('targetTransparency').value='65';$('targetTransparency').listeners.input();
for(const id of ['familyExploreCube','solvedCube','scrambledCube','practiceLeft','practiceRight'])assert(Math.abs(observed.get($(id)).view.opacity-.35)<1e-6,`${id} receives opacity`);
$('targetTransparency').value='0';$('targetTransparency').listeners.input();assert.equal(familyView.opacity,1);
$('familyPieces').value='solids';$('familyPieces').listeners.change();
const greyMove=Array.from({length:30},(_,i)=>i).find(m=>detectPieces(turn(familyView.cells,m)).some(p=>!p.letter));
await familyView.play(greyMove);
assert.equal(visual.visualSettings.solidUniform,1);
$('solidUniform').checked=false;$('solidUniform').listeners.change();
const grayState=structuredClone(familyView.cells);
$('solidGray').checked=true;$('solidGray').listeners.change();const grayMesh=familyView.fixedSolidBuffers.map(b=>b.data.slice());
$('solidGray').checked=false;$('solidGray').listeners.change();
assert(!familyView.explorationGray);assert.notDeepEqual(familyView.fixedSolidBuffers.map(b=>b.data),grayMesh);
assert.deepEqual(familyView.cells,grayState);
$('solidGray').checked=true;$('solidGray').listeners.change();
assert(familyView.explorationGray);assert.deepEqual(familyView.fixedSolidBuffers.map(b=>b.data),grayMesh);
const transparencyMenu=html.slice(html.indexOf('<summary>Transparency</summary>')).split('</details>')[0];
assert(transparencyMenu.includes('id="ditherTransparency"') && transparencyMenu.includes('id="targetTransparency"'));
console.log('PASS: explorer-wide transparency, gray/color identity toggle and unified transparency menu.');

// A quarter turn carries solid orientation; settling must not recreate an
// unassembled tetrahedron in its original pose. Undo restores the same objects.
const {turnTransform,composeRotation,IDENTITY,movedCell}=await import(new URL('render/transforms.js',assetRoot));
const orientationBefore=familyView.cells.slice();
await familyView.play(1);
const {turn:turnCells}=await import(new URL('explorer/model.js',assetRoot));
const expectedPoses=turnCells(orientationBefore.map((c,i)=>movedCell(i,1)?composeRotation(turnTransform(1,1),c?.solidRotation):c?.solidRotation),1);
familyView.cells.forEach((c,i)=>assert.deepEqual(c?.solidRotation,expectedPoses[i]));
familyView.undo();assert.deepEqual(familyView.cells.map(c=>c?.solidRotation),orientationBefore.map(c=>c?.solidRotation));
$('solidFixed').checked=true;$('solidFixed').listeners.change();
assert(familyView.fixedSolidBuffers.some(b=>b.count));
const fixedRetained=familyView.fixedSolidBuffers.map(b=>b.data);
for(const t of [.1,.4,.8]){familyView.setState(familyView.cells,{kind:'turn',move:1,t});familyView.draw();}
familyView.fixedSolidBuffers.forEach((b,i)=>assert.equal(b.data,fixedRetained[i]));
familyView.setState(familyView.cells);
$('solidFixed').checked=false;$('solidFixed').listeners.change();
console.log('PASS: persistent explorer solid orientations, undo, and retained aligned-solid animation buffers.');

// Exercise the expanded collection with the actual binary data and native mesh engine.
const {initializeSpatialExplorer}=await import(new URL('explorer/spatial-explorer.js',assetRoot));
$('familySelect').value='';$('familyBag').value='';$('familyExploreMode').checked=true;$('practiceMode').checked=false;
for(const id of ['spatialComposition','planarSpanning','corePieceType'])$(id).value='';
for(const type of ['O','T','JL','SZ','B','D','F']){$('countMin'+type).value='0';$('countMax'+type).value='6';}
for(const id of ['nonFaceboundSurface','iTunnelOnly'])$(id).checked=false;
const spatial=await initializeSpatialExplorer({getElementById:getExplorerElement},{client});
assert.equal(spatial.current.dataset,'tetracubes-v2');
assert(!$('spatialFilters').hidden);
assert.match($('status').textContent,/1,871,891/);

await settle(()=>$('familyExploreProgress').textContent.includes('Packing found'));
$('spatialComposition').value='only';await spatial.query({position:0},true);
assert(spatial.current.identities.every(c=>'BDF'.includes(c.toUpperCase())));
await settle(()=>$('familyExploreProgress').textContent.includes('Packing found'));
await $('practiceRandom').onclick();assert.match($('practiceStatus').textContent,/Compatible pair/);
$('countMinB').value='7';await spatial.query();assert.match($('status').textContent,/marked count ranges/);assert.equal($('rangeCardB').dataset.rangeState,'invalid');
$('countMinB').value='0';
console.log('PASS: expanded explorer startup, full collection, spatial-only filters, detected family metadata, practice pairs and invalid counts.');

$('datasetSelect').value='classic';await $('datasetSelect').onchange();
assert.equal($('spatialComposition').disabled,true);
assert.equal(spatial.current.spatialBits,0);
assert.equal(spatial.current.dataset,'tetracubes-v2');
assert($('status').textContent.includes(manifest.count.toLocaleString()));
$('datasetSelect').value='spatial';await $('datasetSelect').onchange();
assert.equal($('spatialComposition').disabled,false);
assert.match($('status').textContent,/1,871,891 matching/);
console.log('PASS: collection switching uses the same database, with planar-only filtering and no ungrouped option.');

// Shared navigation controls target the visible family cube or selected practice side.
$('familySelect').value='';$('familyExploreMode').checked=true;await $('familyExploreMode').onchange();
$('sourceLine').value='50152';await $('sourceJump').onsubmit({preventDefault(){}});
await settle(()=>$('familyExploreProgress').textContent.includes('Packing found'));
assert.match($('familyExploreTitle').textContent,/Family 562.*Line 50152/);
assert.equal(observed.get($('familyExploreCube')).view.cells.filter(c=>c?.piece>=0).length,24);
await $('next').onclick();assert.match($('familyExploreTitle').textContent,/Line 50153/);
assert.equal(+$('sourceLine').value,50153);
$('practiceMode').checked=true;await $('practiceMode').onchange();
assert(!$('packingNavigation').hidden&&!$('navigationTargetLabel').hidden);
$('navigationTarget').value='target';await $('navigationTarget').onchange();
const startLine=+$('practiceA').value;
$('sourceLine').value='50152';await $('sourceJump').onsubmit({preventDefault(){}});
assert.equal(+$('practiceB').value,50152);assert.equal(+$('practiceA').value,startLine);
await $('next').onclick();assert.equal(+$('practiceB').value,50153);assert.equal(+$('practiceA').value,startLine);
$('navigationTarget').value='start';await $('navigationTarget').onchange();
const targetLine=+$('practiceB').value;
$('sourceLine').value='50154';await $('sourceJump').onsubmit({preventDefault(){}});
assert.equal(+$('practiceA').value,50154);assert.equal(+$('practiceB').value,targetLine);
assert(!html.includes('familyExploreSelect')&&!html.includes('familyExploreRandom'));
assert(html.indexOf('id="practiceLoad"')<html.indexOf('id="settingsPanel"'));
console.log('PASS: official startup packing, shared family navigation and independent start/target navigation.');

const practiceStartView=observed.get($('practiceLeft')).view;
await practiceStartView.play(0);
const retainedPracticeCells=structuredClone(practiceStartView.cells),retainedPracticeHistory=practiceStartView.history.length;
await $('practiceViewTarget').onclick();
assert.equal($('practicePanel').dataset.active,'target');assert.equal($('navigationTarget').value,'target');
await $('practiceViewStart').onclick();
assert.equal($('practicePanel').dataset.active,'start');assert.equal($('navigationTarget').value,'start');
assert(html.indexOf('id="familyExploreMode"')>html.indexOf('id="settingsPanel"'));
assert(html.indexOf('id="familyExploreMode"')<html.indexOf('id="familyExplorePanel"'));
assert(html.indexOf('id="practiceViewStart"')>html.indexOf('id="practicePanel"'));
assert(html.indexOf('id="viewTabs"')>html.indexOf('id="cubeLayout"'));
assert.equal(observed.get($('practiceLeft')).view.fitScale,5.2);
console.log('PASS: settings-only mode controls, in-viewport practice switching and larger practice framing.');

assert.deepEqual(practiceStartView.cells,retainedPracticeCells);assert.equal(practiceStartView.history.length,retainedPracticeHistory);
console.log('PASS: viewport switches preserve the in-progress practice puzzle.');

// Palette changes reach the live family renderer without resetting moves or poses.
$('familyExploreMode').checked=true;await $('familyExploreMode').onchange();
$('sourceLine').value='50152';await $('sourceJump').onsubmit({preventDefault(){}});
$('positionalColors').onchange();
const officialFamilyView=observed.get($('familyExploreCube')).view;
assert(officialFamilyView.fixedPieceColors);
await officialFamilyView.play(0);
const officialOwners=officialFamilyView.cells.map(c=>c.piece),officialHistory=officialFamilyView.history.length;
$('canonicalColors').onchange();assert(!officialFamilyView.fixedPieceColors);
$('positionalColors').onchange();assert(officialFamilyView.fixedPieceColors);
assert.deepEqual(officialFamilyView.cells.map(c=>c.piece),officialOwners);
assert.equal(officialFamilyView.history.length,officialHistory);
for(const c of officialFamilyView.cells)if(c.piece>=0)assert.equal(c.color,'bymogr'[c.piece]);
console.log('PASS: color-mode changes update live family rendering and preserve turn history.');

const beforeRecovery=structuredClone(officialFamilyView.cells),historyBeforeRecovery=officialFamilyView.history.length;
const retainedLayers=officialFamilyView.explorationLayers.slice();
const oldLayerBuffers=retainedLayers.map(layer=>layer.buffer);
const oldProgram=officialFamilyView.program;
assert(officialFamilyView.restoreGraphics());
assert.notEqual(officialFamilyView.program,oldProgram);
assert.deepEqual(officialFamilyView.cells,beforeRecovery);
assert.equal(officialFamilyView.history.length,historyBeforeRecovery);
retainedLayers.forEach((layer,i)=>{
  assert.equal(officialFamilyView.explorationLayers[i],layer);
  assert.notEqual(layer.buffer,oldLayerBuffers[i]);
  assert.equal(layer.count,(layer.data?.length||0)/9);
});
console.log('PASS: family-explorer GPU recovery preserves cut-piece layers, packing identity and move history.');

const controls=await import(new URL('input/control-settings.js',assetRoot));
const hoverView=familyView;
controls.setControlSetting('hoverRings',true);controls.setControlSetting('ringLabels',true);
hoverView.hover={hit:{axis:2,p:[1,1,1.5]},wide:false};hoverView.busy=false;hoverView.orbitDragging=false;
const uploaded=[];const hoverOriginalUpload=hoverView.upload.bind(hoverView);
hoverView.upload=(target,data)=>{uploaded.push(target);hoverOriginalUpload(target,data);};
hoverView.draw();assert(hoverView.decorBuffers['slices:0']?.count>0);assert(hoverView.decorBuffers['dragArrows:0']?.count>0);
assert(uploaded.includes(hoverView.decorBuffers['slices:0']));uploaded.length=0;
hoverView.orbitDragging=true;hoverView.draw();assert(!uploaded.includes(hoverView.decorBuffers['slices:0']));
hoverView.orbitDragging=false;controls.setControlSetting('hoverRings',false);uploaded.length=0;hoverView.draw();assert(!uploaded.includes(hoverView.decorBuffers['slices:0']));
controls.setControlSetting('wideTurns',true);assert(hoverView.wideTurns);assert(source.wideTurns);
controls.setControlSetting('classicControls',true);assert(!hoverView.classicGrid.hidden);assert(target.classicGrid.hidden);
controls.setControlSetting('showArrows',true);assert(!hoverView.arrowHost.hidden);hoverView.draw();assert(hoverView.attachedNodes.some(n=>n.layout));
hoverView.upload=hoverOriginalUpload;
console.log('PASS: explorer rings/labels, suppressed orbit feedback, shared wide turns, classic controls and clickable arrows.');

// Check UI wiring against the editable preset definitions, rather than freezing
// old preset policy into the layout test.
const {presetCounts,countSpecs,filterPresets,filterPresetPlaceholder}=await import(new URL('explorer/filter-counts.js',assetRoot));
assert.deepEqual($('filterPreset').children.map(n=>[n.value,n.textContent]),[['',filterPresetPlaceholder],...filterPresets]);
for(const name of ['planar','surface','official','soma','all']) {
  const current=Object.fromEntries(countSpecs.map(([id])=>[id,{min:Number($('countMin'+id).value),max:Number($('countMax'+id).value)}]));
  const expected=presetCounts(name,current,+$('familySelect').value||0);
  if(name==='all')await $('resetPackingFilters').onclick();
  else {$('filterPreset').value=name;await $('filterPreset').onchange();}
  for(const [id,r] of Object.entries(expected.ranges)) {
    assert.equal($('countMin'+id).value,String(r.min));
    assert.equal($('countMax'+id).value,String(r.max));
  }
  assert.equal($('familySelect').value,expected.family?String(expected.family):'');
}
$('countMinT').value='2';$('countMaxExtraCore').value='0';$('familySelect').value='562';
await $('resetPieceFilters').onclick();
assert.equal($('countMinT').value,'0');assert.equal($('countMaxT').value,'6');
assert.equal($('countMaxExtraCore').value,'0');assert.equal($('familySelect').value,'562');
await $('clearFilterFamily').onclick();assert.equal($('familySelect').value,'');assert.equal($('countMaxExtraCore').value,'0');
assert.equal($('clearFilterFamily').disabled,true);
await $('resetPackingFilters').onclick();assert.equal($('countMaxExtraCore').value,'1');
assert.equal($('rangeFilterSummary').textContent,'All counts unrestricted');
$('packingPicker').open=true;$('closePackingPicker').onclick();assert.equal($('packingPicker').open,false);
console.log('PASS: chooser presets use the current custom rules; standalone reset and close controls work.');

familyView.modelShape='jelly';familyView.familyExploration=true;
$('familyPieces').value='whole';$('familyPieces').listeners.change();
await $('resetPackingFilters').onclick();
const cornerCells=Array(27).fill(null);for(const i of [0,1,3,4])cornerCells[i]={piece:0,color:'y'};
familyView.setCells(cornerCells);const defaultCornerMesh=familyView.solid.data.slice();
$('jellyCornerO').checked=true;$('jellyCornerO').listeners.change();
assert.notDeepEqual(familyView.solid.data,defaultCornerMesh);assert.deepEqual(familyView.cells,cornerCells);
$('jellyCornerO').checked=false;$('jellyCornerO').listeners.change();
assert.deepEqual(familyView.solid.data,defaultCornerMesh);
console.log('PASS: explorer corner-O toggle refreshes cached family meshes without changing cells.');

// Refine around the current packing. Widening, or narrowing up to its exact
// count, must not reset the live cube or request a different packing.
await $('resetPackingFilters').onclick();
const threeO=await spatial.client.query({filters:{counts:[{type:'O',min:3,max:3}]}});
assert(threeO.record);await spatial.query({line:threeO.record.lineNumber});
const chosenLine=spatial.current.lineNumber;
let navigations=0;const originalNavigate=spatial.views.navigate;
spatial.views.navigate=async(...args)=>{navigations++;return originalNavigate(...args);};
const retainedCells=familyView.cells,retainedHistory=familyView.history;
for(const min of [2,3,1,0]) {
 $('countMinO').value=String(min);await $('countMinO').listeners.change();
 assert.equal(spatial.current.lineNumber,chosenLine);assert.equal(navigations,0);
 assert.equal(familyView.cells,retainedCells);assert.equal(familyView.history,retainedHistory);
}
for(const max of [4,3,6]) {
 $('countMaxO').value=String(max);await $('countMaxO').listeners.change();
 assert.equal(spatial.current.lineNumber,chosenLine);assert.equal(navigations,0);
}
$('countMinO').value='4';await $('countMinO').listeners.change();
assert.notEqual(spatial.current.lineNumber,chosenLine);assert.equal(navigations,1);
await $('resetPackingFilters').onclick();assert.equal(navigations,1);
await spatial.query({line:chosenLine});navigations=0;
$('countMaxO').value='2';await $('countMaxO').listeners.change();
assert.notEqual(spatial.current.lineNumber,chosenLine);assert.equal(navigations,1);
const beforeNoMatch=spatial.current.lineNumber;
$('countMinO').value='6';$('countMaxO').value='6';$('countMinT').value='6';
await $('countMinT').listeners.change();
assert.equal(spatial.current.lineNumber,beforeNoMatch);assert.equal(navigations,1);
assert.match($('packingIndex').textContent,/No matches/);
await $('resetPackingFilters').onclick();
assert.equal(spatial.current.lineNumber,beforeNoMatch);assert.equal(navigations,1);
assert.doesNotMatch($('packingIndex').textContent,/No matches/);
spatial.views.navigate=originalNavigate;
console.log('PASS: filters retain matching selections and live history, replacing only packings outside the new range.');

// New display controls rebuild only geometry, preserving the current puzzle.
const keptCells=familyView.cells,keptHistory=familyView.history,joinedMesh=familyView.solid.data.slice();
$('familyPieces').value='cubies';$('familyPieces').listeners.change();
assert(familyView.individualPieces);assert.equal(familyView.cells,keptCells);assert.equal(familyView.history,keptHistory);
assert.notDeepEqual(familyView.solid.data,joinedMesh);
$('familyPieces').value='whole';$('familyPieces').listeners.change();assert(!familyView.individualPieces);
$('familySize').value='135';$('familySize').listeners.input();assert.equal(familyView.zoomScale,1.35);assert.equal(familyView.cells,keptCells);
$('familySize').value='100';$('familySize').listeners.input();
console.log('PASS: family assembly and independent viewport size change visuals without altering cells/history.');

// Inspection keeps the exact working cube, even when new filters exclude it.
const inspectedView=observed.get($("familyExploreCube")).view;
await $('resetPackingFilters').onclick();
$('familyInspectFilters').checked=true;$('familyInspectFilters').onchange();
$('familyPieces').value='wholeSolids';$('familyPieces').listeners.change();
const inspectionLine=spatial.current.lineNumber,inspectionCells=inspectedView.cells,inspectionHistory=inspectedView.history;
const recognized=detectPieces(inspectedView.cells).find(p=>p.letter);assert(recognized);
const excludedType=recognized.letter.replace('/','');
$('countMin'+excludedType).value='0';$('countMax'+excludedType).value='0';
await $('countMax'+excludedType).listeners.change();
assert.equal(spatial.current.lineNumber,inspectionLine);assert.equal(inspectedView.cells,inspectionCells);assert.equal(inspectedView.history,inspectionHistory);
assert.equal(detectPieces(inspectedView.cells,inspectedView.detectionFilters).find(p=>p.id===recognized.id).letter,null);
assert.match($('packingIndex').textContent,/Inspecting/);
assert(inspectedView.explorationGeometry.some(m=>m.identityCell!==undefined));
await $('resetPackingFilters').onclick();
assert.equal(inspectedView.cells,inspectionCells);assert.equal(inspectedView.history,inspectionHistory);
assert(detectPieces(inspectedView.cells,inspectedView.detectionFilters).find(p=>p.id===recognized.id).letter);
$('positionalColors').checked=true;$('positionalColors').onchange();
assert(inspectedView.fixedPieceColors);assert.equal(new Set(inspectedView.cells.filter(c=>c.piece>=0).map(c=>c.color)).size,6);
console.log('PASS: default inspection preserves the live cube/history across exclusions and resets; recognition and distinct colors update in place.');

// Out-of-order filter results must not replace newer counts or disturb the cube.
const queryBeforeRace=client.query,filterResponses=[],raceHistory=inspectedView.history,raceCurrent=spatial.current;
try {
  client.query=()=>new Promise(resolve=>filterResponses.push(resolve));
  const olderQuery=spatial.query({},true,false),newerQuery=spatial.query({},true,false);
  assert.equal(filterResponses.length,2);
  const result=count=>{const familyCounts=Array(Math.max(...client.info.families.map(f=>f.id))+1).fill(0);familyCounts[raceCurrent.familyId]=count;return {record:raceCurrent,count,position:0,familyCounts};};
  filterResponses[1](result(22));await newerQuery;
  const latestStatus=$('status').textContent;
  assert(latestStatus.startsWith('22 matching'));
  filterResponses[0](result(11));await olderQuery;
  assert.equal($('status').textContent,latestStatus);
  assert.equal(spatial.current,raceCurrent);assert.equal(inspectedView.history,raceHistory);
} finally {client.query=queryBeforeRace;}
console.log('PASS: out-of-order filter queries preserve the latest result and live cube history.');
