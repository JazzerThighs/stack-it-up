import fs from 'node:fs';
import assert from 'node:assert/strict';
import {displayIndex, canonicalColor, displayIdentity, packingCells} from '../web/explorer/model.js';
const normalize=p=>{const r=Math.min(...p.map(q=>q[0])),c=Math.min(...p.map(q=>q[1]));return p.map(([a,b])=>[a-r,b-c].join(',')).sort().join(';');};
const shapes={J:[[0,0],[1,0],[1,1],[1,2]],L:[[0,2],[1,0],[1,1],[1,2]],S:[[0,1],[0,2],[1,0],[1,1]],Z:[[0,0],[0,1],[1,1],[1,2]],O:[[0,0],[0,1],[1,0],[1,1]],T:[[0,0],[0,1],[0,2],[1,1]]};
const lookup=new Map();
for(const [name,shape] of Object.entries(shapes)){let p=shape;for(let i=0;i<4;i++){lookup.set(normalize(p),name);p=p.map(([r,c])=>[c,-r]);}}
const expected={J:'b',L:'o',S:'g',Z:'r',O:'y',T:'m'}, faces=new Set();let checked=0;
const xyz=i=>[Math.floor(i/9),Math.floor(i/3)%3,i%3];
const rows=fs.readFileSync(new URL('../web/explorer/packings_with_metadata.txt',import.meta.url),'utf8').trim().split(/\r?\n/).slice(0,2000);
for(const line of rows){
 const fields=line.split(/\s+/),masks=fields.slice(0,6).map(x=>parseInt(x,16)),identities=fields[8],colors=Array(27).fill('d');
 for(let id=0;id<6;id++)for(let i=0;i<27;i++)if(masks[id]&(1<<i))colors[i]=canonicalColor(identities[id]);
 const rendered=packingCells({masks},colors);
 for(let id=0;id<6;id++){
  const points=Array.from({length:27},(_,i)=>i).filter(i=>masks[id]&(1<<i)).map(i=>xyz(displayIndex(i)));
  for(let axis=0;axis<3;axis++)for(const side of [0,2]){
   if(!points.every(p=>p[axis]===side))continue;
   // Independent outward-facing screen basis: right cross up = face normal.
   const projection=points.map(([x,y,z])=>axis===2?[-y,side===2?x:-x]:axis===1?[side===2?z:-z,x]:[-y,side===2?-z:z]);
   const actual=lookup.get(normalize(projection));assert(actual);
   assert.equal(displayIdentity(identities[id]),actual);
   for(const cell of rendered.filter(c=>c.piece===id))assert.equal(cell.color,expected[actual]);
   faces.add(`${axis}/${side}`);checked++;
  }
 }
}
assert.equal(faces.size,6);
console.log(`PASS: ${checked} outward-facing piece/color checks across all six faces.`);
