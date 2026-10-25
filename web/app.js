import { initializeSession } from "./ui/session.js";
import { mountExplorer } from "./explorer/mount.js";
import { S } from "./engine/snapshot.js";
import { createAnimations } from "./ui/animations.js";
import { createMoveButtons } from "./ui/move-buttons.js";
import {
  Renderer,
  colors,
  faceLabels,
  configureRenderer,
} from "./render/renderer.js";
import { createEngine } from "./engine/wasm.js";
import { moveLabels } from "./engine/coordinates.js";
import {
  initializeSettings,
  syncDisplaySettings,
  layerOrder,
} from "./ui/settings.js";
const $ = (id) => document.getElementById(id);
const names = ["", "O", "T", "L", "J", "S", "Z"];

const groups = {
  face: [0, 1, 2, 3, 5, 4],
  slice: [6, 7, 8],
  wide: [9, 10, 11, 12, 14, 13],
};
let engine,
  state,
  mode = "face",
  renderers = [],
  pending = false,
  meshRevision = -1,
  busy = false;
let lockMode = false;
let session;
const animations = $("animations");
animations.checked = !matchMedia("(prefers-reduced-motion: reduce)").matches;
const moveButtons = [],
  faceCells = [],
  queueShapes = [];
function shape(el) {
  const cells = Array.from({ length: 9 }, () => {
    const i = document.createElement("i");
    el.append(i);
    return i;
  });
  return (piece) => {
    el.style.color = colors[piece];
    cells.forEach((c, i) =>
      c.classList.toggle("filled", !!(state[134 + piece - 1] & (1 << i))),
    );
  };
}
const target = shape($("target")),
  heldShape = shape($("heldShape"));
