// DOM adapters for game split animation and application tabs. Session state stays alive.
export function bindGameViewSwitching({$,getRenderers,animations,refreshSettings,invalidate,syncFaceMapLayout}) {
let viewTransition = 0;
$("viewMode").onclick = () => {
  if (viewTransition) return;
  if ($("stageFaceMap").checked) { $("stageFaceMap").checked=false; syncFaceMapLayout(); return; }
  const views = document.querySelector(".views"),
    control = getRenderers()[0],
    split = $("combined").checked;
  $("combined").checked = !split;
  $("viewMode").textContent = split ? "Combine cubes" : "Split cubes";
  $("viewMode").setAttribute("aria-pressed", String(split));
  $("viewMode").setAttribute(
    "aria-label",
    split ? "Combine active cube and stack" : "Separate active cube and stack",
  );
  refreshSettings();
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
    control.combined = $("stageFaceMap").checked || !split;
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
    getRenderers().forEach((r) => r.draw());
    if (now - start < 420) viewTransition = requestAnimationFrame(frame);
    else finish();
  };
  viewTransition = requestAnimationFrame(frame);
};
}
export function bindApplicationTabs({$,mountExplorer,packingProgress,startupCheck,startupError,invalidate,setupGame}) {
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
    mountExplorer($("explorer"),packingProgress).then(() => startupCheck('explorer','Packing data, controls and cube views ready',true)).catch(startupError);
  if (!explorer) {
    invalidate();
    setupGame();
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


return selectApplication;
}
