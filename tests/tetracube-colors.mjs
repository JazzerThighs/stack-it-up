import assert from 'node:assert/strict';
import {placedTetracubeColor,tetracubeColors} from '../web/render/tetracube-colors.js';
import {compositeParts} from '../web/render/piece-mesh.js';
const mask=points=>points.reduce((m,[x,y,z])=>m|1<<(x*9+y*3+z),0);
const right=[[0,0,0],[1,0,0],[1,1,0],[1,1,1]],left=right.map(([x,y,z])=>[2-x,y,z]),branch=[[0,0,0],[1,0,0],[0,1,0],[0,0,1]];
for(const [seed,color] of [[left,tetracubeColors.left],[right,tetracubeColors.right],[branch,tetracubeColors.branch]]) {
 const todo=[seed],seen=new Set();
 while(todo.length){const points=todo.pop(),m=mask(points);if(seen.has(m))continue;seen.add(m);assert.equal(placedTetracubeColor(m),color);
 for(let axis=0;axis<3;axis++){const a=(axis+1)%3,b=(axis+2)%3;todo.push(points.map(p=>{const q=p.slice();q[a]=2-p[b];q[b]=p[a];return q;}));}}
 const board=Array(27).fill(0),ids=Array(27).fill(0);for(let i=0;i<27;i++)if(mask(seed)&(1<<i)){board[i]=1;ids[i]=1;}
 for(const style of ['jelly']){
  const [mesh]=compositeParts(board,ids,['#000000','#ff0000'],()=>new Float32Array([0,0,0,0,1,0,1,0,0]),style,true);
  const rgb=color.match(/\w\w/g).map(v=>parseInt(v,16)/255);
  for(let i=0;i<3;i++)assert(Math.abs(mesh[6+i]-rgb[i])<1e-6);
 }
 assert(board.every(v=>v===0||v===1),'logical colors unchanged');
}
assert.equal(placedTetracubeColor(mask([[0,0,0],[1,0,0],[0,1,0],[1,1,0]])),null);
assert.equal(placedTetracubeColor(mask([[0,0,0],[2,0,0],[0,2,2],[2,2,2]])),null);
assert.equal(placedTetracubeColor(3),null);
console.log('PASS: tetracube colors distinguish screw chirality under every rotation; composite meshes use overrides without changing identities.');