$("holdPiece").onclick = holdPiece;
for (let j = 0; j < 5; j++) {
  const item = document.createElement("div");
  item.className = "queue-item";
  const s = document.createElement("div");
  s.className = "shape";
  const label = document.createElement("small");
  item.append(s, label);
  $("queue").append(item);
  queueShapes.push({ update: shape(s), label });
}
for (let f = 0; f < 6; f++) {
  const el = document.createElement("div"),
    label = document.createElement("span"),
    grid = document.createElement("div");
  label.className = "face-label";
  label.textContent = faceLabels[f];
  grid.className = "face-grid";
  const cells = Array.from({ length: 9 }, () => {
    const c = document.createElement("i");
    grid.append(c);
    return c;
  });
  el.append(label, grid);
  $("net").append(el);
  faceCells.push(cells);
}
for (let m = 0; m < 30; m++) {
  const b = document.createElement("button");
  b.className = "move" + (m >= 15 ? " prime" : "");
  b.textContent = moveLabels[m % 15] + (m >= 15 ? "′" : "");
  b.dataset.move = m;
  b.addEventListener("click", () => play(m));
  moveButtons.push(b);
}
function selectMode(next) {
  mode = next;
  document.querySelectorAll("[data-mode]").forEach((b) => {
    const selected = b.dataset.mode === mode;
    b.setAttribute("aria-selected", String(selected));
    b.tabIndex = selected ? 0 : -1;
  });
  $("moves").setAttribute("aria-labelledby", `tab-${mode}`);
  $("moves").replaceChildren(
    ...groups[mode].map((m) => {
      const pair = document.createElement("div");
      pair.className = "move-pair";
      pair.append(moveButtons[m], moveButtons[m + 15]);
      return pair;
    }),
  );
  $("moves").style.gridTemplateColumns = `repeat(${groups[mode].length},1fr)`;
}
document.querySelectorAll("[data-mode]").forEach((b) => {
  b.onclick = () => selectMode(b.dataset.mode);
  b.onkeydown = (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const modes = Object.keys(groups),
      i = modes.indexOf(mode),
      next =
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? 2
            : (i + (e.key === "ArrowRight" ? 1 : 2)) % 3;
    selectMode(modes[next]);
    $(`tab-${mode}`).focus();
  };
});
function invalidate() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    if ($("gamePage").hidden) return;
    renderers.forEach((r) => r.draw());
    if (
      !busy &&
      animations.checked &&
      !document.hidden &&
      state?.[54] &&
      !state?.[66]
    )
      invalidate();
  });
}
function snapshot() {
  return engine.snapshot();
}
function update(message) {
  state = snapshot();
  $("earlyLock").checked = !!engine.game_early_lock();
  $("sliceClearMode").value = String(engine.game_slice_clear_mode());
  $("gravityMode").value = String(state[S.GRAVITY_MODE]);
  $("fragmentPerk").checked = !!state[S.FRAGMENTS_ENABLED];
  $("bandagedFragments").checked = !!state[S.BANDAGED];
  $("randomCubies").checked = !!state[S.RANDOM_CUBIES];
  $("rebuildMode").value = String(state[S.REBUILD_MODE]);
  $("rebuildStatus").textContent = state[S.REBUILD_MASK]
    ? state[S.REBUILD_PENDING]
      ? `Rebuildable rounded cubies must all form complete tetrominos. Same-colored cubies can mix; the current piece uses spheres.`
      : "Reconstructed pieces are ready to lock with the current piece."
    : "";
  $("fragmentBadge").hidden = !state[S.FLOATING_COUNT];
  $("fragmentBadge").textContent =
    `${state[S.FLOATING_COUNT]} freed cubies${state[S.REBUILD_PENDING] ? " · rebuilding" : ""}`;
  $("fragmentStatus").textContent = state[S.FLOATING_COUNT]
    ? `Freed cubies lock with the current piece. ${state[S.FLOATING_OVERLAPS] ? "Move them off the stack first. " : ""}${state[S.BANDAGED] ? "White connections cannot be split by a turn. " : ""}${state[S.FRAGMENT_TURNS] ? `${state[S.FRAGMENT_TURNS]} broken-fragment perk turns remain.` : ""}`
    : "";
  const p = state[S.PIECE];
  target(p);
  heldShape(state[S.HELD]);
  $("holdStatus").textContent = state[S.HOLD_USED]
    ? "After placement"
    : state[S.HELD]
      ? "Swap"
      : "Empty";
  $("holdPiece").setAttribute(
    "aria-label",
    `Hold / swap: ${names[state[S.HELD]] || "empty"}${state[S.HOLD_USED] ? ", available after placement" : ""}`,
  );
  $("pieceName").textContent = names[p];
  $("pieceName").style.color = colors[p];
  $("target").setAttribute("aria-label", `${names[p]} tetromino`);
  const edges = state[140 + (p - 1) * 2],
    corners = state[141 + (p - 1) * 2];
  $("inventory").textContent =
    `1 center · ${edges} edge${edges === 1 ? "" : "s"} · ${corners} corner${corners === 1 ? "" : "s"}`;
  queueShapes.forEach((q, i) => {
    q.update(state[56 + i]);
    q.label.textContent = names[state[56 + i]];
  });
  $("score").textContent = state[S.SCORE].toLocaleString();
  $("pieces").textContent = state[S.PIECES];
  $("clears").textContent = state[S.CLEARS];
  $("capacity").value = state[S.OCCUPIED_COUNT];
  $("capacity").textContent = `${state[S.OCCUPIED_COUNT]} of 27 cells occupied`;
  $("capacity").setAttribute(
    "aria-valuetext",
    `${state[S.OCCUPIED_COUNT]} of 27 cells occupied`,
  );
  $("capacityLabel").textContent = `${state[S.OCCUPIED_COUNT]} / 27 cells`;
  $("undo").disabled = busy || !state[S.UNDO_COUNT];
  $("new").disabled = busy;
  $("emptyStack").hidden = !!state[S.OCCUPIED_COUNT];
  let wins = 0;
  moveButtons.forEach((b, m) => {
    const win = !!(state[S.WINNING_MOVES] & (1 << m));
    wins += win;
    b.classList.toggle("winning", win);
    b.disabled = busy || !!state[S.OVER] || !!state[S.PENDING_FACES];
    const label = `${moveLabels[m % 15]}${m >= 15 ? " prime" : ""}${win ? " — places the current piece" : ""}`;
    b.setAttribute("aria-label", label);
    b.title = label;
  });
  document.querySelectorAll("[data-mode]").forEach((b) => {
    const n = groups[b.dataset.mode].reduce(
      (n, m) =>
        n +
        !!(state[S.WINNING_MOVES] & (1 << m)) +
        !!(state[S.WINNING_MOVES] & (1 << (m + 15))),
      0,
    );
    b.querySelector("span").textContent = n ? `${n} ✓` : "";
  });
  $("hint").textContent = state[S.PENDING_FACES]
    ? "Choose a highlighted face, or undo to keep turning."
    : state[S.OVER]
      ? "Top out. Undo a turn or start a new game."
      : wins
        ? `${wins} winning turn${wins === 1 ? "" : "s"} available. Look for ✓ in any tab.`
        : "Keep turning. A ✓ will mark a move that places this piece.";
  $("message").textContent = state[S.PENDING_FACES]
    ? "This piece fits more than one face. Choose where to place it."
    : state[S.OVER]
      ? "Top out: no face, surface, or internal placement fits."
      : message || `Build ${names[p]} on any free face.`;
  for (let f = 0; f < 6; f++)
    for (let c = 0; c < 9; c++) {
      const i = state[80 + f * 9 + c],
        active = !!((state[S.ACTIVE] | state[S.FLOATING]) & (1 << i)),
        floating = !!(state[S.FLOATING] & (1 << i)),
        el = faceCells[f][c];
      el.style.background = floating
        ? "#ffffff"
        : state[i]
          ? colors[state[i]]
          : active
            ? colors[p]
            : "";
      el.classList.toggle("active", active);
      el.classList.toggle("overlap", active && !!state[i]);
      el.title = `${faceLabels[f]} ${c + 1}: ${state[i] ? `${names[state[i]]} stack` : "empty"}${active ? ", active" : ""}`;
    }
  syncOverlayControls();
  syncChoices();
  renderers.forEach((r) => r.setState(state));
  if (meshRevision !== state[S.REVISION]) {
    const mesh = engine.mesh();
    renderers.forEach((r) => r.setMesh(mesh));
    meshRevision = state[S.REVISION];
  }
  invalidate();
}
function syncChoices() {
  $("choice").hidden = !state[S.PENDING_FACES];
  $("moves").hidden = !!state[S.PENDING_FACES];
  faceButtons.forEach(
    (b, f) => (b.disabled = busy || !(state[S.PENDING_FACES] & (1 << f))),
  );
  if (state[S.PENDING_FACES]) selectMode("face");
}
const faceButtons = faceLabels.map((label, f) => {
  const b = document.createElement("button");
  b.textContent = label;
  b.setAttribute("aria-label", `Place on ${label}`);
  b.onclick = () => choose(f);
  const preview = () => {
    renderers[0].preview = state[152 + f];
    renderers[0].setState(state);
    invalidate();
  };
  const clear = () => {
    renderers[0].preview = 0;
    renderers[0].setState(state);
    invalidate();
  };
  b.onpointerenter = preview;
  b.onfocus = preview;
  b.onpointerleave = clear;
  b.onblur = clear;
  $("faceChoices").append(b);
  return b;
});
function setBusy(value) {
  busy = value;
  syncOverlayControls();
  moveButtons.forEach(
    (b) => (b.disabled = value || !!state[S.OVER] || !!state[S.PENDING_FACES]),
  );
  faceButtons.forEach(
    (b, f) => (b.disabled = value || !(state[S.PENDING_FACES] & (1 << f))),
  );
  $("undo").disabled = value || !state[S.UNDO_COUNT];
  $("new").disabled = value;
  $("gravityMode").disabled = value || !!state[S.PENDING_FACES];
  for (const id of ["bandagedFragments", "randomCubies", "rebuildMode"])
    $(id).disabled = value || !!state[S.PENDING_FACES];
  $("fragmentPerk").disabled = value || !!state[S.PENDING_FACES];
}
function events() {
  return engine.events();
}
async function play(m, fromT = 0) {
  if (lockMode) { $("message").textContent = "Select Resume turns to turn slices again."; return; }
  if (!engine || busy || session?.starting || state[S.PENDING_FACES]) return;
  const before = state.slice();
  if (!engine.game_turn(m)) {
    renderers[0].setState(state);
    invalidate();
    $("message").textContent = "That turn would split a bandaged fragment.";
    return;
  }
  const after = snapshot(),
    trace = events();
  setBusy(true);
  try {
    $("message").textContent =
      `Turning ${moveLabels[m % 15]}${m >= 15 ? "′" : ""}…`;
    await animate(220 * (1 - fromT), (t) =>
      renderers[0].setState(before, {
        kind: "turn",
        move: m,
        t: fromT + (1 - fromT) * t,
      }),
    );
    if (trace.length) await resolveAnimations(before, after, trace, m);
    else
      update(
        `${moveLabels[m % 15]}${m >= 15 ? "′" : ""} · Build ${names[after[S.PIECE]]}.`,
      );
  } finally {
    setBusy(false);
    syncChoices();
    invalidate();
  }
  if (state[S.PENDING_FACES]) faceButtons.find((b) => !b.disabled)?.focus();
}
async function lockBand(cell) {
  if (!engine || busy || !context.lockMode || state[S.OVER] || state[S.PENDING_FACES]) return;
  const before = state.slice();
  engine.game_set_early_lock($("earlyLock").checked);
  if (!engine.game_lock_band(cell)) {
    $("message").textContent = "This white group cannot lock here: its cells must be clear of the stack.";
    return;
  }
  renderers[0].hover = null;
  setBusy(true);
  try { await resolveAnimations(before, snapshot(), events()); }
  finally { setBusy(false); }
  update("White group locked. Your colored piece is unchanged; switch back to turns to continue.");
}
async function holdPiece() {
  if (
    !engine ||
    busy ||
    state[S.OVER] ||
    state[S.PENDING_FACES] ||
    state[S.HOLD_USED]
  )
    return;
  const before = state.slice();
  if (!engine.game_hold()) return;
  const after = snapshot(),
    trace = events();
  setBusy(true);
  try {
    renderers[0].hover = null;
    if (trace.length) await resolveAnimations(before, after, trace);
    else {
      update("Piece held. Build the new target.");
      await animate(180, (t) =>
        renderers[0].setState(after, { kind: "spawn", t }),
      );
      renderers[0].setState(after);
    }
  } finally {
    setBusy(false);
    invalidate();
  }
}
async function choose(face) {
  if (busy || !state[S.PENDING_FACES]) return;
  const before = state.slice();
  if (!engine.game_choose(face)) return;
  renderers[0].preview = 0;
  const after = snapshot(),
    trace = events();
  setBusy(true);
  try {
    await resolveAnimations(before, after, trace);
  } finally {
    setBusy(false);
    syncChoices();
    invalidate();
  }
  ($("classicControls").checked ? $("tab-face") : $("settingsOpen")).focus();
}
function undo() {
  if (busy || session?.starting) return;
  if (engine?.game_undo()) {
    animationController.clearGhost();
    renderers[0].ghost = null;
    renderers[0].preview = 0;
    update("Previous turn restored.");
  }
}
async function newGame() {
  if (busy || session?.starting) return;
  animationController.clearGhost();
  renderers[0].ghost = null;
  renderers[0].preview = 0;
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const gravityMode = +$("gravityMode").value;
  engine.game_init(seed);
  engine.game_set_early_lock($("earlyLock").checked);
  setLockMode(false);
  engine.game_set_gravity(gravityMode);
  engine.game_set_slice_clears(+$("sliceClearMode").value);
  engine.game_set_fragments($("fragmentPerk").checked);
  engine.game_set_modes(
    $("bandagedFragments").checked,
    $("randomCubies").checked,
    +$("rebuildMode").value,
  );
  update();
  setBusy(true);
  try {
    await animate(280, (t) =>
      renderers[0].setState(state, { kind: "spawn", t }),
    );
  } finally {
    renderers.forEach((r) => r.setState(state));
    setBusy(false);
    invalidate();
  }
}
$("undo").onclick = undo;
$("new").onclick = () => {
  if (state[S.UNDO_COUNT] || state[S.PIECES]) $("newDialog").showModal();
  else newGame();
};
$("newDialog").addEventListener("close", () => {
  if ($("newDialog").returnValue === "new") newGame();
});
function setLockMode(enabled) {
  lockMode = enabled && !$("lockBands").hidden && $("earlyLock").checked && $("bandagedFragments").checked;
  $("lockBands").textContent = lockMode ? "Resume turns" : "Lock white pieces";
  $("lockBands").setAttribute("aria-pressed", String(lockMode));
  renderers.forEach(r => { r.hover = null; r.arrowHover = null; r.canvas.style.cursor = lockMode ? "pointer" : ""; });
  invalidate();
}
$("lockBands").onclick = () => {
  if (busy || session?.starting) return;
  setLockMode(!lockMode);
  $("message").textContent = lockMode ? "Click a white bandaged group to lock it. Right-drag to rotate the view." : "Drag a sticker to turn.";
};
$("earlyLock").onchange = () => {
  if (session?.starting || busy) return;
  if (engine) engine.game_set_early_lock($("earlyLock").checked);
  if (!$("earlyLock").checked) setLockMode(false);
  update();
};
$("turnWidth").onclick = () => {
  const wide = !renderers[0]?.wideTurns;
  $("turnWidth").textContent = wide ? "Wide turns" : "Regular turns";
  $("turnWidth").setAttribute("aria-pressed", String(wide));
  renderers.forEach(r => { r.wideTurns = wide; r.refreshTurnHover?.(); });
  invalidate();
};
$("resetView").onclick = () => {
  renderers.forEach((r) => {
    r.yaw = Math.PI - 0.55;
    r.pitch = 0.4;
    r.resetOrientation();
  });
  invalidate();
};
$("xray").onchange = () => {
  renderers[0].xray = $("xray").checked;
  invalidate();
};
document.addEventListener("keydown", (e) => {
  if (
    !engine ||
    busy || session?.starting || $("stateDialog").open ||
    $("gamePage").hidden ||
    $("newDialog").open ||
    $("settingsDialog").open ||
    e.target.matches("input,textarea,select,[contenteditable]")
  )
    return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    undo();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.repeat) return;
  if (e.key.toLowerCase() === "c") {
    e.preventDefault();
    holdPiece();
    return;
  }
  if (state[S.PENDING_FACES]) {
    const f = faceLabels.indexOf(e.key.toUpperCase());
    if (f >= 0) {
      e.preventDefault();
      choose(f);
    }
    return;
  }
  const label = e.altKey ? e.key.toLowerCase() : e.key.toUpperCase();
  let m = moveLabels.indexOf(label);
  if (m >= 0) {
    e.preventDefault();
    play(m + (e.shiftKey ? 15 : 0));
  }
});
let viewTransition = 0;
$("viewMode").onclick = () => {
  if (viewTransition) return;
  const views = document.querySelector(".views"),
    control = renderers[0],
    split = $("combined").checked;
  $("combined").checked = !split;
  $("viewMode").textContent = split ? "Combine cubes" : "Split cubes";
  $("viewMode").setAttribute("aria-pressed", String(split));
  $("viewMode").setAttribute(
    "aria-label",
    split ? "Combine active cube and stack" : "Separate active cube and stack",
  );
  $("xray").closest("label").hidden = !split;
  // Both canvases start at the same camera, scale, and horizontal position.
  // The stack is rendered once, on its own canvas throughout the transition.
  control.combined = false;
  control.setState(control.state, control.animation);
  views.classList.add("view-moving");
  void views.offsetWidth;
  views.classList.toggle("combined", !split);
  const reduced =
    !animations.checked ||
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finish = () => {
    control.combined = !split;
    control.setState(control.state, control.animation);
    views.classList.remove("view-moving");
    viewTransition = 0;
    invalidate();
  };
  if (reduced) {
    views.classList.add("view-instant");
    void views.offsetWidth;
    finish();
    requestAnimationFrame(() => views.classList.remove("view-instant"));
    return;
  }
  const start = performance.now();
  viewTransition = 1;
  const frame = (now) => {
    renderers.forEach((r) => r.draw());
    if (now - start < 420) viewTransition = requestAnimationFrame(frame);
    else finish();
  };
  viewTransition = requestAnimationFrame(frame);
};
const context = {
  get lockMode() { return lockMode && $("earlyLock").checked && $("bandagedFragments").checked; },
  lockBand,
  get state() {
    return state;
  },
  get busy() {
    return busy || !!session?.starting;
  },
  get engine() {
    return engine;
  },
  get renderers() {
    return renderers;
  },
  get animations() {
    return animations;
  },
  get layerOrder() {
    return layerOrder;
  },
  get attachedNodes() {
    return attachedNodes;
  },
  setBusy,
  play,
  animate,
  update,
  invalidateMesh() {
    meshRevision = -1;
  },
  invalidate,
};
const animationController = createAnimations(context);
function animate(...args) {
  return animationController.animate(...args);
}
function resolveAnimations(...args) {
  return animationController.resolveAnimations(...args);
}
const { overlayButtons, attachedNodes, layoutCubeControls } =
  createMoveButtons(context);
