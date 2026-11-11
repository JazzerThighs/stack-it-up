import assert from 'node:assert/strict';
import {box} from '../web/render/geometry.js';
import {clipMesh} from '../web/render/slice-mesh.js';
import {withCoverage} from '../web/render/transparency.js';

const vertices=[];box(vertices,[0,0,0],1,[.25,.5,.75]);
const volume=(mesh,shift=[0,0,0])=>{
  let sum=0;
  for(let i=0;i<mesh.length;i+=27){
    const p=[0,9,18].map(v=>[0,1,2].map(a=>mesh[i+v+a]+shift[a]));
    const [a,b,c]=p;
    sum+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
  }
  return sum;
};
for(const explicit of [false,true]){
  const source=new Float32Array(vertices);
  // Nonconstant ownership exercises interpolation as well as untouched copies.
  if(explicit)withCoverage(source,Float32Array.from({length:source.length/3},(_,i)=>source[Math.floor(i/3)*9+i%3]*2+3));
  const original=source.slice(),ownership=source.coverage?.slice();
  for(let axis=0;axis<3;axis++)for(const side of [-1,1]){
    assert.equal(clipMesh(source,axis,-2*side,side),source,'uncut meshes retain their identity');
    assert.equal(clipMesh(source,axis,2*side,side).length,0);
    for(const plane of [-.5,0,.5]){
      const clipped=clipMesh(source,axis,plane,side);
      const expected=4*(1-side*plane);
      assert(Math.abs(volume(clipped)-expected)<1e-6,'cut preserves analytic volume');
      assert(Math.abs(volume(clipped,[3,-4,5])-expected)<1e-6,'cut remains closed after translation');
      assert.equal(clipped.coverage.length,clipped.length/3);
      for(let i=0;i<clipped.length;i+=9){
        assert(side*(clipped[i+axis]-plane)>=0);
        assert.deepEqual(Array.from(clipped.subarray(i+6,i+9)),[.25,.5,.75]);
        for(let a=0;a<3;a++){
          assert(Number.isFinite(clipped.coverage[i/3+a]));
          if(explicit)assert(Math.abs(clipped.coverage[i/3+a]-(clipped[i+a]*2+3))<1e-6,'ownership survives clipping and caps');
        }
      }
    }
  }
  let octant=source;
  for(let axis=0;axis<3;axis++)octant=clipMesh(octant,axis,0,1);
  assert(Math.abs(volume(octant)-1)<1e-6,'successive cuts remain closed');
  assert.deepEqual(source,original,'source geometry remains immutable');
  assert.deepEqual(source.coverage,ownership,'source ownership remains immutable');
}
console.log('PASS: axial clipping, closed caps, repeated cuts, color and interpolated ownership with immutable inputs.');
