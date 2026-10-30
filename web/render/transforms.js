import {CubeStack} from '../engine/coordinates.js';
export const IDENTITY=[1,0,0,0,1,0,0,0,1];
export function turnTransform(move,t) {
  const [,axis,,side]=CubeStack.moves[move%15];
  const angle=((move>=15)===(side===0)?-1:1)*Math.PI*.5*t,c=Math.cos(angle),s=Math.sin(angle);
  const a=(axis+1)%3,b=(axis+2)%3,m=IDENTITY.slice();
  m[a*3+a]=c;m[b*3+b]=c;m[a*3+b]=s;m[b*3+a]=-s;return m;
}
export function transformPoint(p,{rotation=IDENTITY,modelScale=1,offset=[0,0,0]}={}) {
  return [0,1,2].map(a=>offset[a]+modelScale*(rotation[a]*p[0]+rotation[3+a]*p[1]+rotation[6+a]*p[2]));
}