function syncOverlayControls() {
  if (!state) return;
  const hasBands = state.slice(S.BAND_IDS, S.BAND_IDS + 27).some(Boolean);
  $("lockBands").hidden = !hasBands || !$("earlyLock").checked || !state[S.BANDAGED];
  if ($("lockBands").hidden && lockMode) setLockMode(false);
  $("shareState").disabled = busy;
  $("setNextPiece").disabled = busy || !!state[S.OVER] || !!state[S.PENDING_FACES];
  $("lockBands").disabled = $("lockBands").hidden || busy || !!state[S.OVER] || !!state[S.PENDING_FACES] || !$("earlyLock").checked || !state[S.BANDAGED];
  if (!state[S.BANDAGED] && lockMode) setLockMode(false);
  $("holdPiece").disabled =
    busy || !!state[S.OVER] || !!state[S.PENDING_FACES] || !!state[S.HOLD_USED];
  for (const b of overlayButtons) {
    const m = +b.dataset.move,
      win = !!(state[S.WINNING_MOVES] & (1 << m));
    b.disabled = busy || !!state[S.OVER] || !!state[S.PENDING_FACES];
    b.classList.toggle("winning", false);
    b.setAttribute(
      "aria-label",
      `${moveLabels[m % 15]}${m >= 15 ? " prime" : ""}${win ? " — places the current piece" : ""}`,
    );
  }
  const canUndo = !busy && !!state[S.UNDO_COUNT];
  $("stageUndo").disabled = !canUndo;
  $("overUndo").disabled = !canUndo;
  $("gameOver").hidden = busy || !state[S.OVER];
  if (renderers[0]) renderers[0].orbitOnly = !!state[S.OVER];
  $("controlViewport").classList.toggle("topped-out", !!state[S.OVER]);
  $("finalScore").textContent =
    `${state[S.SCORE].toLocaleString()} points · ${state[S.PIECES]} pieces`;
  $("cubeMoves").hidden = !$("showArrows").checked;
  $("sliceMoves").hidden = !$("showArrows").checked;
}
$("showArrows").onchange = () => {
  syncOverlayControls();
  invalidate();
};
$("classicControls").onchange = () => {
  $("legacyControls").hidden = !$("classicControls").checked;
  syncOverlayControls();
  invalidate();
};
$("fragmentPerk").onchange = () => {
  if (!engine || busy || session?.starting) return;
  engine.game_set_fragments($("fragmentPerk").checked);
  engine.game_set_modes(
    $("bandagedFragments").checked,
    $("randomCubies").checked,
    +$("rebuildMode").value,
  );
  update();
};
for (const id of ["bandagedFragments", "randomCubies", "rebuildMode"])
  $(id).onchange = () => {
    if (!engine || busy || session?.starting || state[S.PENDING_FACES]) return;
    engine.game_set_modes(
      $("bandagedFragments").checked,
      $("randomCubies").checked,
      +$("rebuildMode").value,
    );
    update();
  };
