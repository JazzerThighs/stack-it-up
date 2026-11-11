import {openSettingsPage} from './settings-pages.js';
import {refreshGameplay,validateGameplay} from './gameplay-settings.js';
import {refreshSettingsAvailability} from './settings-availability.js';
export function initializeSession({model, snapshot, update, newGame, clearAnimations, isBusy}) {
  const $ = id => document.getElementById(id);
  const rules = $("gameplaySettings"), home = $("gameplayHome");
  function restoreRules() { home.append(rules); model.leaveSetup(); refreshSettingsAvailability(document, snapshot()); }
  function setup() {
    if (!model.beginSetup()) return;
    $("setupCancel").hidden = !model.started;
    $("setupRules").append(rules); rules.open = true;
    for (const el of rules.querySelectorAll("input,select")) el.disabled = false;
    refreshSettingsAvailability(document);
    $("debugCurrent").value="0";$("debugHeld").value="0";
    refreshGameplay(document,{starting:true});
    $("setupDialog").showModal();
    openSettingsPage("gameplaySettings",true);
  }
  $("setupDialog").addEventListener("cancel", e => { e.preventDefault(); if(model.started) $("setupCancel").onclick(); });
  $("setupDialog").addEventListener("close", restoreRules);
  $("setupCancel").onclick = () => { $("setupDialog").close(); restoreRules(); update(); };
  $("setupStart").onclick = async () => {
    if(!Array.from({length:11},(_,i)=>$("poolPiece"+(i+1))).some(el=>el.checked)) {
      $("piecePoolNote").textContent="Select at least one queue piece.";openSettingsPage("piecePoolOptions",true);return;
    }
    validateGameplay(document);
    $("setupDialog").close(); restoreRules(); model.resume();
    await newGame();
  };
  $("new").onclick = () => { $("settingsDialog").close(); setup(); };
  $("overNew").onclick = () => {if($("topOutNewGame").checked)setup();};
  const syncTheory = () => { $("nextPieceControls").hidden = !$("chooseNext").checked || !model.canChooseNext; };
  $("chooseNext").onchange = syncTheory;
  $("setNextPiece").onclick = () => {
    if (model.setNext(Number($("nextPiece").value))) update("Next queued piece changed. Undo restores it.");
  };
  $("shareState").onclick = () => {
    if (isBusy()) return;
    const text=model.share($("chooseNext").checked);if(text===null)return;
    $("stateText").value=text;
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
      const data=model.load($("stateText").value);if(!data)return;
      clearAnimations(); model.resume();
      $("chooseNext").checked = data.chooseNext === true; syncTheory();
      update("Shared state loaded. Undo returns to your previous puzzle.");
      $("stateDialog").close();
    } catch (e) { $("stateStatus").textContent = e.message; }
  };
  return {setup, resume(chooseNext=false) { model.resume(); $('chooseNext').checked=chooseNext; syncTheory(); }, get starting() {return model.starting;}, get started() {return model.started;}, syncTheory};
}
