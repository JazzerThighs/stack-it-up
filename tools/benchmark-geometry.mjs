// CPU geometry baseline: real release Wasm, no DOM, GPU or frame-rate claims.
// Run after npm run build: node tools/benchmark-geometry.mjs [output.json]
import fs from 'node:fs';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {explorationMeshes} from '../web/explorer/exploration-mesh.js';
import {performance} from 'node:perf_hooks';
import {adaptTransport} from '../web/engine/transport.js';
import {visualSettings} from '../web/render/visual-settings.js';
import {cellFragments,joinMeshes} from '../web/render/cell-fragments.js';
const wasmURL=new URL('../dist/cube_stack.wasm',import.meta.url);
const {instance}=await WebAssembly.instantiate(fs.readFileSync(wasmURL));
const engine=adaptTransport(instance.exports);
const sampleCount=5,results=[];
const timed=fn=>{const t=performance.now(),value=fn();return {value,ms:performance.now()-t};};
const summary=values=>{const a=values.slice().sort((a,b)=>a-b);return {medianMs:a[Math.floor(a.length/2)],maxMs:a.at(-1)};};
const cases=[
 {name:'Jelly L, 100%',cells:[0,3,6,7],scale:100,profile:2},
 {name:'Jelly L, 40%',cells:[0,3,6,7],scale:40,profile:2},
 {name:'Jelly L, profile 6',cells:[0,3,6,7],scale:100,profile:6},
 {name:'Jelly single cubie',cells:[0],scale:100,profile:2},
];
// Warm Wasm compilation separately. These are cache-miss costs, not first-load costs.
engine.bandMesh(1,false,{bevel:.15,opening:.24,profile:2,elbows:1,scale:1});
for(const [index,c]of cases.entries()){
 Object.assign(visualSettings,{cubieScale:c.scale,jellyCornerO:0,jellyBevel:15,jellyOpening:24,jellyProfile:c.profile,jellyElbows:100});
 const board=Array(27).fill(0),ids=Array(27).fill(0);for(const cell of c.cells){board[cell]=1;ids[cell]=1;}
 const rows=[];
 for(let sample=0;sample<sampleCount;sample++){
  // Isolated piece caches guarantee a miss without changing production code.
  const {compositeParts}=await import(`../web/render/piece-mesh.js?benchmark=${index}-${sample}`);
  let nativeMs=0;
  const generate=(mask,corner)=>{const t=timed(()=>engine.bandMesh(mask,corner,{bevel:.15,opening:.24,profile:c.profile,elbows:1,scale:c.scale/100}));nativeMs+=t.ms;return t.value;};
  const colored=timed(()=>compositeParts(board,ids,['','#ffd35c'],generate,'jelly'));
  const source=colored.value[0];
  const clipping=timed(()=>cellFragments(source));
  const join=timed(()=>joinMeshes([source]));
  const warm=timed(()=>{for(let i=0;i<100;i++)compositeParts(board,ids,['','#ffd35c'],generate,'jelly');});
  rows.push({nativeMs,compositeMs:colored.ms,fragmentMs:clipping.ms,joinMs:join.ms,warmCompositeMs:warm.ms/100,triangles:source.length/27,meshBytes:source.byteLength+(source.coverage?.byteLength||0)});
 }
 const result={...c,samples:rows,timing:Object.fromEntries(Object.keys(rows[0]).filter(k=>k.endsWith('Ms')).map(k=>[k,summary(rows.map(r=>r[k]))])),triangles:rows[0].triangles,meshBytes:rows[0].meshBytes};
 results.push(result);console.log(c.name,JSON.stringify(result.timing));
}
Object.assign(visualSettings,{cubieScale:100,jellyProfile:2});
const cells=Array.from({length:27},(_,i)=>[0,3,6,7].includes(i)?{piece:0,color:'o'}:null);
const generate=(m,o)=>engine.bandMesh(m,o,{bevel:.15,opening:.24,profile:2,elbows:1,scale:1});
const prepare=()=>explorationMeshes(cells,generate,'jelly',false,false,true,false,{},false,'whole')[0];
const stable=prepare();cellFragments(stable);
const reuse=[],copied=[];
for(let i=0;i<5;i++){
 reuse.push(timed(()=>cellFragments(prepare())).ms);
 // Reproduce the former one-piece join without reverting production code.
 copied.push(timed(()=>cellFragments(joinMeshes([prepare()]))).ms);
}
const explorerReuse={sameReference:prepare()===stable,stable:summary(reuse),previousCopyPath:summary(copied)};
console.log('Explorer repeated identical L',JSON.stringify(explorerReuse));
const report={explorerReuse,wasmSha256:createHash('sha256').update(fs.readFileSync(wasmURL)).digest('hex'),date:new Date().toISOString(),runtime:process.version,platform:os.platform(),arch:os.arch(),cpu:os.cpus()[0]?.model,sampleCount,wasmBytes:fs.statSync(wasmURL).size,scope:'CPU stages only. Five warmed-runtime cache misses per case; not browser/GPU/frame latency or representative family playback.',results};
const output=process.argv[2]||'docs/performance/geometry-baseline.json';
fs.mkdirSync(new URL('../docs/performance/',import.meta.url),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log('Saved '+output);
