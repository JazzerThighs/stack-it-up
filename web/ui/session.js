export function initializeSession({engine, snapshot, update, newGame, clearAnimations, isBusy}) {
  const $ = id => document.getElementById(id);
  let starting = false, started = false;
  const rules = $("gameplaySettings"), home = $("gameplayHome");
  function restoreRules() { home.append(rules); starting = false; }
  function setup() {
    if (isBusy()) return;
    starting = true;
    $("setupCancel").hidden = !started;
    $("setupRules").append(rules); rules.open = true;
    for (const el of rules.querySelectorAll("input,select")) el.disabled = false;
    $("setupDialog").showModal();
  }
  $("setupDialog").addEventListener("cancel", e => { if (!started) e.preventDefault(); });
  $("setupDialog").addEventListener("close", restoreRules);
  $("setupCancel").onclick = () => { $("setupDialog").close(); restoreRules(); update(); };
  $("setupStart").onclick = async () => {
    $("setupDialog").close(); restoreRules(); started = true;
    await newGame();
  };
  $("new").onclick = () => { $("settingsDialog").close(); setup(); };
  $("overNew").onclick = setup;
  const syncTheory = () => { $("nextPieceControls").hidden = !$("chooseNext").checked; };
  $("chooseNext").onchange = syncTheory;
  $("setNextPiece").onclick = () => {
    if (!starting && !isBusy() && engine().game_set_next(Number($("nextPiece").value))) update("Next queued piece changed. Undo restores it.");
  };
  $("shareState").onclick = () => {
    if (isBusy()) return;
    const e = engine(), s = snapshot();
    const hex = v => (v >>> 0).toString(16).padStart(7, "0");
    const masks = {active:hex(s[54]), floating:hex(s[159]), rebuilding:hex(s[169]), stack:[]};
    for (let color=1;color<=6;color++) masks.stack.push(hex(s.slice(0,27).reduce((m,c,i)=>c===color ? m | (1<<i) : m,0)));
    $("stateText").value = JSON.stringify({format:"StackItUp-state", version:1, dimensions:[3,3,3], masks, words:e.exportState().map(hex), chooseNext:$("chooseNext").checked});
    $("stateStatus").textContent = "Copy this complete state, or paste a shared state to load. Loading can be undone.";
    $("stateDialog").showModal();
  };
  $("stateClose").onclick = () => $("stateDialog").close();
  $("copyState").onclick = async () => {
    try { await navigator.clipboard.writeText($("stateText").value); $("stateStatus").textContent = "State copied."; }
    catch { $("stateText").focus(); $("stateText").select(); $("stateStatus").textContent = "Clipboard unavailable. The state is selected; copy it manually."; }
  };
  $("loadState").onclick = () => {
    if (isBusy()) return;
    try {
      const text = $("stateText").value;
      if (text.length > 16000) throw Error("State is too large.");
      const data = JSON.parse(text);
      if (data.format !== "StackItUp-state" || data.version !== 1 || JSON.stringify(data.dimensions) !== "[3,3,3]" || !Array.isArray(data.words) || !data.words.every(v=>typeof v === "string" && /^[0-9a-f]{1,8}$/i.test(v))) throw Error("Unsupported state format or dimensions.");
      if (!engine().importState(data.words.map(v=>parseInt(v,16)))) throw Error("Invalid state. Your current game is unchanged.");
      clearAnimations(); started = true;
      $("chooseNext").checked = data.chooseNext === true; syncTheory();
      update("Shared state loaded. Undo returns to your previous puzzle.");
      $("stateDialog").close();
    } catch (e) { $("stateStatus").textContent = e.message; }
  };
  return {setup, get starting() {return starting;}, get started() {return started;}, syncTheory};
}
