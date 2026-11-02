// Small regression samples decoded from the one shipping database, never a legacy copy.
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {PackingStore,OFFICIAL_MASKS} from '../web/explorer/data-store.js';
const release=JSON.parse(fs.readFileSync(new URL('../dist/build-info.json',import.meta.url),'utf8'));
const base=new URL(`../dist/${release.assets}/explorer/data/`,import.meta.url);
export const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',base),'utf8'));
const load=async name=>gunzipSync(fs.readFileSync(new URL(name,base)));
export const store=new PackingStore(manifest,await load('index.bin.gz'),load);
export const client={info:{...manifest,officialFamily:store.officialFamily},query:o=>store.query(o),record:id=>store.record(id),pair:f=>store.pair(f),lookup:(f,m)=>store.lookup(f,m)};
export const official=(await store.lookup(store.officialFamily,OFFICIAL_MASKS))[0];
export const officialReference={...official,masks:OFFICIAL_MASKS,extras:0x803000,identities:[...'JZLSOT']};
store.filter({surfaceOnly:true,allSurfaceIdentities:true,spatial:'none'});
const groups=new Map();
for(const id of store.selected){const family=store.index.getUint16((id-1)*20,true);if(!groups.has(family))groups.set(family,[]);if(groups.get(family).length<12)groups.get(family).push(id);}
export const packings=[];
for(const ids of groups.values())for(const id of ids)packings.push(await store.record(id));
if(!packings.some(p=>p.lineNumber===official.lineNumber))packings.push(official);
export const familyByLine=new Map(),families=[];
for(const p of packings){let family=families.find(f=>f.id===p.familyId);if(!family){family={id:p.familyId,members:[]};families.push(family);}family.members.push(p);familyByLine.set(p.lineNumber,{family});}
export const rows=packings.map(p=>p.code+' '+p.flags+' '+p.identities.join(''));
