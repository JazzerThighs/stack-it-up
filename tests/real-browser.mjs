import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const executable=process.env.BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert(executable,'Install Chrome/Edge or set BROWSER_PATH; this test must not silently skip.');
const profile=await mkdtemp(path.join(tmpdir(),'stack-browser-'));
// Serve explicit scenario preferences only from this test server; dist stays untouched.
const behaviorDefaults=JSON.parse(await readFile(new URL('./fixtures/behavior-defaults.json',import.meta.url),'utf8'));
const scenarioScript='\nObject.assign(startupDefaults, '+JSON.stringify(behaviorDefaults)+');\n';
const mime={'.js':'text/javascript','.html':'text/html','.wasm':'application/wasm','.css':'text/css'};
const server=createServer(async(req,res)=>{try{const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+(p==='/'?'/index.html':p));if(!file.startsWith(root))throw Error('path');res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');const body=await readFile(file);res.end(p.endsWith('/ui/startup-defaults.js')?body.toString()+scenarioScript:body);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
// Keep software WebGL in Chrome's normal GPU subprocess. In-process GPU
// initialization can terminate the browser when ANGLE/EGL fails on a CI runner.
const browserArgs=[
 '--headless=new','--no-first-run','--no-default-browser-check',
 '--remote-debugging-pipe','--user-data-dir='+profile,
 '--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader',
 'about:blank',
];
const browser=spawn(executable,browserArgs,{windowsHide:true,stdio:['ignore','ignore','pipe','pipe','pipe']});
let browserLog="";browser.stderr.on("data",d=>browserLog+=d);
const pending=new Map(),errors=[];let id=0,sessionId,connectionError;
const failConnection=error=>{connectionError=error;for(const p of pending.values())p.reject(error);pending.clear();};
browser.on('error',error=>failConnection(Error('Browser launch failed: '+error.message)));
browser.on('exit',(code,signal)=>failConnection(Error('Browser exited ('+code+', '+signal+'): '+browserLog)));
for(const pipe of [browser.stdio[3],browser.stdio[4]])pipe.on('error',error=>failConnection(Error('CDP pipe error: '+error.message+' '+browserLog)));
// Chrome's debugging pipe carries UTF-8 JSON messages terminated by NUL.
let incoming='';browser.stdio[4].setEncoding('utf8');
browser.stdio[4].on('data',chunk=>{
 incoming+=chunk;let boundary;
 while((boundary=incoming.indexOf('\0'))>=0){
  const raw=incoming.slice(0,boundary);incoming=incoming.slice(boundary+1);
  if(!raw)continue;
  let m;try{m=JSON.parse(raw);}catch(error){failConnection(Error('Invalid CDP reply: '+error.message));return;}
  if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(m.error.message)):p?.resolve(m.result);}
  else if(m.method==='Runtime.exceptionThrown'&&m.sessionId===sessionId)errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
 }
});
browser.stdio[4].on('end',()=>failConnection(Error('Browser debugging pipe closed: '+browserLog)));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFor(fn,label){const end=Date.now()+90000;while(Date.now()<end){if(browser.exitCode!==null)throw Error('Browser exited: '+browserLog);if(await fn()){console.log('PASS: '+label);return;}await delay(100);}throw Error('Timed out: '+label);}
function call(method,params={},session=sessionId){return new Promise((resolve,reject)=>{
 if(connectionError){reject(connectionError);return;}
 const n=++id;const timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP timeout: '+method+' '+browserLog));},30000);
 pending.set(n,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});
 browser.stdio[3].write(JSON.stringify({id:n,method,params,...(session?{sessionId:session}:{})})+'\0',error=>{if(error)failConnection(Error('CDP write failed: '+error.message));});
});}
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function checkPaletteNavigation(rootExpression){
 assert(await evaluate(`(()=>{
   const root=${rootExpression};
   const require=(condition,message)=>{if(!condition)throw Error('Palette navigation: '+message);};
   require(root,'settings root is missing');
   const category=name=>[...root.querySelectorAll('.settings-sidebar button')].find(b=>b.textContent===name);
   const parent=category('Cube Appearances');
   require(parent?.checkVisibility(),'Cube Appearances category is not visible');
   require(category('Active (Game)') && !category('Active (Game)').checkVisibility(),'view categories must be collapsed before opening Cube Appearances');
   parent.click();
   for(const [id,title] of [['active','Active (Game)'],['stack','Stack (Game)'],['family','Family Explorer'],['start','Start Cube (2 Packing)'],['target','Target Cube (2 Packing)']]){
     const button=category(title);require(button?.checkVisibility(),title+' category is not visible');button.click();
     const select=root.querySelector('#viewAppearance'+id+'-palettePreset');
     require(select?.checkVisibility(),title+' palette selector is not visible');
     require([...select.options].some(o=>o.value==='standard'),title+' lacks the Standard Tetris option');
   }
   const select=root.querySelector('#viewAppearancetarget-palettePreset');
   select.value='sega-tetris';select.dispatchEvent(new Event('change',{bubbles:true}));
   require(select.value==='sega-tetris','selected preset was not retained');
   require(JSON.parse(localStorage.getItem('stack-it-up.view-appearance')).views.target.palette[2]==='#26eeee','target preset was not saved');
   return true;
 })()`));
 console.log('PASS: Cube Appearances navigation, visible palette selectors for all five views and saved preset selection');
}
try{
 await call('Browser.getVersion');console.log('PASS: browser start and debugging pipe');
 const {targetId}=await call('Target.createTarget',{url:'about:blank'});
 ({sessionId}=await call('Target.attachToTarget',{targetId,flatten:true}));
 await call('Runtime.enable');
 await call('Page.navigate',{url:base+'/#game'});
 await waitFor(()=>evaluate("document.querySelector('#control')?.width>0 && document.querySelector('#engineStatus')?.textContent==='Ready'"),'game startup');
 // Fresh profiles first open the new-game dialog. Complete that user flow
 // before opening Settings; both dialogs share the navigation owner.
 await waitFor(()=>evaluate("document.querySelector('#startupScreen').hidden && document.querySelector('#setupDialog').open"),'initial game setup ready');
 await evaluate("document.querySelector('#setupStart').click()");
 await waitFor(()=>evaluate("!document.querySelector('#setupDialog').open && !document.querySelector('#new').disabled"),'initial game setup complete');
 for (const width of [320, 390, 621, 1280]) {
   await call('Emulation.setDeviceMetricsOverride', {width, height:844, deviceScaleFactor:1, mobile:width < 621});
   assert(await evaluate(`(() => {
     const rects = ['#qrOpen', '.brand span', '#screenSelect', '#settingsOpen', '#bluetoothOpen', '#resetGraphics']
       .map(selector => document.querySelector(selector).getBoundingClientRect());
     const center = rect => rect.top + rect.height / 2;
     return rects.every((rect, i) => rect.width > 0 && rect.left >= 0 && rect.right <= innerWidth
       && Math.abs(center(rect) - center(rects[0])) <= 1 && (!i || rect.left >= rects[i - 1].right));
   })()`), `Shared header must fit on one row at ${width}px`);
   await evaluate(`(async () => {
     const button = document.getElementById('toggleFacemaps');
     const split = document.getElementById('viewMode');
     const previousLabel = split.textContent;
     button.click();
     await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
     const panel = document.getElementById('stageFaceMapPanel');
     const bounds = panel.getBoundingClientRect();
     const toolbar = document.querySelector('.stage-tools').getBoundingClientRect();
     if (button.getAttribute('aria-pressed') !== 'true' || !panel.checkVisibility() ||
         panel.clientHeight <= 0 || panel.scrollWidth > panel.clientWidth + 1 || bounds.bottom > toolbar.top + 1)
       throw Error('Facemaps overflow or overlap bottom controls at ' + innerWidth);
     const grids = [...panel.querySelectorAll('.face-grid')];
     if (grids.length !== 9 || grids.some(grid => {
       const rect = grid.getBoundingClientRect();
       return rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || rect.width <= 0;
     })) throw Error('Face grids exceed the map panel at ' + innerWidth);
     const cell = grids[0].querySelector('i');
     for (const boundary of [25,75,100,0]) {
       cell.style.setProperty('--map-boundary', boundary+'%');
       const [oldLayer,newLayer] = [...cell.children].map(layer=>getComputedStyle(layer).clipPath);
       if (oldLayer !== 'inset(0px 0px '+(100-boundary)+'%)' ||
           newLayer !== 'inset('+boundary+'% 0px 0px)') throw Error('Unexpected sticker clips: '+oldLayer+' / '+newLayer);
     }
     cell.style.removeProperty('--map-boundary');
     button.click();
     if (button.getAttribute('aria-pressed') !== 'false' || split.textContent !== previousLabel ||
         document.getElementById('stageFaceMap').checked) throw Error('Facemaps toggle did not restore the layout');
   })()`);

 }
 await call('Emulation.clearDeviceMetricsOverride');
 await evaluate("document.querySelector('#settingsOpen').click()");
 assert(await evaluate("document.querySelector('#settingsDialog').open && !document.querySelector('#setupDialog').open"));
 await checkPaletteNavigation("document.querySelector('#settingsDialog')");
 assert(await evaluate(`(() => {
   const select=document.getElementById('viewAppearanceactive-palettePreset');
   select.value='sega-tetris';select.dispatchEvent(new Event('change',{bubbles:true}));
   const palette=JSON.parse(localStorage.getItem('stack-it-up.view-appearance')).views.active.palette;
   const color=document.createElement('span');
   return [...document.querySelectorAll('#queue .queue-item')].every(item=>{
     const id='OTLJSZBDF'.indexOf(item.querySelector('small').textContent);
     color.style.color=palette[id+1];
     return id>=0 && item.querySelector('.shape').style.color===color.style.color;
   });
 })()`), 'Queue previews must immediately follow Active (Game) palette changes');

 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 assert(await evaluate(`(async()=>{
   const root=document.querySelector('#settingsDialog');
   [...root.querySelectorAll('.settings-sidebar button')].find(b=>b.textContent==='Controls and camera').click();
   document.querySelector('#settingsClose').click();document.querySelector('#bluetoothOpen').click();
   const source=document.querySelector('#gameInputSource');
   if(source.value!=='bluetooth'||!root.open||!source.checkVisibility()||!['bluetoothConnect','bluetoothDisconnect','bluetoothCalibrate','bluetoothMac'].every(id=>document.getElementById(id).checkVisibility()))throw Error('Bluetooth shortcut must show the Input page and connection controls');
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   const slider=document.querySelector('#bluetoothNeutralTolerance');
   if(!slider.checkVisibility())throw Error('Neutral correction slider hidden on mobile');
   const original=slider.value;
   slider.value='17';slider.dispatchEvent(new Event('input'));
   if(document.querySelector('#bluetoothNeutralToleranceValue').textContent!=='17 degrees')throw Error('Neutral correction label did not update');
   if(JSON.parse(localStorage.getItem('stack-it-up.controls')).values.bluetoothNeutralTolerance!==17)throw Error('Neutral correction was not saved');
   slider.value=original;slider.dispatchEvent(new Event('input'));
   for(const [id,value,suffix] of [['bluetoothNeutralDelay',375,' ms'],['bluetoothNeutralSpeed',3.5,'x'],['bluetoothNeutralCutoff',18,' degrees/s'],['bluetoothGyroResponse',250,' ms'],['bluetoothGyroSpeed',240,' degrees/s'],['bluetoothGyroAcceleration',1500,' degrees/s²']]){
     const control=document.getElementById(id),saved=control.value;
     if(!control.checkVisibility())throw Error(id+' hidden on mobile');
     control.value=String(value);control.dispatchEvent(new Event('input'));
     if(document.getElementById(id+'Value').textContent!==String(value)+suffix)throw Error(id+' label not updated');
     if(JSON.parse(localStorage.getItem('stack-it-up.controls')).values[id]!==value)throw Error(id+' not saved');
     control.value=saved;control.dispatchEvent(new Event('input'));
   }

   source.value='manual';source.dispatchEvent(new Event('change'));
   document.querySelector('#settingsClose').click();document.querySelector('#settingsOpen').click();
   [...root.querySelectorAll('.settings-sidebar button')].find(b=>b.textContent==='Turn animations').click();
   const speed=document.querySelector('#turnAnimationSpeed'),animations=document.querySelector('#animations');
   if(!speed.checkVisibility()||!animations.checkVisibility())throw Error('Turn animation controls hidden on mobile');
   const originalSpeed=speed.value;
   speed.value='2.5';speed.dispatchEvent(new Event('input'));
   if(document.querySelector('#turnAnimationSpeedValue').textContent!=='2.5x')throw Error('Turn speed label did not update');
   if(JSON.parse(localStorage.getItem('stack-it-up.controls')).values.turnAnimationSpeed!==2.5)throw Error('Turn speed not saved');
   document.querySelector('#turnAnimationReset').click();
   if(speed.value!==originalSpeed)throw Error('Turn speed reset did not restore authored default');
   return true;
 })()`));
 await call('Emulation.clearDeviceMetricsOverride');
 console.log('PASS: mobile neutral gyro slider visibility, live value and persistence');

 assert(await evaluate(`(async()=>{
   const source=document.querySelector('#gameInputSource');
   if(source.value!=='manual')return false;
   source.value='bluetooth';source.dispatchEvent(new Event('change'));
   const entry=document.querySelector('script[type="module"][src]').src;
   const library=await import(new URL('./vendor/smartcube.js',entry));
   if(typeof library.connectSmartCube!=='function'||document.querySelector('#bluetoothOptions').hidden)return false;
   source.value='manual';source.dispatchEvent(new Event('change'));
   return document.querySelector('#bluetoothOptions').hidden && document.querySelector('#bluetoothConnect').disabled;
 })()`));
 await evaluate("document.querySelector('#settingsClose').click()");
 await evaluate("window.__canvas=document.querySelector('#control');window.__lost=0;window.__restored=0;__canvas.addEventListener('webglcontextlost',()=>__lost++);__canvas.addEventListener('webglcontextrestored',()=>__restored++);window.__ext=__canvas.getContext('webgl2').getExtension('WEBGL_lose_context');if(!__ext)throw Error('No context-loss extension');__ext.loseContext()");
 await waitFor(()=>evaluate('window.__lost===1'),'context lost');await evaluate('__ext.restoreContext()');
 await waitFor(()=>evaluate('window.__restored===1'),'context restored');
 await evaluate("document.querySelector('#explorerTab').click()");
 await waitFor(()=>evaluate("!!document.querySelector('#explorer').shadowRoot?.querySelector('#familyExploreCube canvas')"),'explorer startup');
 await evaluate("document.querySelector('#explorer').explorerReady");
 assert.deepEqual(await evaluate(`[...document.querySelector('#explorer').shadowRoot
   .querySelector('#familyExploreCube .packing-actions').children].slice(0,2).map(button => button.id)`),
   ['familyLockShapes','familyLockColors']);

 await waitFor(()=>evaluate("document.querySelector('#explorer').shadowRoot.querySelector('#familyExploreCube canvas')?.dataset.geometrySource==='worker' && document.querySelector('#explorer').shadowRoot.querySelector('#familyExploreCube canvas').getAttribute('aria-busy')==='false'"),'worker geometry ready');
 const familyRoot = "document.querySelector('#explorer').shadowRoot";
 await evaluate(`document.querySelector('#explorer').shadowRoot.getElementById('familyFacemaps').click()`);
 for (const width of [320, 390, 1280]) {
   await call('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<600});
   assert(await evaluate(`(async()=>{
     await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
     const root=${familyRoot}, panel=root.getElementById('familyMapPanel'), net=root.getElementById('familyNet');
     const rect=panel.getBoundingClientRect(), toolbar=root.querySelector('#familyExploreCube .packing-actions').getBoundingClientRect();
     return net.querySelectorAll('.face-grid').length===9 && net.querySelectorAll('i').length===81 &&
       panel.checkVisibility() && panel.clientHeight>0 && panel.scrollWidth<=panel.clientWidth+1 &&
       rect.bottom<=toolbar.top+1;
   })()`), 'Family maps must wrap above controls at '+width);
 }
 await call('Emulation.clearDeviceMetricsOverride');
 assert(await evaluate(`(async()=>{
   const host=document.querySelector('#explorer'),root=host.shadowRoot,cube=host.physicalTurnTarget('explorer');
   const m=await import(new URL('ui/view-appearance.js', document.querySelector('script[type=module][src]').src));
   m.setViewAppearance('family','whole','solids');
   m.setViewAppearance('family','fragments','solids');
   m.setViewAppearance('family','extras','cubies');
   const net=root.getElementById('familyNet');
   const numbers = new Set([...net.querySelectorAll('.map-number')].map(layer=>layer.textContent));
   if(!['4','6','8','12','20'].every(n=>numbers.has(n)) || !net.querySelector('.map-extra') || !net.querySelector('.map-ball'))return false;
   cube.setState(cube.cells,{kind:'turn',move:0,t:.4});
   const partial=getComputedStyle(net.querySelector('i').lastElementChild).clipPath.includes('60%');
   cube.setState(cube.cells);
   m.setViewAppearance('family','extras','solids');
   return partial && !net.querySelector('.map-extra') && !!net.querySelector('.map-ball');
 })()`), 'Family maps follow actual solid identities, extras, and turn progress');
 await evaluate(`${familyRoot}.getElementById('familyFacemaps').click()`);

 await evaluate(`(async () => {
   const module = await import(new URL('ui/view-appearance.js', document.querySelector('script[type=module][src]').src));
   module.setViewAppearance('family','whole','cubies');
 })()`);
 for (const [id, assembly] of [['familyLockShapes','retained'],['familyLockColors','retained'],['familyLockShapes','whole'],['familyLockColors','cubies']]) {
   const button = `${familyRoot}.getElementById('${id}')`;
   await waitFor(()=>evaluate(`!${button}.disabled`), id+' available');
   const point = await evaluate(`(() => {
     const el = ${button}, bounds = el.getBoundingClientRect();
     const x = bounds.left + bounds.width / 2, y = bounds.top + bounds.height / 2;
     if (${familyRoot}.elementFromPoint(x,y) !== el) throw Error('Obstructed '+el.id);
     return {x,y};
   })()`);
   await call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
   await call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
   const view = "document.querySelector('#explorer').physicalTurnTarget('explorer')";
   await waitFor(()=>evaluate(`(${view}?.lockedAssembly || 'cubies') === '${assembly}' && !${view}?.geometry.pending`), id+' toggled');
   assert(await evaluate(`(() => {const a=${view}.geometry.base.assembly;return (a?.whole || a) === '${assembly}';})()`), 'Family worker geometry must honor '+assembly);
 }

 await evaluate("document.querySelector('#settingsOpen').click()");
 assert(await evaluate("document.querySelector('#settingsDialog').open && document.querySelector('#settingsDialog').dataset.settingsScope==='explorer'"));
 assert(await evaluate("!!document.querySelector('#explorerSettingsHost').shadowRoot.querySelector('#modelShape') && !document.querySelector('#explorer').shadowRoot.querySelector('.settings-content')"));
 await checkPaletteNavigation("document.querySelector('#explorerSettingsHost').shadowRoot");
 await evaluate("window.__model=document.querySelector('#explorerSettingsHost').shadowRoot.querySelector('#modelShape');__model.value='gameboy';__model.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#settingsClose').click();document.querySelector('#settingsOpen').click()");
 assert(await evaluate("document.querySelector('#explorerSettingsHost').shadowRoot.querySelector('#modelShape')===window.__model && __model.value==='gameboy'"));
 await evaluate("document.querySelector('#settingsClose').click()");
 console.log('PASS: one settings dialog, live explorer controls and retained choices on reopen');
 assert(await evaluate("document.querySelector('#gamePage').hidden && !document.querySelector('#explorerPage').hidden"));
 await evaluate("document.querySelector('#gameTab').click()");
 assert(await evaluate("!document.querySelector('#gamePage').hidden && document.querySelector('#control')===window.__canvas"));
 assert.deepEqual(errors,[]);
 console.log('PASS: real '+await evaluate('navigator.userAgent')+'; game/settings/explorer loading, tab reuse and WebGL context loss/recovery.');
}finally{browser.stdio[3].end();server.closeAllConnections();browser.kill();await new Promise(r=>!browser.pid||browser.exitCode!==null||browser.signalCode!==null?r():browser.once('exit',r));await new Promise(r=>server.close(r));if(path.dirname(path.resolve(profile))!==path.resolve(tmpdir())||!path.basename(profile).startsWith('stack-browser-'))throw Error('Unsafe test profile path');await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
