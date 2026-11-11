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
const mime={'.js':'text/javascript','.html':'text/html','.wasm':'application/wasm','.css':'text/css'};
const server=createServer(async(req,res)=>{try{const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+(p==='/'?'/index.html':p));if(!file.startsWith(root))throw Error('path');res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const browser=spawn(executable,['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'--enable-unsafe-swiftshader','--use-angle=swiftshader','--in-process-gpu','about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let browserLog="";browser.stderr.on("data",d=>browserLog+=d);
let socket;const pending=new Map(),errors=[];let id=0;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFor(fn,label){const end=Date.now()+90000;while(Date.now()<end){if(browser.exitCode!==null)throw Error('Browser exited: '+browserLog);if(await fn()){console.log('PASS: '+label);return;}await delay(100);}throw Error('Timed out: '+label);}
function call(method,params={}){return new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP timeout: '+method+' '+browserLog));},30000);pending.set(n,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});socket.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
try{
 let port;await waitFor(async()=>{try{port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];return true;}catch{return false;}},'browser start');
 const page=await fetch('http://127.0.0.1:'+port+'/json/new?'+encodeURIComponent('about:blank'),{method:'PUT'}).then(r=>r.json());
 socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
 socket.onclose=()=>{for(const p of pending.values())p.reject(Error('Browser connection closed'));pending.clear();};
 socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(m.error.message)):p?.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);};
 await call('Runtime.enable');
 await call('Page.navigate',{url:base+'/#game'});
 await waitFor(()=>evaluate("document.querySelector('#control')?.width>0 && document.querySelector('#engineStatus')?.textContent==='Ready'"),'game startup');
 await evaluate("document.querySelector('#settingsOpen').click()");
 assert(await evaluate("document.querySelector('#settingsDialog').open"));
 await evaluate("document.querySelector('#settingsClose').click()");
 await evaluate("window.__canvas=document.querySelector('#control');window.__lost=0;window.__restored=0;__canvas.addEventListener('webglcontextlost',()=>__lost++);__canvas.addEventListener('webglcontextrestored',()=>__restored++);window.__ext=__canvas.getContext('webgl2').getExtension('WEBGL_lose_context');if(!__ext)throw Error('No context-loss extension');__ext.loseContext()");
 await waitFor(()=>evaluate('window.__lost===1'),'context lost');await evaluate('__ext.restoreContext()');
 await waitFor(()=>evaluate('window.__restored===1'),'context restored');
 await evaluate("document.querySelector('#explorerTab').click()");
 await waitFor(()=>evaluate("!!document.querySelector('#explorer').shadowRoot?.querySelector('#familyExploreCube canvas')"),'explorer startup');
 await evaluate("document.querySelector('#explorer').explorerReady");
 await waitFor(()=>evaluate("document.querySelector('#explorer').shadowRoot.querySelector('#familyExploreCube canvas')?.dataset.geometrySource==='worker' && document.querySelector('#explorer').shadowRoot.querySelector('#familyExploreCube canvas').getAttribute('aria-busy')==='false'"),'worker geometry ready');
 await evaluate("document.querySelector('#explorer').shadowRoot.querySelector('#settingsPanel summary').click()");
 assert(await evaluate("document.querySelector('#settingsDialog').open && document.querySelector('#settingsDialog').dataset.settingsScope==='explorer'"));
 assert(await evaluate("!!document.querySelector('#explorerSettingsHost').shadowRoot.querySelector('#modelShape') && !document.querySelector('#explorer').shadowRoot.querySelector('.settings-content')"));
 await evaluate("window.__model=document.querySelector('#explorerSettingsHost').shadowRoot.querySelector('#modelShape');__model.value='gameboy';__model.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#settingsClose').click();document.querySelector('#explorer').shadowRoot.querySelector('#settingsPanel summary').click()");
 assert(await evaluate("document.querySelector('#explorerSettingsHost').shadowRoot.querySelector('#modelShape')===window.__model && __model.value==='gameboy'"));
 await evaluate("document.querySelector('#settingsClose').click()");
 console.log('PASS: one settings dialog, live explorer controls and retained choices on reopen');
 assert(await evaluate("document.querySelector('#gamePage').hidden && !document.querySelector('#explorerPage').hidden"));
 await evaluate("document.querySelector('#gameTab').click()");
 assert(await evaluate("!document.querySelector('#gamePage').hidden && document.querySelector('#control')===window.__canvas"));
 assert.deepEqual(errors,[]);
 console.log('PASS: real '+await evaluate('navigator.userAgent')+'; game/settings/explorer loading, tab reuse and WebGL context loss/recovery.');
}finally{socket?.close();server.closeAllConnections();browser.kill();await new Promise(r=>browser.exitCode!==null||browser.signalCode!==null?r():browser.once('exit',r));await new Promise(r=>server.close(r));if(path.dirname(path.resolve(profile))!==path.resolve(tmpdir())||!path.basename(profile).startsWith('stack-browser-'))throw Error('Unsafe test profile path');await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
