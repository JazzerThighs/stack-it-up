// Hand-traced motifs from the reference's Original Game Boy row.
// Height, not baked white highlights: live lighting follows every relief wall.
import {xyz} from './geometry.js';
const cache=new Map();
export function gameboyPattern(letter='O') {
  if(letter==='J/L')letter='J';if(letter==='S/Z')letter='S';
  const size=8,heights=[];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const edge=Math.min(x,y,7-x,7-y);let h=0;
    if(edge>0) {
      if(letter==='L')h=.018;
      else if(letter==='Z')h=(x>=3&&x<=4&&y>=3&&y<=4)?0:.028;
      else if(letter==='O')h=edge===1?.032:0;
      else if(letter==='B')h=(x===3||x===4||y===3||y===4)?.035:.008;
      else if(letter==='D'||letter==='F') {
        const u=letter==='F'?7-x:x;
        h=((y===2&&u>=2&&u<=5)||(u===5&&y>=2&&y<=5)||(y===5&&u>=3&&u<=5)||(u===3&&y===4))?.035:.006;
      } else h=edge===1?.032:edge===2?.004:.024;
    }
    heights.push(h);
  }
  return heights;
}
function unitMesh(letter) {
  if(cache.has(letter))return cache.get(letter);
  // Reflect the entire right-screw mesh, not each face in its local frame.
  // Reverse each triangle to preserve outward winding after reflection.
  if(letter==='F') {
    const right=unitMesh('D'),left=new Float32Array(right.length);
    for(let i=0;i<right.length;i+=27)for(const [dest,src] of [[0,0],[9,18],[18,9]])
      for(let a=0;a<9;a++)left[i+dest+a]=right[i+src+a]*(a===0||a===3?-1:1);
    cache.set(letter,left);return left;
  }
  const heights=gameboyPattern(letter),out=[],base=.455,step=base*2/8;
  const quad=(points,n,tone)=>{for(const i of [0,1,2,0,2,3])out.push(...points[i],...n,tone,tone,tone);};
  for(let axis=0;axis<3;axis++)for(const sign of [-1,1]) {
    const a=(axis+1)%3,b=(axis+2)%3;
    const point=(u,v,h)=>{const q=[0,0,0];q[axis]=sign*(base+h);q[a]=-base+u*step;q[b]=-base+v*step;return q;};
    for(let y=0;y<8;y++)for(let x=0;x<8;x++) {
      const h=heights[y*8+x],n=[0,0,0];n[axis]=sign;
      const edge=Math.min(x,y,7-x,7-y);
      const framed=letter==='J'||letter==='S'||letter==='J/L'||letter==='S/Z';
      const tone=framed?(edge===0?.12:edge===1?1:edge===2?.12:1.65):(h===0?.24:1);
      const points=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]].map(([u,v])=>point(u,v,h));
      quad(sign===1?points:points.reverse(),n,tone);
      for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx=x+dx,ny=y+dy,other=nx<0||ny<0||nx>=8||ny>=8?0:heights[ny*8+nx];
        if(h<=other)continue;
        const u=x+(dx>0?1:0),v=y+(dy>0?1:0),end=[u+(dy!==0?1:0),v+(dx!==0?1:0)];
        const normal=[0,0,0];normal[a]=dx;normal[b]=dy;
        let wall=[point(u,v,other),point(...end,other),point(...end,h),point(u,v,h)];
        const e=wall[1].map((v,i)=>v-wall[0][i]),f=wall[2].map((v,i)=>v-wall[0][i]);
        const cross=[e[1]*f[2]-e[2]*f[1],e[2]*f[0]-e[0]*f[2],e[0]*f[1]-e[1]*f[0]];
        if(cross.reduce((s,v,i)=>s+v*normal[i],0)<0)wall.reverse();
        quad(wall,normal,.75);
      }
    }
  }
  const mesh=new Float32Array(out);cache.set(letter,mesh);return mesh;
}
export function gameboyCell(out,p,h,color,letter='O') {
  const mesh=unitMesh(letter),scale=h/.487;
  for(let i=0;i<mesh.length;i+=9)out.push(...p.map((v,a)=>v+mesh[i+a]*scale),...mesh.subarray(i+3,i+6),...color.map((v,a)=>{const tone=mesh[i+6+a];return tone>1?v*(2-tone)+(tone-1):v*tone;}));
}
export function gameboyPiece(mask,color,letter) {
  const out=[];for(let i=0;i<27;i++)if(mask&(1<<i))gameboyCell(out,xyz(i),.487,color,letter);
  return out;
}
