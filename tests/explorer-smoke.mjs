import fs from "node:fs";
import assert from "node:assert/strict";
const html = fs.readFileSync(
  new URL("../dist/explorer/index.html", import.meta.url),
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
        new URL(url, new URL("../dist/explorer/", import.meta.url)),
        "utf8",
      ),
  }),
});

$("targetTransparency").value = "0";
for (const id of ["extraEdges", "extraCorners", "extraCenters"])
  $(id).value = "any";
const {PackingCube}=await import('../dist/explorer/cube-view.js');
const observed=new Map(), originalSetState=PackingCube.prototype.setState;
PackingCube.prototype.setState=function(cells,animation){observed.set(this.host,{view:this,animation});return originalSetState.call(this,cells,animation);};
const getExplorerElement = document.getElementById;
// The application document has no explorer IDs when mounted in a shadow root.
const applicationPage = {hidden:false};
document.getElementById = id => id === "explorerPage" ? applicationPage : id === "cubeLayout" ? null : getExplorerElement(id);
const { ready, initializeExplorer } = await import("../dist/explorer/script.js");
assert.equal(ready,null);
await initializeExplorer({getElementById:getExplorerElement});
assert.match($("status").textContent, /^Loaded /);
assert($("familyExploreMode").checked && !$("familyExplorePanel").hidden);
assert($("cubeLayout").hidden && $("practicePanel").hidden);
assert(observed.has($("familyExploreCube")),"family cube is initialized on startup");
const flush = () => {
  let n = 0;
  while (frames.length && n++ < 100) frames.shift()(800);
};
flush();
assert.equal($("solvedFacelets").textContent.length, 54);
assert($("solvedCube").children.length >= 2);
assert($("scrambledCube").children.length >= 2);
// Switching only the color scheme must not rotate, reflect, or recolor the
// official source packing, including its white edge and black center.
const officialTarget = structuredClone(observed.get($("solvedCube")).view.cells);
$("canonicalColors").listeners.change();
assert.deepEqual(observed.get($("solvedCube")).view.cells, officialTarget,
  "official source: canonical and official-compatible cells must be identical");
$("officialColors").listeners.change();
assert.deepEqual(observed.get($("solvedCube")).view.cells, officialTarget);
assert(!html.includes('id="piece3d"')); assert.equal($("cubeLayout").dataset.views,2);
$("practiceMode").checked = true;
$("practiceMode").onchange();
flush();
assert(!$("practicePanel").hidden);
assert($("cubeLayout").hidden);
assert.match($("practiceStatus").textContent, /Reachable pair/);
assert.notEqual($("practiceA").value, $("practiceB").value);
$("practiceA").value = "77451";
$("practiceB").value = "77451";
$("practiceLoad").onsubmit({ preventDefault() {} });
flush();
assert.equal($("practiceProgress").textContent, "Target matched!");

const { practicePair, turn } = await import("../dist/explorer/model.js");
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

const { sliceCandidates } = await import("../dist/input/drag.js");
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
$("practiceLoad").onsubmit({ preventDefault() {} });
assert.match($("practiceStatus").textContent, /valid source line/);
$("practiceMode").checked = false;
$("practiceMode").onchange();
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
for(const style of ['jelly','dither','matte','voxel','cel','ascii','dither']) {
  $('pieceAppearance').value=style;$('pieceAppearance').listeners.change();flush();
  assert.equal(target.appearance,style);assert.equal(source.appearance,style);
  assert.equal(target.canvas.dataset.appearance,style);assert.equal(source.canvas.dataset.appearance,style);
  assert.deepEqual([source.cells,target.cells],explorerState);
}
$('pieceColorO').value='#123456';$('pieceColorO').listeners.input();flush();
const palette=await import('../dist/render/palette.js');
assert.equal(palette.colors[1],'#123456');assert.equal(palette.packingPalette.y,'#123456');
assert(target.solid.data.some((value,i)=>i%9===6 && Math.abs(value-0x12/255)<1e-6));
assert.deepEqual([source.cells,target.cells],explorerState);
$('resetPieceColors').onclick();assert.deepEqual(palette.colors,palette.defaultColors);
console.log('PASS: explorer cameras, six styles and custom colors preserve packings and practice state.');

