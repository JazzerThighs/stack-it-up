import {solidStyleKey} from '../render/identity-solids.js';
import {visualSettings} from '../render/visual-settings.js';
import {createFamilyExplorer} from "./family-controller.js";
import {initializePaletteControls} from '../ui/palette-controls.js';
import {subscribePalette} from '../render/palette.js';
import {initializeVisualControls} from "../ui/visual-controls.js";
import { PackingCube } from "./cube-view.js";
import {
  packingCells,
  parseMoves,
  turn,
  practicePair,
  matchesTarget,
} from "./model.js";


export function createExplorerViews({
  root = document,
  meshGenerator,
  data,
}) {
  const $ = id => root.getElementById(id);
  const cubes = new Map();
  initializeVisualControls(root,()=>{
    for(const cube of cubes.values()) {
      if(cube.solidStyle!==solidStyleKey()){cube.solidStyle=solidStyleKey();cube.explorationGray=!!visualSettings.solidGray;cube.setState(cube.cells,cube.currentAnimation);}
      cube.invalidate();
    }
  });
  initializePaletteControls(root);
  subscribePalette(() => {
    for (const cube of cubes.values()) cube.setState(cube.cells, cube.currentAnimation);
  });
  let selected,
    targetCells,
    playback = 0,
    sourcePacking,
    targetPacking;
  const get = (id, options = {}) => {
    if (!cubes.has(id)) {
      const view = new PackingCube($(id), options);
      view.fitScale = 6.0;
      view.appearance = $("pieceAppearance").value || "jelly";
      view.perspective = $("explorerCamera").value !== "orthographic";
      view.meshGenerator = meshGenerator;
      view.explorationGray=!!visualSettings.solidGray;
      view.solidStyle=solidStyleKey();
      view.opacity=1-Number($("targetTransparency").value)/100;
      view.connected = (id === "solvedCube" || id === "practiceRight") && $("targetComposite").checked;
      cubes.set(id, view);
    }
    return cubes.get(id);
  };
  function refreshTransparency() {
    for(const cube of cubes.values()) {
      cube.opacity=1-Number($("targetTransparency").value)/100;
      cube.invalidate();
    }
    $("transparencyValue").textContent=$("targetTransparency").value+"%";
  }
  function refreshPieces() {
    for(const id of ["solvedCube","practiceRight"]) {
      const cube=cubes.get(id);if(!cube)continue;
      cube.connected=$("targetComposite").checked;
      cube.setState(cube.cells,cube.currentAnimation);
    }
    refreshTransparency();
  }
  function showCube(id, packing, colors, moves = []) {
    if (id === "scrambledCube") {
      playback++;
      $("playSolution").disabled = false;
    }
    const cube = get(id, { readOnly: id === "solvedCube" });
    cube.opacity=1-Number($("targetTransparency").value)/100;
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
      cube.setState(cube.cells,cube.currentAnimation);
    }
  });
  $("explorerCamera").addEventListener("change", () => {
    for (const cube of cubes.values()) {
      cube.perspective = $("explorerCamera").value !== "orthographic";
      cube.invalidate();
    }
  });
  $("targetComposite").addEventListener("change", refreshPieces);
  $("targetTransparency").addEventListener("input", refreshTransparency);
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
    const family=a.familyId, same=family!=null&&family===b.familyId;
    $("practiceStatus").textContent = pair.compatible
      ? `Reachable pair${same ? ` · Family ${family}` : ""}. Colors follow physical pieces; their letter shapes may change.`
      : "Comparison only: these packings do not share the same physical piece and center configuration. A turn sequence is not guaranteed.";
    $("practiceLeftTitle").textContent = `Start · line ${a.lineNumber}`;
    $("practiceRightTitle").textContent = `Target · line ${b.lineNumber}`;
    get("practiceLeft", { onChange: updatePractice }).setCells(pair.left);
    get("practiceRight", { readOnly: true }).setCells(pair.right);
    updatePractice();
  }
  $("practiceLoad").onsubmit = async e => {
    e.preventDefault();
    try {loadPair(await data.record(+$("practiceA").value),await data.record(+$("practiceB").value));await syncSelection();}
    catch(e){$('practiceStatus').textContent=e.message;}
  };
  $("practiceRandom").onclick = async () => {
    try {const pair=await data.randomPair();if(pair){loadPair(...pair);await syncSelection();}else $('practiceStatus').textContent='No family has two matching packings. Broaden the filters.';}
    catch(e){$('practiceStatus').textContent=e.message;}
  };
  $("practiceSwap").onclick = async () => {
    if (sourcePacking && targetPacking) {loadPair(targetPacking, sourcePacking);await syncSelection();}
  };
  const familyExplorer=createFamilyExplorer({$,get,getSelected:()=>selected,data});
  async function syncSelection() {return data.selectionChanged?.($('navigationTarget').value==='target'?targetPacking:sourcePacking);}
  $('navigationTarget').onchange=syncSelection;
  async function navigate(p) {
    if($('familyExploreMode').checked)familyExplorer.load(p);
    else if($('practiceMode').checked) {
      if($('navigationTarget').value==='target')loadPair(sourcePacking||p,p);
      else loadPair(p,targetPacking||p);
    }
  }
  async function updateMode() {
    const family=$("familyExploreMode").checked, practice=$("practiceMode").checked;
    $("familyExplorePanel").hidden=!family;
    $("practicePanel").hidden=!practice;
    $("cubeLayout").hidden=family || practice;
    $('packingNavigation').hidden=false;
    $('practiceNavigation').hidden=!practice;
    $('navigationTargetLabel').hidden=!practice;
    $("viewTabs").style.display=family || practice ? "none" : "";
    if(family) await familyExplorer.enter();
    if(practice && !sourcePacking) {
      $("practiceA").value=selected?.lineNumber || "";
      loadPair(selected,selected);
    }
    if(practice)await syncSelection();
    for(const cube of cubes.values()) cube.invalidate();
  }
  $("familyExploreMode").onchange=()=>{
    if($("familyExploreMode").checked) $("practiceMode").checked=false;
    return updateMode();
  };
  $("practiceMode").onchange=()=>{
    if($("practiceMode").checked) $("familyExploreMode").checked=false;
    return updateMode();
  };
  return { showCube, showPieces, hide, navigate, startMode:updateMode, refreshFamily:()=>familyExplorer.refresh?.() };
}
