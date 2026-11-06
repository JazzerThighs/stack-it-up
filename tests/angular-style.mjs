import assert from 'node:assert/strict';
import {angularPiece} from '../web/render/angular-mesh.js';
import {setVisualSetting,resetVisualSettings} from '../web/render/visual-settings.js';
import {compositeParts} from '../web/render/piece-mesh.js';
for(const cells of [[0],[0,1],[0,1,2],[0,1,3],[0,1,2,5],[0,1,3,4],[0,1,3,10],[0,1,9,12]]) {
 const mask=cells.reduce((m,i)=>m|1<<i,0);
 for(const width of [15,30,48]) {
  setVisualSetting('jellyBevel',width);
  const mesh=angularPiece(mask);assert(mesh.length>0);assert.equal(mesh.length%27,0);assert(mesh.every(Number.isFinite));
  for(let i=0;i<mesh.length;i+=27){
   const n=Array.from(mesh.slice(i+3,i+6));assert(Math.abs(Math.hypot(...n)-1)<1e-6);
   for(const offset of [9,18])assert.deepEqual(Array.from(mesh.slice(i+offset+3,i+offset+6)),n);
   // Every polygon normal is axial or an exact 45-degree chamfer normal.
   const positive=n.map(Math.abs).filter(v=>v>1e-6);assert(positive.every(v=>Math.abs(v-positive[0])<1e-6));
   const a=mesh.slice(i,i+3),b=mesh.slice(i+9,i+12),c=mesh.slice(i+18,i+21);
   const u=b.map((v,k)=>v-a[k]),v=c.map((v,k)=>v-a[k]);
   const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
   assert(cross.reduce((sum,v,k)=>sum+v*n[k],0)>0);
  }
 }
}
const mask=39;setVisualSetting('jellyBevel',15);const narrow=angularPiece(mask);
setVisualSetting('jellyBevel',48);assert.notDeepEqual(angularPiece(mask),narrow);
const board=Array(27).fill(0);for(const i of [0,1,2,5])board[i]=1;
assert(compositeParts(board,Array(27).fill(1),['','#ff0000'],()=>{throw Error('Angular must not use marching mesh');},'angular')[0].length>0);
resetVisualSettings('jelly');console.log('PASS: angular pieces and fragments have finite planar faces, hard chamfer normals, outward winding, and independent native-free geometry.');

// Rays through joined pieces must enter and exit in pairs, including square O rings.
for(const ring of [0,1]) {
 setVisualSetting('jellyCornerO',ring);
 for(const mask of [1,3,7,11,27,39,1035]) {
  const mesh=angularPiece(mask);
  for(let y=-1.47;y<1.5;y+=.231)for(let z=-1.43;z<1.5;z+=.217){
   const hits=[];
   for(let i=0;i<mesh.length;i+=27){
    const a=mesh.slice(i,i+3),b=mesh.slice(i+9,i+12),c=mesh.slice(i+18,i+21);
    const det=(b[1]-a[1])*(c[2]-a[2])-(c[1]-a[1])*(b[2]-a[2]);if(Math.abs(det)<1e-9)continue;
    const u=((y-a[1])*(c[2]-a[2])-(c[1]-a[1])*(z-a[2]))/det;
    const v=((b[1]-a[1])*(z-a[2])-(y-a[1])*(b[2]-a[2]))/det;
    if(u>=0&&v>=0&&u+v<=1)hits.push(a[0]+u*(b[0]-a[0])+v*(c[0]-a[0]));
   }
   hits.sort((a,b)=>a-b);const unique=hits.filter((x,i)=>!i||x-hits[i-1]>1e-5);
   assert.equal(unique.length%2,0,`Open surface for ${mask}, ring ${ring}`);
  }
 }
}
resetVisualSettings('jelly');
console.log('PASS: joined angular solids and O rings have closed ray-tested surfaces.');

// Ring O must share the solid O's outer bounds for every shaping setting.
const bounds=mesh=>[0,1,2].map(k=>{const values=[];for(let i=k;i<mesh.length;i+=9)values.push(mesh[i]);return [Math.min(...values),Math.max(...values)];});
for(const mask of [27,1539,4617])for(const bevel of [15,30,48])for(const opening of [18,24,40]){
 setVisualSetting('jellyBevel',bevel);setVisualSetting('jellyOpening',opening);
 setVisualSetting('jellyCornerO',false);const solid=bounds(angularPiece(mask));
 setVisualSetting('jellyCornerO',true);const ring=bounds(angularPiece(mask));
 ring.flat().forEach((v,i)=>assert(Math.abs(v-solid.flat()[i])<1e-6,`O bounds differ: ${mask}, ${bevel}, ${opening}`));
}
resetVisualSettings('jelly');console.log('PASS: Tengen ring O matches solid-piece outer dimensions across bevel/opening settings.');
