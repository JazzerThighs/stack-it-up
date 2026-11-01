// Stable ordered coverage with a distinct rank permutation per cubie/category.
// Front/back surfaces of one cubie share holes; cubies behind it need not.
const matrix=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
export function transparencyRank(x,y,cell,category=0) {
  const seed=(cell[0]+16)*73+(cell[1]+16)*151+(cell[2]+16)*199+category;
  const rank=4*matrix[(Math.floor(y/2)%4)*4+Math.floor(x/2)%4]+2*(x%2)+y%2;
  return (rank*(2*(seed%16)+1)+seed*13+Math.floor(seed/16)*7)%64;
}
export function categorySeed(id='') {let n=0;for(const c of id)n=(n*31+c.charCodeAt(0))%4093;return n;}
export const transparencyGLSL=`
float transparencyThreshold(vec2 pixel, vec3 materialCell) {
  ivec3 cell=ivec3(materialCell);
  int seed=(cell.x+16)*73+(cell.y+16)*151+(cell.z+16)*199+ditherSeed;
  int rank=int(4.*floor(16.*bayer(floor(pixel/2.)))+2.*mod(pixel.x,2.)+mod(pixel.y,2.));
  return (float((rank*(2*(seed%16)+1)+seed*13+(seed/16)*7)%64)+.5)/64.;
}`;

// One coverage pattern per retained solid, not per cell within that solid.
// The lookup leaves independent cubies independent, including same-color ones.
export const cellCoverageAnchors=Float32Array.from({length:81},(_,i)=>{
  const cell=Math.floor(i/3),axis=i%3;
  return axis===0?Math.floor(cell/9)-1:axis===1?Math.floor(cell/3)%3-1:cell%3-1;
});
export function coverageAnchors(meshes) {
  const anchors=cellCoverageAnchors.slice();
  for(const mesh of meshes) {
    const cells=new Set();
    for(let i=0;i<mesh.length;i+=9) {
      const p=[0,1,2].map(a=>Math.max(0,Math.min(2,Math.floor(mesh[i+a]-mesh[i+3+a]*.002+.5)+1)));
      cells.add(p[0]*9+p[1]*3+p[2]);
    }
    if(!cells.size)continue;
    const first=Math.min(...cells),anchor=cellCoverageAnchors.subarray(first*3,first*3+3);
    for(const cell of cells)anchors.set(anchor,cell*3);
  }
  return anchors;
}

// Explicit per-vertex ownership survives clipping and joining. Surface positions
// near rounded concave corners cannot reliably identify a piece's cell.
export function tagCoverage(mesh,anchor) {
  const data=new Float32Array(mesh.length/3);
  for(let i=0;i<data.length;i+=3)data.set(anchor,i);
  return withCoverage(mesh,data);
}
export function withCoverage(mesh,data) {
  Object.defineProperty(mesh,'coverage',{value:data,configurable:true});return mesh;
}
export function vertexCoverage(mesh,i) {
  return mesh.coverage ? Array.from(mesh.coverage.subarray(i/3,i/3+3)) :
    [0,1,2].map(a=>Math.floor(mesh[i+a]-mesh[i+3+a]*.002+.5));
}
