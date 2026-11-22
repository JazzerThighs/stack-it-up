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
  $("viewMode").textContent = split ? "Combine cubes" : "Split Stack";
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
  let revision=0;
  const screens=[['gameTab','game','Game'],['explorerTab','explorer','Explorer'],['solverTab','solver','Solver']];
  async function selectApplication(value) {
    const screen=typeof value==='boolean'?(value?'explorer':'game'):value;
    const token=++revision,explorer=screen!=='game';
    document.querySelector('main').classList.toggle('explorer-active',explorer);
    $('gamePage').hidden=explorer;$('explorerPage').hidden=!explorer;
    $('explorerPage').setAttribute('aria-labelledby',screen==='solver'?'solverTab':'explorerTab');
    for(const [id,name]of screens){const button=$(id);button.setAttribute('aria-current',name===screen?'page':'false');button.setAttribute('aria-selected',String(name===screen));button.tabIndex=0;}
    $('screenSelect').textContent=screens.find(s=>s[1]===screen)[2]+' ▾';
    $('screenMenu').hidden=true;$('screenSelect').setAttribute('aria-expanded','false');
    if(!explorer){invalidate();setupGame();return;}
    try {
      await ($('explorer').explorerReady||mountExplorer($('explorer'),packingProgress));
      if(token!==revision)return;
      await $('explorer').selectScreen?.(screen);
      if(token===revision)startupCheck('explorer','Packing data, controls and cube views ready',true);
    }catch(error){if(token===revision)startupError(error);}
  }
  for(const [id,screen]of screens){
    $(id).onclick=()=>selectApplication(screen);
    $(id).addEventListener('keydown',event=>{
      if(event.key==='Escape'){$('screenMenu').hidden=true;$('screenSelect').setAttribute('aria-expanded','false');$('screenSelect').focus();return;}
      if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
      event.preventDefault();const i=screens.findIndex(s=>s[0]===id),next=event.key==='Home'?0:event.key==='End'?2:(i+(event.key==='ArrowDown'?1:2))%3;
      $(screens[next][0]).focus();
    });
  }
  $('screenSelect').onclick=()=>{const open=$('screenMenu').hidden;$('screenMenu').hidden=!open;$('screenSelect').setAttribute('aria-expanded',String(open));};
  $('screenSelect').addEventListener('keydown',event=>{if(event.key==='Escape'){$('screenMenu').hidden=true;$('screenSelect').setAttribute('aria-expanded','false');}
    if(event.key==='ArrowDown'){event.preventDefault();$('screenMenu').hidden=false;$('screenSelect').setAttribute('aria-expanded','true');$('gameTab').focus();}});
  document.addEventListener('click',event=>{if(!event.target.closest?.('.screen-picker')){$('screenMenu').hidden=true;$('screenSelect').setAttribute('aria-expanded','false');}});
  return selectApplication;
}
