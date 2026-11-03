import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {extraShapeFlags,isSomaBag} from '../web/explorer/puzzle-shapes.js';
import {PackingStore} from '../web/explorer/data-store.js';
import {ROTATIONS} from '../web/explorer/model.js';
const mask=cells=>cells.reduce((m,i)=>m|(1<<i),0);
assert.equal(extraShapeFlags(mask([0,1,2])),5);
assert.equal(extraShapeFlags(mask([0,1,3])),6);
assert.equal(extraShapeFlags(mask([0,1,26])),4);
assert.equal(extraShapeFlags(mask([0,13,26])),0);
assert.equal(extraShapeFlags(mask([2,3,26])),0,'row wrapping is not adjacency');
for(let a=0;a<27;a++)for(let b=a+1;b<27;b++)for(let c=b+1;c<27;c++) {
 const m=mask([a,b,c]),flags=extraShapeFlags(m);
 for(const r of ROTATIONS)assert.equal(extraShapeFlags(mask([r[a],r[b],r[c]])),flags);
}
for(const bag of ['BDFLST','bdfjzt'])assert(isSomaBag(bag));
for(const bag of ['JLOSTZ','BDDLST','BDFOST','BDFLSS'])assert(!isSomaBag(bag));
const release=JSON.parse(fs.readFileSync(new URL('../dist/build-info.json',import.meta.url)));
const base=new URL(`../dist/${release.assets}/explorer/data/`,import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',base)));
assert.equal(manifest.extraShapeFlags,1);
const load=name=>gunzipSync(fs.readFileSync(new URL(name,base)));
const store=new PackingStore(manifest,load('index.bin.gz'),async name=>load(name));
for(const [filter,bit]of [['iTunnelOnly',1],['somaVOnly',2],['somaSetOnly',2],['dominoGapOnly',4]]) {
 store.filter({[filter]:true});assert(store.selected.length>0,filter);
 const ids=store.selected.slice();
 for(const id of [ids[0],ids[Math.floor(ids.length/2)],ids.at(-1)]) {
  const record=await store.record(id);assert(extraShapeFlags(record.extras)&bit);
  if(filter==='somaSetOnly')assert(isSomaBag(record.bag));
 }
 console.log(`${filter}: ${ids.length.toLocaleString()} packings`);
}
store.filter({somaVOnly:true,iTunnelOnly:true});assert.equal(store.selected.length,0);
store.filter({somaSetOnly:true,spatial:'none'});assert.equal(store.selected.length,0);
console.log('PASS: all 2,925 extra masks are rotation invariant; real database filters and incompatible combinations.');
