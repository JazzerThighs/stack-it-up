import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {PackingStore,OFFICIAL_MASKS} from '../web/explorer/data-store.js';
import {packingCells,practicePair,ROTATIONS,cellsOf,displayIndex} from '../web/explorer/model.js';
import {detectPieces,identifyMask} from '../web/explorer/family-exploration.js';
import {familyPackingCells,detectedColor} from '../web/explorer/family-colors.js';
const release=JSON.parse(await readFile(new URL('../dist/build-info.json',import.meta.url),'utf8'));
const base=new URL(`../dist/${release.assets}/explorer/data/`,import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',base),'utf8'));
let loads=0;
const load=async name=>{loads++;const bytes=await readFile(new URL(name,base));assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.assets[name].sha256);const raw=gunzipSync(bytes);assert.equal(raw.length,manifest.assets[name].bytes);return raw;};
const store=new PackingStore(manifest,await load('index.bin.gz'),load);
assert.equal(manifest.count,1871891);assert.equal(manifest.families.length,2605);
let result=await store.query();assert.equal(result.count,1871891);assert.equal(result.record.lineNumber,1);
assert(loads<=2,'startup loads only the index and one family');
const sum=manifest.families.reduce((n,f)=>n+f.count,0);assert.equal(sum,manifest.count);
const count=filters=>{store.filter(filters);return store.selected.length;};
assert.equal(count({surfaceOnly:true})+count({nonSurfaceOnly:true}),manifest.count);
assert.equal(count({spatial:'none'})+count({spatial:'mixed'})+count({spatial:'only'}),manifest.count);
assert.equal(count({planar:'none'})+count({planar:'any'}),manifest.count);

assert.equal(count({surfaceOnly:true,nonSurfaceOnly:true}),0);
assert.equal(count({allSurfaceIdentities:true,spatial:'only'}),0);
for(const type of ['B','D','F']) {
  result=await store.query({filters:{counts:[{type,min:1,max:6}]},random:true});assert(result.count>0);
  assert(result.record.identities.some(c=>c.toUpperCase()===type));
  const core=await store.query({filters:{coreType:type},random:true});assert(core.count>0);assert(core.record.identities.includes(type.toLowerCase()));
  const cells=familyPackingCells(core.record);assert.equal(detectPieces(cells).filter(p=>p.letter).length,6);
  assert.equal(detectedColor(type,'y'),type);
  const found=await store.lookup(core.record.familyId,core.record.masks);assert(found.some(p=>p.lineNumber===core.record.lineNumber));
}
const official=await store.lookup(store.officialFamily,OFFICIAL_MASKS);assert.equal(official.length,1);
assert(official[0].oneOfEach);assert.equal(official[0].familyId,store.officialFamily);
for(const filters of [{},{spatial:'only'},{nonSurfaceOnly:true},{planar:'surface'},{counts:[{type:'D',min:2,max:6}]}]) {
  const pair=await store.pair(filters);assert(pair);assert.notEqual(pair[0].lineNumber,pair[1].lineNumber);assert.equal(pair[0].familyId,pair[1].familyId);
  assert(practicePair(...pair).compatible);
}
// Verify transformed masks and rendering-space chirality for every spatial catalog placement.
for(const p of manifest.catalog.filter(p=>+p.spatial)) {
  const expected={Branch:'B',RightScrew:'D',LeftScrew:'F'}[p.type];
  const display=cellsOf(p.mask).reduce((m,i)=>m|(1<<displayIndex(i)),0);
  assert.equal(identifyMask(display),expected);
  const mirror=cellsOf(display).reduce((m,i)=>m|(1<<((2-Math.floor(i/9))*9+i%9)),0);
  assert.equal(identifyMask(mirror),expected==='D'?'F':expected==='F'?'D':'B');
}
// Family membership represents every input ID once, without loading records into objects.
const seen=new Uint8Array(manifest.count);
for(const f of manifest.families) {
  const raw=await load(`family-${f.id}.bin.gz`),v=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
  for(let at=0;at<raw.length;at+=16) {
    const id=v.getUint32(at,true);assert(id>=1&&id<=manifest.count);assert.equal(seen[id-1]++,0);
    assert.equal(store.index.getUint16((id-1)*20,true),f.id);
    assert.equal(store.index.getUint32((id-1)*20+16,true),at/16);
  }
}
assert(seen.every(n=>n===1));
const sizes=Object.values(manifest.assets).reduce((a,b)=>a+b.compressedBytes,0);
console.log(`PASS: all ${manifest.count} members, ${manifest.families.length} families, spatial/core filters, official reference, practice reachability and screw detection. Compressed assets ${(sizes/1048576).toFixed(1)} MiB.`);

// Run the actual worker protocol and browser gzip/checksum path against local assets.
const pending=new Map();let sequence=0;
const originalFetch=globalThis.fetch;
globalThis.fetch=async url=>new Response(await readFile(new URL(new URL(url).pathname.split('/').pop(),base)));
globalThis.self={postMessage:message=>{const resolve=pending.get(message.id);pending.delete(message.id);resolve(message);}};
await import('../web/explorer/data-worker.js');
const call=(method,...args)=>new Promise(resolve=>{const id=++sequence;pending.set(id,resolve);self.onmessage({data:{id,method,args}});});
const initialized=await call('init');assert.equal(initialized.value.count,manifest.count);
const queried=await call('query',{filters:{spatial:'only'}});assert(queried.value.record.identities.every(c=>'BDF'.includes(c.toUpperCase())));
const invalid=await call('record',0);assert.match(invalid.error,/Source line/);
const recovered=await call('record',1);assert.equal(recovered.value.lineNumber,1);
globalThis.fetch=originalFetch;
console.log('PASS: worker initialization, checksum/gzip decoding, spatial query and recovery after invalid requests.');
