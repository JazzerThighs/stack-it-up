import assert from 'node:assert/strict';
import {countSpecs,identityCount,indexedCounts,familyExtraCounts,presetCounts} from '../web/explorer/filter-counts.js';
import {extraShapeFlags} from '../web/explorer/puzzle-shapes.js';
import {store,manifest} from './packing-fixture.mjs';
assert.equal(identityCount('JLjjSZs','J'),1);assert.equal(identityCount('JLjjSZs','JL'),4);assert.equal(identityCount('JLjjSZs','SZ'),3);
const point=i=>[Math.floor(i/9),Math.floor(i/3)%3,i%3];
const adjacency=(a,b)=>point(a).reduce((s,v,j)=>s+Math.abs(v-point(b)[j]),0)===1;
for(let a=0;a<27;a++)for(let b=a+1;b<27;b++)for(let c=b+1;c<27;c++){
 const cells=[a,b,c],remaining=new Set(cells),groups=[];
 while(remaining.size){const group=[remaining.values().next().value];remaining.delete(group[0]);for(let k=0;k<group.length;k++)for(const v of remaining)if(adjacency(group[k],v)){group.push(v);remaining.delete(v);}groups.push(group);}
 const values=indexedCounts(0,0,0,0,extraShapeFlags((1<<a)|(1<<b)|(1<<c)),{});
 assert.equal(values.ExtraSingle,groups.filter(g=>g.length===1).length);assert.equal(values.ExtraDomino,groups.filter(g=>g.length===2).length);
 assert.equal(values.ExtraV+values.ExtraBar,groups.filter(g=>g.length===3).length);
}
for(const family of manifest.families){const e=familyExtraCounts(family.invariant);assert.equal(Object.values(e).reduce((a,b)=>a+b),3);}
const query=count=>{store.filter({counts:count});return store.selected.length;};
const range=(type,min,max=min)=>({type,min,max});
for(const [type,max]of [['ExtraCore',1],['ExtraSingle',3],['CorePieces',1]]){
 let total=0;for(let n=0;n<=max;n++)total+=query([range(type,n)]);assert.equal(total,manifest.count);
}
for(const preset of ['planar','spatial','surface','nonface','face','core','six','official','soma','sloth']){
 const p=presetCounts(preset),counts=Object.entries(p.ranges).map(([type,r])=>({type,...r}));
 const result=await store.query({filters:{counts,family:p.family},random:true});
 assert(result.count>0,`${preset} has matches`);
 const r=result.record;
 if(preset==='official')assert.equal(r.familyId,562);
 if(preset==='six'){assert.equal(identityCount(r.identities,'O'),1);assert.equal(identityCount(r.identities,'T'),1);assert.equal(identityCount(r.identities,'JL'),2);assert.equal(identityCount(r.identities,'SZ'),2);}
 if(preset==='sloth')assert.equal(r.bag.toUpperCase(),'OOOOOO');
 if(preset==='soma')assert(extraShapeFlags(r.extras)&2);
 const actual={ExtraCore:0,ExtraCenters:0,ExtraEdges:0,ExtraCorners:0};
 for(let i=0;i<27;i++)if(r.extras&(1<<i))actual[['ExtraCore','ExtraCenters','ExtraEdges','ExtraCorners'][point(i).filter(v=>v!==1).length]]++;
 assert.deepEqual(familyExtraCounts(manifest.families.find(f=>f.id===r.familyId).invariant),actual);
}
console.log('PASS: exact/free identities, all 2925 extra shapes, full-database count partitions, presets and coordinate counts.');

// Presets compose with current ranges/family; equivalent exclusions need not be explicit.
const combined=presetCounts('surface',presetCounts('planar').ranges);
assert.equal(combined.ranges.B.max,0);assert.deepEqual(combined.ranges.ExtraCore,{min:1,max:1});
const custom=presetCounts('soma').ranges;
assert.deepEqual(presetCounts('official',custom).ranges,custom);
assert.equal(presetCounts('official',custom).family,562);
const six=presetCounts('six').ranges;
const accepts=(bag,ranges)=>Object.entries(ranges).filter(([id])=>['J','L','O','T','S','Z','JL','SZ','B','D','F'].includes(id)).every(([id,r])=>{const n=identityCount(bag,id);return n>=r.min&&n<=r.max;});
for(const bag of ['JJOSTZ','JLOSTZ','LLOTZZ','jjOTss'])assert(accepts(bag,six),bag);
for(const bag of ['JLOOTT','JJOSTB'])assert(!accepts(bag,six),bag);
const faceSix=presetCounts('faceSix',{},562);
assert.equal(faceSix.family,562,'presets preserve family unless explicitly changing it');
assert.deepEqual(faceSix.ranges.Facebound,{min:6,max:6});
assert(accepts('JLOSTZ',faceSix.ranges));
for(const bag of ['JJOSTZ','LLOTZZ','jjOTss'])assert(!accepts(bag,faceSix.ranges),bag);
const counts=Object.entries(faceSix.ranges).map(([type,r])=>({type,...r}));
const faceResult=await store.query({filters:{counts},position:0});
assert(faceResult.count>0);
assert.equal(faceResult.record.bag.toUpperCase().split('').sort().join(''),'JLOSTZ');
const allPieces=presetCounts('pieces',presetCounts('face').ranges);
assert.deepEqual(allPieces.ranges.Facebound,{min:6,max:6});assert.deepEqual(allPieces.ranges.D,{min:0,max:6});
console.log('PASS: aggregate six versus exact faceSix, composable ranges and preserved family selection.');
