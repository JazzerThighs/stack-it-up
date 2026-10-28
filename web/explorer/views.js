import { PackingCube } from "./cube-view.js";
import {
  packingCells,
  parseMoves,
  turn,
  practicePair,
  matchesTarget,
  randomFamilyPair,
} from "./model.js";


export function createExplorerViews({
  root = document,
  meshGenerator,
  getPackings,
  getChoices,
  getFamilies,
}) {
  const $ = id => root.getElementById(id);
  const cubes = new Map();
  let selected,
    targetCells,
    playback = 0,
    sourcePacking,
    targetPacking;
  const get = (id, options = {}) => {
    if (!cubes.has(id)) {
      const view = new PackingCube($(id), options);
      view.fitScale = 6.0;
      view.appearance = $("pieceAppearance").value;
      view.meshGenerator = meshGenerator;
      if (id === "solvedCube" || id === "practiceRight") view.opacity=1-Number($("targetTransparency").value)/100;
      view.connected = (id === "solvedCube" || id === "practiceRight") && $("targetComposite").checked;
      cubes.set(id, view);
    }
    return cubes.get(id);
  };
  function refreshPieces() {
    for (const id of ["solvedCube", "practiceRight"]) {
      const cube=cubes.get(id); if (!cube) continue;
      cube.connected=$("targetComposite").checked;
      cube.opacity=1-Number($("targetTransparency").value)/100;
      cube.setState(cube.cells);
    }
    $("transparencyValue").textContent=$("targetTransparency").value+"%";
  }
  function showCube(id, packing, colors, moves = []) {
    if (id === "scrambledCube") {
      playback++;
      $("playSolution").disabled = false;
    }
    const cube = get(id, { readOnly: id === "solvedCube" });
    if (id === "solvedCube") cube.opacity=1-Number($("targetTransparency").value)/100;
    const cells = packingCells(packing, colors);
    cube.setCells(
      parseMoves(moves).reduce((state, move) => turn(state, move), cells),
    );
  }
  function showPieces(packing, colors) {
    selected = packing;
    if (!$("practiceA").value) $("practiceA").value = packing.lineNumber;
  }
  function hide(id) {
    const cube = cubes.get(id);
    if (cube) {
      cube.destroy();
      cubes.delete(id);
    }
    if (id === "scrambledCube") playback++;

  }
  $("pieceAppearance").addEventListener("change", () => {
    for (const cube of cubes.values()) {
      cube.appearance = $("pieceAppearance").value;
      cube.setState(cube.cells);
    }
  });
  $("targetComposite").addEventListener("change", refreshPieces);
  $("targetTransparency").addEventListener("input", refreshPieces);
  $("playSolution").onclick = async () => {
    const cube = cubes.get("scrambledCube");
    if (!cube || cube.busy) return;
    const token = ++playback,
      generation = cube.generation;
    $("playSolution").disabled = true;
    // Reverse the actual current history, then the initial scramble. A reset
    // restores the original scrambled state, so its solution remains valid.
    const undoMoves = cube.history
      .map((h) => h.move)
      .reverse()
      .map((m) => (m + 15) % 30);
    const initialMoves = parseMoves(
      $("scrambleText").textContent.split(/\s+/).filter(Boolean),
    );
    const solution = [
      ...undoMoves,
      ...initialMoves.reverse().map((m) => (m + 15) % 30),
    ];
    cube.orbitOnly = true;
    try {
      for (const move of solution) {
        if (token !== playback || generation !== cube.generation || !cube.isVisible()) break;
        cube.orbitOnly = false;
        const step = cube.play(move);
        cube.orbitOnly = true;
        await step;
      }
    } finally {
      cube.orbitOnly = false;
      if (token === playback) $("playSolution").disabled = false;
    }
  };
  function updatePractice() {
    const cube = cubes.get("practiceLeft");
    if (!cube || !targetCells) return;
    const match = matchesTarget(cube.cells, targetCells);
    $("practiceProgress").textContent = match
      ? "Target matched!"
      : `${cube.history.length} turns · Keep going`;
    $("practiceProgress").classList.toggle("matched", match);
  }
  function loadPair(a, b) {
    if (!a || !b) {
      $("practiceStatus").textContent =
        "Enter two valid source line numbers from the packing database.";
      return;
    }
    sourcePacking = a;
    targetPacking = b;
    const pair = practicePair(a, b);
    targetCells = pair.right;
    $("practiceA").value = a.lineNumber;
    $("practiceB").value = b.lineNumber;
    const family = getFamilies().get(a.lineNumber)?.family.id,
      same =
        family != null && family === getFamilies().get(b.lineNumber)?.family.id;
    $("practiceStatus").textContent = pair.compatible
      ? `Reachable pair${same ? ` · Family ${family}` : ""}. Colors follow physical pieces; their letter shapes may change.`
      : "Comparison only: these packings do not share the same physical piece and center configuration. A turn sequence is not guaranteed.";
    $("practiceLeftTitle").textContent = `Start · line ${a.lineNumber}`;
    $("practiceRightTitle").textContent = `Target · line ${b.lineNumber}`;
    get("practiceLeft", { onChange: updatePractice }).setCells(pair.left);
    get("practiceRight", { readOnly: true }).setCells(pair.right);
    updatePractice();
  }
  $("practiceLoad").onsubmit = (e) => {
    e.preventDefault();
    const packings = getPackings();
    loadPair(
      packings.find((p) => p.lineNumber === Number($("practiceA").value)),
      packings.find((p) => p.lineNumber === Number($("practiceB").value)),
    );
  };
  $("practiceRandom").onclick = () => {
    const packings = getPackings(),
      pair = randomFamilyPair(
        getChoices().map((i) => packings[i]),
        getFamilies(),
      );
    if (pair) loadPair(...pair);
    else
      $("practiceStatus").textContent =
        "No family has two matching packings. Broaden the explorer filters and try again.";
  };
  $("practiceUseSelected").onclick = () => {
    if (selected) $("practiceA").value = selected.lineNumber;
  };
  $("practiceUseTarget").onclick = () => {
    if (selected) $("practiceB").value = selected.lineNumber;
  };
  $("practiceSwap").onclick = () => {
    if (sourcePacking && targetPacking) loadPair(targetPacking, sourcePacking);
  };
  $("practiceMode").onchange = () => {
    const active = $("practiceMode").checked;
    $("practicePanel").hidden = !active;
    $("cubeLayout").hidden = active;
    $("viewTabs").style.display = active ? "none" : "";
    if (active && !sourcePacking) {
      $("practiceA").value = selected?.lineNumber || "";
      $("practiceRandom").onclick();
    }
    for (const cube of cubes.values()) cube.invalidate();
  };
  return { showCube, showPieces, hide };
}
