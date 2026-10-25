const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'tests/current-reference.html'),'utf8');
const begin=html.indexOf('const CubeStack ='),end=html.indexOf('const {Renderer,colors,faceLabels}');
const ctx={structuredClone};vm.runInNewContext(html.slice(begin,end)+';globalThis.make=createEngine;',ctx);
(async()=>{
const {instance}=await WebAssembly.instantiate(fs.readFileSync(path.join(root,'target/wasm32-unknown-unknown/release/cube_stack.wasm')));const w=instance.exports;
const snap=()=>{const p=w.state_ptr();return Array.from(new Uint32Array(w.memory.buffer,p,w.state_len()));};
let checks=0;
for(let mode=0;mode<3;mode++)for(let seed=1;seed<=12;seed++){
 const js=ctx.make();js.game_init(seed);w.game_init(seed);w.game_set_slice_clears(0);js.game_set_gravity(mode);w.game_set_gravity(mode);
 const compare=label=>{const a=Array.from(js.snapshot()),b=snap();for(let i=0;i<166;i++){if([72,74].includes(i))continue;assert.equal(b[i],a[i],`${label} mode=${mode} seed=${seed} slot=${i}`);}const ptr=w.events_ptr(),actual=Array.from(new Uint32Array(w.memory.buffer,ptr,w.events_len())),expected=Array.from(js.events()).flatMap(e=>[e.kind,e.mask,e.face,...e.board,...e.ids,...e.origins,e.floatMask,e.fragmentTurns]);assert.deepEqual(actual,expected,`${label}: event parity`);checks++;};compare('spawn');
 for(let step=0;step<120;step++){
  const s=snap();if(s[66])break;
  if(step%19===0){for(let m=0;m<30;m++){const ptr=w.previews_ptr(m),v=Array.from(new Uint32Array(w.memory.buffer,ptr,w.previews_len())),actual=[];for(let i=0;i<v.length;i+=3)actual.push({mask:v[i],piece:v[i+1],sourceMask:v[i+2]});const expected=JSON.parse(JSON.stringify(js.placement_previews([m])));assert.deepEqual(actual,expected,`preview mode=${mode} seed=${seed} move=${m}`);}}
  if(s[78]){const face=Math.log2(s[78]&-s[78]);assert.equal(w.game_choose(face),+js.game_choose(face));}
  else if(step%17===0){assert.equal(w.game_hold(),+js.game_hold());}
  else {const win=s[67],m=win?Math.log2(win&-win):(step*7+seed)%30;assert.equal(w.game_turn(m),+js.game_turn(m));}
  compare(`step ${step}`);
  if(step%13===8){assert.equal(w.game_undo(),+js.game_undo());compare('undo');}
 }
}
console.log(`PASS: ${checks} current-JavaScript/Wasm snapshots across gravity modes, holds, turns, choices and undo.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
