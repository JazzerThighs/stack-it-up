import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {PackingStore} from '../web/explorer/data-store.js';
const release=JSON.parse(readFileSync(new URL('../dist/build-info.json',import.meta.url)));
const base=new URL(`../dist/${release.assets}/explorer/data/`,import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',base)));
let loads=0;
const store=new PackingStore(manifest,gunzipSync(readFileSync(new URL('index.bin.gz',base))),async n=>{loads++;return gunzipSync(readFileSync(new URL(n,base)));});
const counts=['O','T','JL','SZ','B','D','F'].map(type=>({type,min:0,max:6}));
const report={};
for(const [name,filters]of Object.entries({default:{counts},branch:{counts:[{type:'B',min:1,max:3}]},core:{coreType:'F'}})) {
  const start=performance.now();store.filter(filters);report[name]={ms:performance.now()-start,count:store.selected.length};
  assert.equal(store.selected.buffer,store.selectionBuffer.buffer,'filtering reuses a single typed selection buffer');
}
assert.equal(report.default.count,1871891);assert.equal(report.branch.count,757338);assert.equal(report.core.count,479643);
assert.equal(loads,0,'filters never load full packing records');
// Check combined optimized predicates against a separate row-based oracle.
for(const filters of [
  {counts:[{type:'JL',min:1,max:3},{type:'SZ',min:0,max:2}],coreType:'JL',extraEdges:'yes'},
  {counts:[{type:'D',min:2,max:5}],coreType:'D',extraCenters:'no'},
  {counts:[{type:'F',min:0,max:0},{type:'O',min:1,max:6}],coreType:'SZ',extraCorners:'yes'},
]) {
  store.filter(filters);const selected=new Uint8Array(manifest.count);for(const id of store.selected)selected[id-1]=1;
  for(let i=0;i<manifest.count;i+=97) {
    const at=i*20,ids=Array.from({length:6},(_,j)=>String.fromCharCode(store.index.getUint8(at+10+j)).toUpperCase());
    const core=store.index.getUint8(at+6),extra=store.index.getUint8(at+8);
    const matches=(id,type)=>type.includes(id);
    let expected=filters.counts.every(({type,min,max})=>{const n=ids.filter(id=>matches(id,type)).length;return n>=min&&n<=max;});
    expected&&=ids.some((id,j)=>(core&(1<<j))&&matches(id,filters.coreType));
    for(const [name,bit]of [['extraCenters',2],['extraEdges',4],['extraCorners',8]])if(filters[name])expected&&=filters[name]==='yes'?!!(extra&bit):!(extra&bit);
    assert.equal(!!selected[i],expected,`combined filters at row ${i+1}`);
  }
}
const start=performance.now(),pair=await store.pair({counts});report.pairMs=performance.now()-start;
assert.notEqual(pair[0].lineNumber,pair[1].lineNumber);assert.equal(pair[0].familyId,pair[1].familyId);
assert(loads<=2,'a practice pair loads only its chosen family');
const constrained=await store.pair({family:pair[0].familyId});assert(constrained.every(p=>p.familyId===pair[0].familyId));
assert.equal(await store.pair({counts:[{type:'B',min:6,max:0}]}),null);
writeFileSync(new URL('../target/packing-perf-after.json',import.meta.url),JSON.stringify(report,null,2));
console.log('PASS: reusable filter memory, independent predicate checks, lazy random pairs. Timings:',JSON.stringify(report));
