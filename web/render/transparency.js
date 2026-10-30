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
