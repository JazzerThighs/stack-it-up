import fs from "node:fs";
import assert from "node:assert/strict";
const buildInfo=JSON.parse(fs.readFileSync(new URL('../dist/build-info.json',import.meta.url),'utf8'));
const assetRoot=new URL(`../dist/${buildInfo.assets}/`,import.meta.url);
const html = fs.readFileSync(
  new URL("explorer/index.html", assetRoot),
  "utf8",
);
const enums = new Map(),
  frames = [],
  elements = new Map();
let buffer;
const gl = new Proxy(
  {
    createVertexArray: () => ({}),
    createBuffer: () => ({}),
    createProgram: () => ({}),
    createShader: () => ({}),
    getShaderParameter: () => true,
    checkFramebufferStatus: () => gl.FRAMEBUFFER_COMPLETE,
    getProgramParameter: () => true,
    getAttribLocation: () => 0,
    getUniformLocation: () => ({}),
    bindBuffer: (_, b) => (buffer = b),
    bufferData: (_, data) => {
      buffer.data = data;
    },
  },
  {
    get: (o, k) =>
      k in o
        ? o[k]
        : k === k.toUpperCase()
          ? enums.has(k)
            ? enums.get(k)
            : (enums.set(k, enums.size + 1), enums.get(k))
          : () => {},
  },
);
function element() {
  return {
    checked: false,
    value: "",
    style: {},
    dataset: {},
    children: [],
    hidden: false,
    disabled: false,
    textContent: "",
    classList: { toggle() {}, add() {}, remove() {} },
    append(...x) {
      this.children.push(...x);
    },
    replaceChildren(...x) {
      this.children = x;
    },
    setAttribute() {},
    addEventListener(t, f) {
      (this.listeners ??= {})[t] = f;
    },
    querySelector() {
      return (this.child ??= element());
    },
    closest() {
      return (this.parent ??= element());
    },
    getContext(type) {
      return type === "webgl2" ? gl : new Proxy({}, { get: () => () => {} });
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 1200, height: 800 };
    },
    setPointerCapture() {},
    focus() {},
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
  };
}
for (const tag of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
  const e = element();
  e.checked = /\bchecked\b/.test(tag[0]);
  e.hidden = /\bhidden\b/.test(tag[0]);
  e.value = tag[0].match(/\bvalue="([^"]*)"/)?.[1] || "";
  elements.set(tag[1], e);
}
const $ = (id) => {
  assert(elements.has(id), `missing ${id}`);
  return elements.get(id);
};
Object.assign(globalThis, {
  window: {},
  cancelAnimationFrame: () => {},
  document: {
    hidden: false,
    getElementById: $,
    createElement: element,
    querySelector: element,
    querySelectorAll: () => [],
    addEventListener() {},
  },
  devicePixelRatio: 1,
  matchMedia: () => ({ matches: true }),
  ResizeObserver: class {
    observe() {}
    disconnect() {}
  },
  requestAnimationFrame: (fn) => (frames.push(fn), frames.length),
  fetch: async (url) => ({
    ok: true,
    arrayBuffer:async()=>fs.readFileSync(url),
    text: async () =>
      fs.readFileSync(
        new URL(url, new URL("explorer/", assetRoot)),
        "utf8",
      ),
  }),
});

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
assert.equal(initial.current.lineNumber,50152);assert.equal(initial.current.familyId,562);
assert.deepEqual(initial.current.masks,[0xf,0xf0,0x40e00,0x780000,0x3018000,0x4024100]);
assert.equal($('sourceLine').value,50152);
assert(!$('packingNavigation').hidden);
assert(!html.includes('ungroupedOnly'));
assert($("familyExploreMode").checked && !$("familyExplorePanel").hidden);
assert($("cubeLayout").hidden && $("practicePanel").hidden);
assert(observed.has($("familyExploreCube")),"family cube is initialized on startup");
const flush = () => {
  let n = 0;
  while (frames.length && n++ < 100) frames.shift()(800);
};
flush();
assert.match($('solvedFacelets').textContent,/Native tetracube/);
assert($("solvedCube").children.length >= 2);
assert($("scrambledCube").children.length >= 2);
// Switching only the color scheme must not rotate, reflect, or recolor the
// official source packing, including its white edge and black center.
$('canonicalColors').onchange();
assert(observed.get($('solvedCube')).view.cells.some(c=>c.color==='r'));
$('officialColors').onchange();
assert(!html.includes('id="piece3d"')); assert.equal($("cubeLayout").dataset.views,2);
$("practiceMode").checked = true;
await $("practiceMode").onchange();
flush();
assert(!$("practicePanel").hidden);
assert($("cubeLayout").hidden);
assert.match($("practiceStatus").textContent, /Reachable pair/);
await $('practiceRandom').onclick();
assert.notEqual($('practiceA').value,$('practiceB').value);
$("practiceA").value = String(official.lineNumber);
$("practiceB").value = String(official.lineNumber);
await $("practiceLoad").onsubmit({ preventDefault() {} });
flush();
assert.equal($("practiceProgress").textContent, "Target matched!");

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
$('targetComposite').checked=false;$('targetComposite').listeners.change();assert(!target.connected);assert.notEqual(target.solid.data.length,composite.length);
$('targetComposite').checked=true;$('targetComposite').listeners.change();assert.deepEqual(target.solid.data,composite);
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
for(const shape of ['jelly','voxel','gameboy']) for(const style of ['jelly','dither','matte','cel','ascii']) {
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
console.log('PASS: explorer cameras, all 15 shape/effect combinations and custom colors preserve packings and practice state.');

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
$("familySolidIdentities").checked=false;$("familySolidIdentities").onchange();
const beforeShapes=structuredClone(familyView.cells),roundMesh=familyView.solid.data.slice();
$("familySolidIdentities").checked=true;$("familySolidIdentities").onchange();flush();
assert(familyView.explorationSolids);
assert.deepEqual(familyView.cells,beforeShapes);
assert.notDeepEqual(familyView.solid.data,roundMesh);
assert.match($("familyExploreLetters").textContent,/Piece 1/);
familyView.setState(familyView.cells,{kind:'turn',move:6,t:.5});
assert(familyView.solid.data.every(Number.isFinite));
familyView.setState(familyView.cells);
await $('random').onclick();
assert(familyView.explorationSolids,'solid identities survive packing reloads');
assert.equal(new Set(familyView.cells.filter(c=>c.piece>=0).map(c=>c.color)).size,6);
$("familySolidIdentities").checked=false;$("familySolidIdentities").onchange();
assert(!familyView.explorationSolids);
console.log('PASS: family startup and solid-identity setting, live geometry changes and reload retention.');

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
$('familySolidIdentities').checked=true;$('familySolidIdentities').onchange();
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
await $('practiceRandom').onclick();assert.match($('practiceStatus').textContent,/Reachable pair/);
$('countMinB').value='7';await spatial.query();assert.match($('status').textContent,/Piece counts/);
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
$('officialColors').onchange();
const officialFamilyView=observed.get($('familyExploreCube')).view;
assert(officialFamilyView.fixedPieceColors);
await officialFamilyView.play(0);
const officialOwners=officialFamilyView.cells.map(c=>c.piece),officialHistory=officialFamilyView.history.length;
$('canonicalColors').onchange();assert(!officialFamilyView.fixedPieceColors);
$('officialColors').onchange();assert(officialFamilyView.fixedPieceColors);
assert.deepEqual(officialFamilyView.cells.map(c=>c.piece),officialOwners);
assert.equal(officialFamilyView.history.length,officialHistory);
for(const c of officialFamilyView.cells)if(c.piece>=0)assert.equal(c.color,'brogym'[c.piece]);
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
  assert.equal(layer.count,layer.data.length/9);
});
console.log('PASS: family-explorer GPU recovery preserves cut-piece layers, packing identity and move history.');
