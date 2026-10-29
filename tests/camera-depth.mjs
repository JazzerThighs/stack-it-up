import assert from 'node:assert/strict';
import {CAMERA_DISTANCE,projectPoint,pointerRay} from '../web/render/camera.js';
import {Renderer} from '../web/render/renderer.js';
import {renderPackets} from '../web/render/pipeline.js';
const r={perspective:true,yaw:.7,pitch:.4,unit:100,canvas:{getBoundingClientRect:()=>({left:0,top:0,width:600,height:600})}};
Renderer.prototype.resetOrientation.call(r);
for(const point of [[1,1,1],[-1,0,1],[0,-1,-1],[1.5,0,0],[0,0,0]]) {
 const q=projectPoint(r,point),ray=pointerRay(r,{clientX:300+q[0]*100,clientY:300-q[1]*100});
 const offset=point.map((v,i)=>v-ray.origin[i]);
 const t=offset.reduce((a,v,i)=>a+v*ray.dir[i],0)/ray.dir.reduce((a,v)=>a+v*v,0);
 for(let i=0;i<3;i++)assert(Math.abs(ray.origin[i]+t*ray.dir[i]-point[i])<1e-9);
}
r.orientation=[1,0,0,0,1,0,0,0,1];
assert(projectPoint(r,[1,0,1])[0]>projectPoint(r,[1,0,-1])[0]);
r.perspective=false;assert.equal(projectPoint(r,[1,0,1])[0],projectPoint(r,[1,0,-1])[0]);
// Each custom category has independent depth, and transparent draws write it.
let depth=true,clears=0;const draws=[],uploads=[];
const gl={DEPTH_TEST:1,LEQUAL:2,STENCIL_TEST:3,BLEND:4,LINES:5,TRIANGLES:6,SRC_ALPHA:7,ONE_MINUS_SRC_ALPHA:8,DEPTH_BUFFER_BIT:9,
 enable(){},disable(){},depthFunc(){},depthMask(v){depth=v;},clearDepth(v){assert.equal(v,1);},clear(){assert(depth);clears++;},
 useProgram(){},uniform3fv(){},uniform1f(){},uniform1i(){},bindVertexArray(){},blendFunc(){},drawArrays(){draws.push(depth);}};
const triangle=z=>[0,0,z,0,0,1,1,1,1,.1,0,z,0,0,1,1,1,1,0,.1,z,0,0,1,1,1,1];
const renderer={gl,uniforms:{},project:p=>p,transparentBuffer:{vao:{}},upload(target,data){target.data=data;target.count=data.length/9;uploads.push(data);}};
const packet=(id,z)=>({id,target:{vao:{},count:3,data:new Float32Array(triangle(z))},type:gl.TRIANGLES,opacity:.5,breathe:1,unlit:false});
renderPackets.call(renderer,[packet('active',1),packet('active',-1),packet('stack',0)],{customLayers:true,layerOrder:['active','stack']});
assert.equal(clears,2);assert(draws.every(Boolean));assert.equal(uploads[1][2],-1);assert.equal(uploads[1][29],1);
console.log('PASS: perspective/ray agreement, orthographic fallback, and per-category depth passes.');