const retainedSurface=target.solid.data;
$('asciiSize').value='1.5';$('asciiSize').listeners.input();
$('faceLight').onclick();flush();
const visual=await import('../dist/render/visual-settings.js');
assert.equal(visual.visualSettings.asciiSize,1.5);assert.deepEqual(visual.lightDirection(),[0,0,1]);
assert.equal(target.solid.data,retainedSurface);
assert.deepEqual([source.cells,target.cells],explorerState);
$('resetascii').onclick();$('resetlight').onclick();
console.log('PASS: explorer filter controls preserve geometry and practice state.');

// Family mode owns one interactive cube and leaves the other modes intact.
$("familyExploreMode").checked=true;
$("familyExploreMode").onchange();
flush();
assert(!$("familyExplorePanel").hidden && $("practicePanel").hidden && $("cubeLayout").hidden);
assert(!$("practiceMode").checked);
const familyView=observed.get($("familyExploreCube")).view;
assert(familyView.familyExploration && !familyView.orbitOnly);
const familyStart=structuredClone(familyView.cells);
const initialStatus=$("familyExploreProgress").textContent;
await familyView.play(0);flush();
assert.deepEqual(familyView.cells,turn(familyStart,0));
assert.match($("familyExploreProgress").textContent,/\d\/6 tetrominos/);
familyView.undo();flush();
assert.deepEqual(familyView.cells,familyStart);
assert.equal($("familyExploreProgress").textContent,initialStatus);
familyView.setState(familyView.cells,{kind:'turn',move:6,t:.5});
assert(familyView.explorationTurn.parts.rotating.length>0);
familyView.setState(familyView.cells);
$("familyExploreMode").checked=false;$("familyExploreMode").onchange();
assert(!$("cubeLayout").hidden && $("familyExplorePanel").hidden);
$("familyExploreMode").checked=true;$("familyExploreMode").onchange();
assert.deepEqual(familyView.cells,familyStart,'switching modes retains the exploration puzzle');
$("familyExploreSelect").value='19';$("familyExploreSelect").onchange();
assert.match($("familyExploreTitle").textContent,/Family 19/);
assert.equal(familyView.history.length,0);
console.log('PASS: single-cube family exploration, sliced drag mesh, turn/undo, family selection and mode retention.');

const {detectPieces}=await import('../dist/explorer/family-exploration.js');
const splitMove=Array.from({length:30},(_,i)=>i).find(m=>detectPieces(turn(familyView.cells,m)).some(p=>!p.letter));
assert.notEqual(splitMove,undefined);
await familyView.play(splitMove);flush();
const beforeShapes=structuredClone(familyView.cells),roundMesh=familyView.solid.data.slice();
$("familySolidIdentities").checked=true;$("familySolidIdentities").onchange();flush();
assert(familyView.explorationSolids);
assert.deepEqual(familyView.cells,beforeShapes);
assert.notDeepEqual(familyView.solid.data,roundMesh);
assert.match($("familyExploreLetters").textContent,/Tetrahedron/);
familyView.setState(familyView.cells,{kind:'turn',move:6,t:.5});
assert(familyView.solid.data.every(Number.isFinite));
familyView.setState(familyView.cells);
$("familyExploreRandom").onclick();
assert(familyView.explorationSolids,'solid identities survive packing reloads');
assert.equal(new Set(familyView.cells.filter(c=>c.piece>=0).map(c=>c.color)).size,6);
$("familySolidIdentities").checked=false;$("familySolidIdentities").onchange();
assert(!familyView.explorationSolids);
console.log('PASS: family startup and solid-identity setting, live geometry changes and reload retention.');