$("sliceClearMode").onchange = () => {
  if (!engine || busy || session?.starting) return;
  engine.game_set_slice_clears(+$("sliceClearMode").value);
  update();
};
$("gravityMode").onchange = () => {
  if (!engine || busy || session?.starting) return;
  engine.game_set_gravity(+$("gravityMode").value);
  update();
};
$("settingsOpen").onclick = () => $("settingsDialog").showModal();
$("settingsClose").onclick = () => $("settingsDialog").close();
const requestNew = $("new").onclick;
$("new").onclick = () => {
  $("settingsDialog").close();
  requestNew();
};
$("stageUndo").onclick = undo;
$("overUndo").onclick = undo;
$("overNew").onclick = newGame;
document.addEventListener("visibilitychange", invalidate);
// Wrap complete revolutions without changing the visible orientation.

function wrapOrbitAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
function orbitCamera(dx, dy) {
  const free = $("freeOrbit").checked;
  for (const r of renderers) {
    if (free) {
      r.orbit(dx, dy);
      continue;
    }
    r.yaw = wrapOrbitAngle(r.yaw + dx);
    const pitch = r.pitch + dy;
    r.pitch = Math.max(-1.4, Math.min(1.4, pitch));
    r.resetOrientation();
  }
  invalidate();
}
$("freeOrbit").addEventListener("change", () => {
  if (!$("freeOrbit").checked)
    for (const r of renderers) {
      r.pitch = Math.max(-1.4, Math.min(1.4, wrapOrbitAngle(r.pitch)));
      r.resetOrientation();
    }
  invalidate();
});
configureRenderer(context);
initializeSettings(context);
selectMode("face");
async function start() {
  try {
    engine = await createEngine();
    const onOrbit = orbitCamera;
    renderers = [
      new Renderer($("control"), $("controlLabels"), {
        onOrbit,
        onLayout: layoutCubeControls,
      }),
      new Renderer($("stack"), $("stackLabels"), { stack: true, onOrbit }),
    ];
    syncDisplaySettings();
    renderers[0].combined = $("combined").checked;
    $("xray").closest("label").hidden = $("combined").checked;
    const stage = document.querySelector(".views");
    const resizeStage = () => {
      const rect = stage.getBoundingClientRect();
      stage.classList.toggle("vertical", rect.height > rect.width);
      invalidate();
    };
    const stageObserver = new ResizeObserver(resizeStage);
    stageObserver.observe(stage);
    resizeStage();
    const observer = new ResizeObserver(invalidate);
    renderers.forEach((r) => observer.observe(r.canvas));
    $("new").disabled = false;
    $("engineStatus").textContent = "Ready";
    await newGame();
    if (!$("gamePage").hidden) session.setup();
  } catch (error) {
    $("message").textContent = error.message;
    $("engineStatus").textContent = "Unable to start";
    console.error(error);
  }
}
session = initializeSession({engine:()=>engine, snapshot, update, newGame,
  clearAnimations:()=>{ animationController.clearGhost(); renderers[0].ghost=null; renderers[0].preview=0; setLockMode(false); meshRevision=-1; },
  isBusy:()=>busy});
start();

export { context };

// Keep game state and explorer settings alive while switching applications.
function selectApplication(explorer) {
  document.querySelector("main").classList.toggle("explorer-active", explorer);
  $("gamePage").hidden = explorer;
  $("explorerPage").hidden = !explorer;
  for (const [id, selected] of [
    ["gameTab", !explorer],
    ["explorerTab", explorer],
  ]) {
    $(id).setAttribute("aria-selected", String(selected));
    $(id).tabIndex = selected ? 0 : -1;
  }
  if (explorer && !$("explorer").explorerReady)
    mountExplorer($("explorer")).catch(console.error);
  if (!explorer) {
    invalidate();
    if (engine && !busy && !session.started && !session.starting) session.setup();
  }
}
$("gameTab").onclick = () => selectApplication(false);
$("explorerTab").onclick = () => selectApplication(true);
for (const id of ["gameTab", "explorerTab"]) {
  $(id).addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const explorer =
      event.key === "End" || (event.key !== "Home" && id === "gameTab");
    selectApplication(explorer);
    $(explorer ? "explorerTab" : "gameTab").focus();
  });
}

if (globalThis.location?.hash === "#packing") selectApplication(true);
