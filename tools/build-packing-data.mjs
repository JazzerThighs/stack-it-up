import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile,writeFile,mkdir,cp,stat} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import {gzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=JSON.parse(await readFile(path.join(root,'data/source.json'),'utf8'));
const archive=path.join(root,source.archive),hash=createHash('sha256');
for await(const chunk of createReadStream(archive))hash.update(chunk);
if(hash.digest('hex')!==source.sha256)throw Error('Packing archive checksum mismatch');
const compiler=createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex').slice(0,12);
const version=`${source.sha256.slice(0,12)}-${compiler}`;
const cache=path.join(root,'.packing-cache',version),raw=path.join(cache,'source'),built=path.join(cache,'built');
const output=path.resolve(root,process.argv[2]||'dist/explorer/data');
const exists=async p=>!!await stat(p).catch(()=>null);
if(!await exists(path.join(built,'manifest.json'))) {
  await mkdir(raw,{recursive:true});await mkdir(built,{recursive:true});
  let extracted=false;
  for(const command of [process.env.SEVEN_ZIP,'7z','7zz','C:\\Program Files\\7-Zip\\7z.exe'].filter(Boolean)) {
    const r=spawnSync(command,['x','-y',`-o${raw}`,archive,...source.files],{stdio:'pipe'});
    if(r.error?.code==='ENOENT')continue;
    if(r.status!==0)throw Error(`Archive extraction failed: ${r.stderr||r.stdout}`);
    extracted=true;break;
  }
  if(!extracted)throw Error('Install 7-Zip (7z/7zz) or set SEVEN_ZIP to its executable');
  const csv=async name=>{
    const lines=(await readFile(path.join(raw,name),'utf8')).trim().split(/\r?\n/),header=lines.shift().split(',');
    return lines.map(line=>Object.fromEntries(line.split(',').map((v,i)=>[header[i],v])));
  };
  const schema=JSON.parse(await readFile(path.join(raw,'schema.json'),'utf8'));
  if(schema.version!==2)throw Error('Unsupported metadata schema');
  const catalog=(await csv('piece_catalog.csv')).map(p=>({...p,mask:parseInt(p.mask,16)}));
  const byMask=new Map(catalog.map((p,i)=>[p.mask,i]));
  if(catalog.length!==580)throw Error('Incomplete piece catalog');
  const families=(await csv('families.csv')).map(f=>({...f,id:+f.family_id,count:+f.members}));
  const familyMap=new Map(families.map(f=>[f.id,f]));
  if(families.length!==source.familyCount)throw Error('Wrong family count');
  const index=Buffer.alloc(source.packingCount*20),records=new Uint16Array(source.packingCount*6);
  const seen=new Uint8Array(source.packingCount),memberSeen=new Uint8Array(source.packingCount);
  const members=new Map(families.map(f=>[f.id,[]])),bags=[],bagIds=new Map();
  const bagID=bag=>{if(!bagIds.has(bag)){bagIds.set(bag,bags.length);bags.push(bag);}return bagIds.get(bag);};
  let family=0,total=0;
  for await(const line of createInterface({input:createReadStream(path.join(raw,'refined_families.txt')),crlfDelay:Infinity})) {
    if(line.startsWith('FAMILY ')) {
      const f=line.split(/\s+/);family=+f[1];
      if(!familyMap.has(family))throw Error('Unknown family');continue;
    }
    if(!line.trimStart().startsWith('line='))continue;
    const f=line.trim().split(/\s+/),id=+f[0].slice(5),i=id-1;
    if(!family||i<0||i>=seen.length||seen[i]++||f.length!==14)throw Error(`Bad member ${id}`);
    const masks=f.slice(3,9).map(x=>parseInt(x,16));let occupied=0;
    const pieces=masks.map((m,j)=>{
      if((m&occupied)||!byMask.has(m))throw Error(`Invalid masks at ${id}`);
      occupied|=m;const k=byMask.get(m);records[i*6+j]=k;return catalog[k];
    });
    const extras=parseInt(f[9].slice(7),16),identities=pieces.map(p=>p.identity).join('');
    const scores=pieces.map(p=>p.score).join(''),score=[...scores].sort().join('');
    const facebound=pieces.every(p=>p.facebound==='1');
    const flags=Number(!!(extras&(1<<13)))|(+facebound<<1)|(+([...identities].sort().join('')==='JLOSTZ')<<2);
    if(extras!==(((1<<27)-1)^occupied))throw Error(`Bad extras at ${id}`);
    if(f[1]!==`identities=${identities}`||f[2]!==`scores=${scores}`||f[10]!==flags.toString(16)||f[11]!==identities||f[12]!==scores||f[13]!==score)throw Error(`Metadata mismatch at ${id}`);
    const at=i*20;index.writeUInt16LE(family,at);index.writeUInt16LE(bagID([...identities].sort().join('')),at+2);index[at+4]=flags;
    for(let j=0;j<6;j++) {
      if(pieces[j].spatial==='1')index[at+5]|=1<<j;
      if(pieces[j].core==='1')index[at+6]|=1<<j;
      if(pieces[j].nonfacebound_planar==='1')index[at+7]|=1<<j;
      index[at+10+j]=identities.charCodeAt(j);
    }
    const cells=Array.from({length:27},(_,j)=>j).filter(j=>extras&(1<<j)).map(j=>[Math.floor(j/9),Math.floor(j/3)%3,j%3]);
    for(const p of cells)index[at+8]|=1<<p.filter(v=>v!==1).length;
    index[at+9]=+([0,1,2].some(a=>[0,1,2].every(b=>a===b||cells.every(p=>p[b]===cells[0][b]))));
    index.writeUInt32LE(members.get(family).length,at+16);members.get(family).push(id);total++;
  }
  if(total!==source.packingCount||seen.some(n=>n!==1))throw Error('Missing packing rows');
  let header;
  for await(const line of createInterface({input:createReadStream(path.join(raw,'membership.csv')),crlfDelay:Infinity})) {
    const f=line.split(',');if(!header){header=Object.fromEntries(f.map((v,i)=>[v,i]));continue;}
    const id=+f[header.source_line],i=id-1,at=i*20;
    if(i<0||i>=seen.length||memberSeen[i]++)throw Error('Invalid membership ID');
    const expected={family_id:index.readUInt16LE(at),flags:index[at+4],identities:index.toString('ascii',at+10,at+16),spatial_piece_bits:index[at+5],core_piece_bits:index[at+6],nonfacebound_planar_piece_bits:index[at+7]};
    for(const [k,v]of Object.entries(expected))if(String(v)!==f[header[k]])throw Error(`Membership disagreement: ${id} ${k}`);
  }
  if(memberSeen.some(n=>n!==1))throw Error('Missing membership rows');
  const assets={};
  async function save(name,bytes) {
    const gz=gzipSync(bytes,{level:9});await writeFile(path.join(built,name),gz);
    assets[name]={bytes:bytes.length,compressedBytes:gz.length,sha256:createHash('sha256').update(gz).digest('hex')};
  }
  await save('index.bin.gz',index);
  for(const f of families) {
    const ids=members.get(f.id);if(ids.length!==f.count)throw Error(`Family ${f.id} count mismatch`);
    const bytes=Buffer.alloc(ids.length*16);
    ids.forEach((id,j)=>{bytes.writeUInt32LE(id,j*16);for(let k=0;k<6;k++)bytes.writeUInt16LE(records[(id-1)*6+k],j*16+4+k*2);});
    await save(`family-${f.id}.bin.gz`,bytes);
  }
  const manifest={format:1,dataset:'tetracubes-v2',version,sourceSha256:source.sha256,count:total,indexStride:20,recordStride:16,catalog,bags,families,schema,assets};
  await writeFile(path.join(built,'manifest.json'),JSON.stringify(manifest));
  console.log(`Converted ${total} packings in ${families.length} families`);
}
await mkdir(output,{recursive:true});await cp(built,output,{recursive:true});
console.log(`Local packing assets: ${output}`);
