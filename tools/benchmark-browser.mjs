import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const build=JSON.parse(await readFile(path.join(root,'build-info.json'),'utf8'));
const mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.wasm':'application/wasm','.css':'text/css','.json':'application/json'};
const html=`<!doctype html><meta charset="utf-8"><title>Milestone 5 browser benchmark</title>
<style>body{font:16px system-ui;background:#18212a;color:#eee;margin:24px}button,a{font:inherit;color:inherit}#cube{width:640px;height:540px}canvas.packing-canvas{width:640px;height:480px}pre{white-space:pre-wrap}button{background:#345;padding:10px}</style>
<h1>Rendering performance probe</h1><p>Keep this tab visible. Runs Jelly on the smallest multi-packing and largest families. Fifteen cycles checks resource stability; one cycle is a quick check.</p>
<label>Jelly cycles <select id="jellyCycles"><option>1</option><option>10</option><option selected>15</option></select></label>
<button id="run">Run benchmark</button> <button id="stop" disabled>Stop after current turn</button> <a id="download" hidden>Download JSON report</a><pre id="status">Ready</pre><div id="cube"></div>
<script>window.benchmarkBuild=${JSON.stringify(build)};</script><script type="module" src="/__probe/browser-probe.mjs"></script>`;
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
    const probe=pathname.match(/^\/__probe\/(browser-probe|performance-metrics)\.mjs$/);
    const file=probe?fileURLToPath(new URL(`./${probe[1]}.mjs`,import.meta.url)):path.resolve(root,'.'+pathname);
    const relative=path.relative(root,file);
    if(!probe&&(relative.startsWith('..')||path.isAbsolute(relative)))throw Error('path');
    res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
    res.setHeader('Cache-Control','no-store');res.end(await readFile(file));
  }catch{res.writeHead(404);res.end();}
});
server.listen(Number(process.env.PORT||4174),'127.0.0.1',()=>console.log(`Browser benchmark: http://127.0.0.1:${server.address().port}/ (Ctrl+C to stop)`));
