import assert from 'node:assert/strict';
import {visualSettings} from '../web/render/visual-settings.js';
import {bracketCell} from '../web/render/text-mesh.js';
import {gameboyCell} from '../web/render/gameboy-mesh.js';
import {identitySolid} from '../web/render/identity-solids.js';
import {angularPiece} from '../web/render/angular-mesh.js';
import {refreshStyleTuning} from '../web/ui/style-tuning.js';
for(const generate of [bracketCell,gameboyCell,(o,p,h,c)=>identitySolid(o,p,h,c,0)]){
 visualSettings.cubieScale=100;const full=[];generate(full,[1,0,-1],.465,[1,1,1]);
 visualSettings.cubieScale=40;const small=[];generate(small,[1,0,-1],.465,[1,1,1]);
 assert.equal(full.length,small.length);
 for(let i=0;i<full.length;i+=9)for(let a=0;a<3;a++)assert(Math.abs(small[i+a]-[1,0,-1][a]-(full[i+a]-[1,0,-1][a])*.4)<1e-6);
}
// Size the bars before tessellation; shared surfaces must stay planar.
for(const scale of [.4,.7,1]){
 visualSettings.cubieScale=scale*100;
 const mesh=angularPiece((1<<12)|(1<<13)|(1<<14),[1,1,1]);
 assert(mesh.every(Number.isFinite));
 assert(Math.max(...mesh.filter((_,i)=>i%9===2))>1);
 assert(Math.max(...mesh.filter((_,i)=>i%9===0))<=.466*scale+1e-5);

}
visualSettings.cubieScale=100;
const nodes=new Map(),root={getElementById(id){if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);}},el=id=>root.getElementById(id);
for(const shape of ['angular','jelly','text','gameboy'])for(const effect of ['jelly','dither','ascii']){
 el('modelShape').value=shape;el('pieceAppearance').value=effect;el('jellyCornerO').checked=false;el('ditherTransparency').checked=false;refreshStyleTuning(root);
 assert.equal(el('jellyShaping').hidden,!['angular','jelly'].includes(shape));assert.equal(el('jellyProfileOptions').hidden,shape!=='jelly');assert(el('jellyOpeningOptions').hidden);
 assert.equal(el('ditherInline').hidden,effect!=='dither');assert.equal(el('asciiInline').hidden,effect!=='ascii');assert.equal(el('transparencyTuning').hidden,effect!=='dither');
}
console.log('PASS: cubie scaling, connected bar dimensions and continuous seams, and conditional inline settings.');
// Every emitted Tengen triangle must stay on its declared plane after sizing.
for(const ring of [0,1])for(const scale of [40,65,100]){
 visualSettings.jellyCornerO=ring;visualSettings.cubieScale=scale;
 for(const mask of [(1<<13)|(1<<22)|(1<<16),(1<<0)|(1<<1)|(1<<3)|(1<<4)]){
  const m=angularPiece(mask);
  for(let i=0;i<m.length;i+=27){
   const n=m.slice(i+3,i+6),a=m.slice(i,i+3);
   for(const offset of [9,18])assert(Math.abs(n.reduce((v,x,k)=>v+x*(m[i+offset+k]-a[k]),0))<1e-6,'Sized faces remain planar');
  }
 }
}
visualSettings.cubieScale=100;visualSettings.jellyCornerO=0;
console.log('PASS: sized Tengen elbows and O rings retain planar faces.');
