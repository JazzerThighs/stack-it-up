import {openSettingsPage} from './settings-pages.js';

let menu;
// A single modal owns settings for the application. The explorer's real controls
// keep their scoped IDs/listeners in a shadow root inside this modal.
export function initializeSharedSettings({loadExplorer}) {
  const dialog=document.getElementById('settingsDialog');
  const nav=document.createElement('nav');nav.className='settings-contexts';nav.setAttribute('aria-label','Settings scope');
  const game=document.createElement('button'),explorer=document.createElement('button');
  game.type=explorer.type='button';game.textContent='Game & shared';explorer.textContent='Explorer cubes';
  nav.append(game,explorer);dialog.querySelector('.settings-title').after(nav);
  const host=document.createElement('div');host.id='explorerSettingsHost';host.className='shared-explorer-settings';host.hidden=true;dialog.append(host);
  const portal=host.attachShadow({mode:'open'});
  let scope='game',loading;
  function select(next) {
    scope=next;dialog.dataset.settingsScope=next;host.hidden=next!=='explorer';
    game.setAttribute('aria-pressed',String(next==='game'));explorer.setAttribute('aria-pressed',String(next==='explorer'));
    if(next==='game')openSettingsPage();
  }
  async function open(next='game') {
    if(!dialog.open)dialog.showModal();select(next);
    if(next!=='explorer')return;
    if(!portal.querySelector('.settings-content')) {
      host.setAttribute('aria-busy','true');
      portal.textContent='Loading explorer settings…';
      try {await (loading??=Promise.resolve().then(loadExplorer));}
      catch(error){loading=null;portal.textContent='Could not load explorer settings: '+error.message;}
      finally{host.removeAttribute('aria-busy');}
    }
    if(scope==='explorer')portal.querySelector('.settings-heading strong')?.focus();
  }
  game.onclick=()=>open('game');explorer.onclick=()=>open('explorer');
  menu={dialog,portal,host,open};select('game');return menu;
}

// Root facade follows controls moved into the shared dialog. Renderers and
// event handlers never need to know which shadow root owns a settings control.
export function settingsScope(root) {
  let portal;
  return {
    host:root.host,
    getElementById:id=>root.getElementById(id)||portal?.getElementById(id),
    querySelector:selector=>root.querySelector(selector)||portal?.querySelector(selector),
    querySelectorAll:selector=>[...root.querySelectorAll(selector),...(portal?.querySelectorAll(selector)||[])],
    attachSettings(target){portal=target;},
  };
}
export function attachExplorerSettings(root,scope) {
  if(!menu)return; // Standalone explorer keeps its own settings surface.
  const content=root.querySelector('.settings-content');
  const links=[...root.querySelectorAll('link[rel="stylesheet"]')].map(link=>link.cloneNode());
  const style=document.createElement('style');
  style.textContent=`:host{display:block;height:100%;min-height:0;color:inherit}
    .settings-content[data-paged]{position:static!important;inset:auto!important;display:flex!important;flex-direction:column;width:100%!important;max-width:none!important;height:100%!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;box-shadow:none!important;box-sizing:border-box;overflow:hidden}
    .settings-heading{padding:0!important}.settings-eyebrow,#closeSettings{display:none!important}`;
  scope.attachSettings(menu.portal);
  menu.portal.replaceChildren(...links,style,content);
  const panel=root.getElementById('settingsPanel');panel.open=false;
  panel.querySelector('summary').addEventListener('click',event=>{event.preventDefault();root.getElementById('packingPicker').open=false;menu.open('explorer');});
  // Retain programmatic close integrations, but the shared dialog owns closing.
  scope.getElementById('closeSettings').onclick=()=>menu.dialog.close();
  const copyTheme=()=>{menu.host.style.cssText=root.host.style.cssText;const theme=root.host.getAttribute('data-ui-theme');if(theme)menu.host.setAttribute('data-ui-theme',theme);};
  copyTheme();new MutationObserver(copyTheme).observe(root.host,{attributes:true,attributeFilter:['style','data-ui-theme']});
}
export function openSharedSettings(scope='game'){return menu?.open(scope);}
