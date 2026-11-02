import {ROTATIONS,cellsOf} from './model.js';
const FULL=(1<<27)-1;
export const OFFICIAL_MASKS=[0xf,0xf0,0x40e00,0x780000,0x3018000,0x4024100];
const kind=i=>[Math.floor(i/9),Math.floor(i/3)%3,i%3].filter(v=>v!==1).length;
const centers=[4,10,12,14,16,22];
export function invariant(masks,extras) {
  const descriptor=(mask,r)=>{
    let c=0,e=0,s=0,core=0;for(const i of cellsOf(mask)) {
      const k=kind(i);if(k===3)c++;else if(k===2)e++;else if(k===1)s|=1<<centers.indexOf(r[i]);else core=1;
    }return (core<<15)|(c<<9)|(e<<6)|s;
  };
  return ROTATIONS.map(r=>[...masks.map(m=>descriptor(m,r)).sort((a,b)=>a-b),descriptor(extras,r)]
    .map(n=>n.toString(16).padStart(4,'0')).join('-')).sort()[0];
}
const maskKey=masks=>masks.slice().sort((a,b)=>a-b).join(',');
export class PackingStore {
  constructor(manifest,index,loadAsset,report=()=>{}) {
    this.report=report;
    if(manifest.format!==1||index.byteLength!==manifest.count*20)throw Error('Invalid packing index');
    this.manifest=manifest;this.index=new DataView(index.buffer,index.byteOffset,index.byteLength);
    this.loadAsset=loadAsset;this.cache=new Map();this.cacheBytes=0;this.selectionBuffer=new Uint32Array(manifest.count);this.selected=this.selectionBuffer.subarray(0,0);
    this.familyMap=new Map(manifest.families.map(f=>[f.id,f]));this.queryKey=null;
    const officialKey=invariant(OFFICIAL_MASKS,FULL^OFFICIAL_MASKS.reduce((a,b)=>a|b,0));
    this.officialFamily=manifest.families.find(f=>f.invariant===officialKey)?.id;
  }
  async family(id) {
    if(!this.familyMap.has(+id))throw Error('Unknown family');
    if(this.cache.has(+id)){const v=this.cache.get(+id);this.cache.delete(+id);this.cache.set(+id,v);return v;}
    const bytes=await this.loadAsset(`family-${id}.bin.gz`),count=this.familyMap.get(+id).count;
    if(bytes.byteLength!==count*16)throw Error('Invalid family data length');
    const entry={view:new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),bytes:bytes.byteLength};
    while(this.cache.size&&(this.cache.size>=8||this.cacheBytes+entry.bytes>24*1024*1024)) {
      const key=this.cache.keys().next().value;this.cacheBytes-=this.cache.get(key).bytes;this.cache.delete(key);
    }
    this.cache.set(+id,entry);this.cacheBytes+=entry.bytes;
    this.report({phase:"cache",loaded:count,total:count,family:+id,cacheBytes:this.cacheBytes});return entry;
  }
  decode(id,view,offset) {
    const at=(id-1)*20,m=this.manifest,indices=Array.from({length:6},(_,i)=>view.getUint16(offset+4+i*2,true));
    if(indices.some(i=>!m.catalog[i]))throw Error('Invalid catalog entry');
    const ps=indices.map(i=>m.catalog[i]),masks=ps.map(p=>p.mask),extras=FULL^masks.reduce((a,b)=>a|b,0),flags=this.index.getUint8(at+4);
    const identities=ps.map(p=>p.identity),scores=ps.map(p=>p.score).join('');
    return {dataset:m.dataset,version:m.version,lineNumber:id,masks,extras,identities,flags,
      familyId:this.index.getUint16(at,true),bag:m.bags[this.index.getUint16(at+2,true)],
      surfaceOnly:!!(flags&1),allSurfaceIdentities:!!(flags&2),oneOfEach:!!(flags&4),
      spatialBits:this.index.getUint8(at+5),coreBits:this.index.getUint8(at+6),nonfaceboundPlanarBits:this.index.getUint8(at+7),
      pieceScores:scores,score:[...scores].sort().join(''),
      code:masks.map(n=>n.toString(16).padStart(7,'0')).join(' ')+` extras=${extras.toString(16).padStart(7,'0')}`};
  }
  async record(id) {
    if(!Number.isSafeInteger(+id)||id<1||id>this.manifest.count)throw Error('Source line not found');
    const at=(id-1)*20,family=this.index.getUint16(at,true),offset=this.index.getUint32(at+16,true)*16;
    const {view}=await this.family(family);
    if(view.getUint32(offset,true)!==+id)throw Error('Index/family disagreement');
    return this.decode(+id,view,offset);
  }
  filter(filters={}) {
    const key=JSON.stringify(filters);if(key===this.queryKey)return;
    const output=this.selectionBuffer,counts=new Uint32Array(this.manifest.families.length+1);
    const v=this.index;let n=0;
    const bag=filters.bag?this.manifest.bags.indexOf(filters.bag):-1;
    // Compile composition predicates once per identity bag, never per packing.
    const constrained=(filters.counts||[]).filter(c=>c.min>0||c.max<6);
    const matches=(id,type)=>type==='JL'?'JL'.includes(id):type==='SZ'?'SZ'.includes(id):id===type;
    const allowedBags=constrained.length?this.manifest.bags.map(b=>constrained.every(({type,min,max})=>{
      let count=0;for(const id of b.toUpperCase())if(matches(id,type))count++;
      return count>=min&&count<=max;
    })):null;
    const coreLetters=filters.coreType?new Set([...filters.coreType].map(c=>c.charCodeAt(0))):null;
    let requireExtras=0,excludeExtras=0;
    for(const [name,k]of [['extraCenters',1],['extraEdges',2],['extraCorners',3]]) {
      if(filters[name]==='yes')requireExtras|=1<<k;
      if(filters[name]==='no')excludeExtras|=1<<k;
    }
    for(let i=0;i<this.manifest.count;i++) {
      if(i%32768===0)this.report({phase:"filter",loaded:i,total:this.manifest.count});
      const a=i*20,f=v.getUint16(a,true),flags=v.getUint8(a+4),sp=v.getUint8(a+5),core=v.getUint8(a+6),span=v.getUint8(a+7);
      if(filters.surfaceOnly&&!(flags&1)||filters.nonSurfaceOnly&&(flags&1)||filters.allSurfaceIdentities&&!(flags&2)||filters.oneOfEach&&!(flags&4))continue;
      if(filters.officialOnly&&f!==this.officialFamily)continue;
      if(filters.iTunnelOnly&&!v.getUint8(a+9))continue;
      if(filters.nonFaceboundSurface&&(!(flags&1)||!span))continue;
      if(filters.bag&&(bag<0||v.getUint16(a+2,true)!==bag))continue;
      if(filters.spatial==='none'&&sp||filters.spatial==='only'&&sp!==63||filters.spatial==='mixed'&&(!sp||sp===63))continue;
      if(filters.planar==='none'&&span||filters.planar==='any'&&!span||filters.planar==='surface'&&!(span&~core)||filters.planar==='core'&&!(span&core))continue;
      const extra=v.getUint8(a+8);
      if((extra&requireExtras)!==requireExtras||(extra&excludeExtras))continue;
      if(allowedBags&&!allowedBags[v.getUint16(a+2,true)])continue;
      if(coreLetters) {
        let found=false;
        for(let j=0;j<6;j++)if((core&(1<<j))&&coreLetters.has(v.getUint8(a+10+j)&~32)){found=true;break;}
        if(!found)continue;
      }
      counts[f]++;
      if(!filters.family||f===+filters.family)output[n++]=i+1;
    }
    this.report({phase:"filter",loaded:this.manifest.count,total:this.manifest.count});
    this.selected=output.subarray(0,n);this.familyCounts=counts;this.queryKey=key;
  }
  async query({filters={},position=0,random=false,line,offset=0}={}) {
    this.filter(filters);const ids=this.selected,n=ids.length;
    let p=line?ids.indexOf(+line):position;if(p<0)p=0;
    p=random?Math.floor(Math.random()*n):((p+offset)%n+n)%n;
    return {count:n,position:n?p:0,record:n?await this.record(ids[p]):null,familyCounts:Array.from(this.familyCounts)};
  }
  async pair(filters) {
    this.filter(filters);
    const eligible=[];
    for(let f=1;f<this.familyCounts.length;f++)if(this.familyCounts[f]>1&&(!filters?.family||f===+filters.family))eligible.push(f);
    if(!eligible.length)return null;
    const family=eligible[Math.floor(Math.random()*eligible.length)],count=this.familyCounts[family];
    const a=Math.floor(Math.random()*count),b=(a+1+Math.floor(Math.random()*(count-1)))%count;
    let position=0,first,second;
    for(const id of this.selected)if(this.index.getUint16((id-1)*20,true)===family) {
      if(position===a)first=id;if(position===b)second=id;
      if(first&&second)break;position++;
    }
    return [await this.record(first),await this.record(second)];
  }

  async lookup(family,masks) {
    const entry=await this.family(+family);
    if(!entry.lookup) {
      entry.lookup=new Map();
      this.report({phase:"lookup",loaded:0,total:entry.bytes/16});
      for(let at=0;at<entry.bytes;at+=16) {
        if(at%65536===0)this.report({phase:"lookup",loaded:at/16,total:entry.bytes/16});
        const id=entry.view.getUint32(at,true);
        const masks=Array.from({length:6},(_,i)=>this.manifest.catalog[entry.view.getUint16(at+4+i*2,true)].mask),key=maskKey(masks);
        entry.lookup.set(key,id);
      }
    }
    this.report({phase:"lookup",loaded:entry.bytes/16,total:entry.bytes/16});
    const found=new Set();
    for(const rotation of ROTATIONS) {
      const key=maskKey(masks.map(m=>cellsOf(m).reduce((n,i)=>n|(1<<rotation[i]),0)));
      const id=entry.lookup.get(key);if(id)found.add(id);
    }
    return Promise.all([...found].map(id=>this.record(id)));
  }
}
