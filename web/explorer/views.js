import {assemblyUsesSolids} from '../render/assembly.js';
import {displaySettings,initializeDisplayControls,viewPreferences,setDisplaySetting} from '../ui/display-settings.js';
import {jellyStyleKey} from '../render/visual-settings.js';
import {bindControlSettings} from '../input/control-settings.js';
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
  function display(view,id){const [pieces,size]=viewPreferences[id]||['practiceTargetPieces','practiceTargetSize'];view.displayId=id;view.assembly=view.lockedAssembly||displaySettings[pieces];view.individualPieces=view.assembly==='cubies';view.explorationSolids=assemblyUsesSolids(view.assembly);view.connected=true;view.detectionFilters=data.filters?.()||{};view.zoomScale=displaySettings[size]/100;}
  initializeDisplayControls(root,key=>{for(const [id,cube]of cubes){display(cube,id);if(key.endsWith('Pieces'))cube.setState(cube.cells,cube.currentAnimation);cube.invalidate();}});
  data.refreshDetection=()=>{for(const cube of cubes.values()){cube.detectionFilters=data.filters?.()||{};cube.setState(cube.cells,cube.currentAnimation);cube.onChange?.(cube);}};
  let cornerO=jellyStyleKey();
  initializeVisualControls(root,()=>{
    if(cornerO!==jellyStyleKey()){cornerO=jellyStyleKey();for(const cube of cubes.values())cube.setState(cube.cells,cube.currentAnimation);}
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
  let practiceRun=0,practiceBusy=false,practiceWorker=null,cancelJob=null,pairCompatible=false;
  function cancelPractice(){
    practiceRun++;practiceWorker?.terminate();practiceWorker=null;cancelJob?.();cancelJob=null;practiceBusy=false;
    const cube=cubes.get('practiceLeft');if(cube){cube.generation++;cube.busy=false;cube.orbitOnly=false;cube.playbackMs=null;cube.setState(cube.cells);}
    $('practiceDemonstrate').textContent='Demonstrate path';
  }
  function findPracticePath(source,target){
    if(typeof Worker==='undefined')return import('./practice-path.js').then(m=>m.planPracticePath(source,target));
    return new Promise((resolve,reject)=>{
      practiceWorker=new Worker(new URL('./practice-worker.js',import.meta.url),{type:'module'});
      cancelJob=()=>reject(Error('Playback cancelled'));
      practiceWorker.onmessage=({data})=>{practiceWorker?.terminate();practiceWorker=null;cancelJob=null;data.error?reject(Error(data.error)):resolve(data.moves);};
      practiceWorker.onerror=()=>{practiceWorker?.terminate();practiceWorker=null;cancelJob=null;reject(Error('Could not construct the practice path'));};
      practiceWorker.postMessage({source,target});
    });
  }
  const get = (id, options = {}) => {
    if (!cubes.has(id)) {
      const view = new PackingCube($(id), options);
      view.fitScale = id==='practiceLeft'||id==='practiceRight'?5.2:6.0;
      view.appearance = $("pieceAppearance").value || "jelly";
      view.modelShape = $("modelShape").value || "angular";
      view.perspective = $("explorerCamera").value !== "orthographic";
      view.meshGenerator = meshGenerator;
      view.explorationGray=!!visualSettings.solidGray;
      view.solidStyle=solidStyleKey();
      view.opacity=1-Number($("targetTransparency").value)/100;
      view.connected = (id === "solvedCube" || id === "practiceRight") && $("targetComposite").checked;
      display(view,id);
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
    setDisplaySetting('practiceTargetPieces',$('targetComposite').checked?'whole':'cubies');
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
  for(const id of ["pieceAppearance","modelShape"]) $(id).addEventListener("change", () => {
    for (const cube of cubes.values()) {
      cube.appearance = $("pieceAppearance").value;
      cube.modelShape = $("modelShape").value || "angular";
      display(cube,cube.displayId);
      cube.setState(cube.cells,cube.currentAnimation);
    }
  });
  bindControlSettings(root,()=>{for(const cube of cubes.values())cube.syncControls();},{explorer:true});
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
    $('practiceDemonstrate').disabled=!pairCompatible&&!practiceBusy;
    $('practiceScramble').disabled=practiceBusy||!match;
    $('practiceScramble').title=match?'Scramble the Start cube; keep the Target unchanged.':'Match the target before generating a fresh scramble.';
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
    cancelPractice();
    sourcePacking = a;
    targetPacking = b;
    const pair = practicePair(data.presentation(a).packing, data.presentation(b).packing);
    pairCompatible=pair.compatible;
    targetCells = pair.right;
    $("practiceA").value = a.lineNumber;
    $("practiceB").value = b.lineNumber;
    const family=a.familyId, same=family!=null&&family===b.familyId;
    $("practiceStatus").textContent = pair.compatible
      ? `Compatible pair${same ? ` · Family ${family}` : ""}. Colors follow physical pieces; their letter shapes may change.`
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
  $('practiceScramble').onclick=async()=>{
    const cube=cubes.get('practiceLeft');if(!cube||cube.busy||!matchesTarget(cube.cells,targetCells))return;
    cancelPractice();cube.setCells(targetCells);const token=practiceRun;practiceBusy=true;cube.playbackMs=55;
    try{let last=-1;for(let i=0;i<20;i++){let move;do{move=Math.floor(Math.random()*30);}while(move%15===last);last=move%15;if(token!==practiceRun)break;cube.orbitOnly=false;const task=cube.play(move);cube.orbitOnly=true;await task;}}
    finally{if(token===practiceRun){practiceBusy=false;cube.orbitOnly=false;cube.playbackMs=null;updatePractice();}}
  };
  $('practiceDemonstrate').onclick=async()=>{
    if(practiceBusy){cancelPractice();updatePractice();return;}
    const cube=cubes.get('practiceLeft');if(!cube||cube.busy||!pairCompatible)return;
    await selectPracticeView('start');const token=++practiceRun;practiceBusy=true;cube.orbitOnly=true;
    $('practiceDemonstrate').textContent='Stop demonstration';$('practiceScramble').disabled=true;
    $('practiceStatus').textContent='Constructing and verifying a legal path...';
    try{
      const moves=await findPracticePath(cube.cells.map(c=>c.piece),targetCells.map(c=>c.piece));if(token!==practiceRun)return;
      $('practiceStatus').textContent=`Verified path: ${moves.length} quarter-turns. Physical piece identities are preserved.`;cube.playbackMs=45;
      for(let i=0;i<moves.length;i++){
        if(token!==practiceRun||!$('practiceMode').checked)break;
        cube.orbitOnly=false;const task=cube.play(moves[i]);cube.orbitOnly=true;await task;
        $('practiceProgress').textContent=`Demonstrating ${i+1} / ${moves.length}`;
      }
    }catch(error){if(token===practiceRun)$('practiceStatus').textContent=error.message;}
    finally{if(token===practiceRun){practiceBusy=false;cube.orbitOnly=false;cube.playbackMs=null;$('practiceDemonstrate').textContent='Demonstrate path';updatePractice();}}
  };
  const familyExplorer=createFamilyExplorer({$,get,getSelected:()=>selected,data});
  async function syncSelection() {return data.selectionChanged?.($('navigationTarget').value==='target'?targetPacking:sourcePacking);}
  async function selectPracticeView(value) {
    $('navigationTarget').value=value;
    $('practicePanel').dataset.active=value;
    $('practiceViewStart').setAttribute('aria-pressed',String(value==='start'));
    $('practiceViewTarget').setAttribute('aria-pressed',String(value==='target'));
    for(const id of ['practiceLeft','practiceRight'])cubes.get(id)?.invalidate();
    await syncSelection();
  }
  $('navigationTarget').onchange=()=>selectPracticeView($('navigationTarget').value);
  $('practiceViewStart').onclick=()=>selectPracticeView('start');
  $('practiceViewTarget').onclick=()=>selectPracticeView('target');
  async function navigate(p) {
    if($('familyExploreMode').checked)await familyExplorer.load(p);
    else if($('practiceMode').checked) {
      if($('navigationTarget').value==='target')loadPair(sourcePacking||p,p);
      else loadPair(p,targetPacking||p);
    }
  }
  async function updateMode() {
    const family=$("familyExploreMode").checked, practice=$("practiceMode").checked;
    if(!practice&&practiceBusy)cancelPractice();
    if(!family)familyExplorer.leave?.();
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
    if(practice)await selectPracticeView($('navigationTarget').value==='target'?'target':'start');
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
  return { showCube, showPieces, hide, navigate, refreshColors(){
    familyExplorer.refreshColors();
    if(sourcePacking&&targetPacking) {
      const pair=practicePair(data.presentation(sourcePacking).packing,data.presentation(targetPacking).packing);
      const recolor=(cells,reference)=>{
        const ids=new Map(reference.filter(c=>c.piece>=0).map(c=>[c.piece,c.color]));
        return cells.map(c=>c.piece<0?c:Object.defineProperties({}, {...Object.getOwnPropertyDescriptors(c),color:{value:ids.get(c.piece),writable:true,enumerable:true,configurable:true}}));
      };
      for(const [id,reference]of [['practiceLeft',pair.left],['practiceRight',pair.right]]) {
        const cube=cubes.get(id);if(!cube)continue;
        cube.cells=recolor(cube.cells,reference);cube.initial=recolor(cube.initial,reference);
        for(const h of cube.history)h.cells=recolor(h.cells,reference);
        cube.setState(cube.cells,cube.currentAnimation);
      }
      targetCells=cubes.get('practiceRight').cells;updatePractice();
    }
  }, startMode:updateMode, refreshFamily:()=>familyExplorer.refresh?.() };
}
