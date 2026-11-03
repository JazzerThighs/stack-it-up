// Extra-space shapes, independent of orientation and placement on the cube.
// Flags: straight tricube (1), Soma V tricube (2), adjacent dicube (4).
export function extraShapeFlags(mask) {
  const cells=[];
  for(let i=0;i<27;i++)if(mask&(1<<i))cells.push([Math.floor(i/9),Math.floor(i/3)%3,i%3]);
  if(cells.length!==3)return 0;
  let adjacent=0;
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)
    if(cells[i].reduce((n,v,a)=>n+Math.abs(v-cells[j][a]),0)===1)adjacent++;
  const straight=[0,1,2].some(axis=>cells.every(p=>p.every((v,a)=>a===axis||v===cells[0][a])));
  return (straight?1:0)|(adjacent===2&&!straight?2:0)|(adjacent?4:0);
}
// J/L and S/Z are rotation-equivalent free tetracubes. Both screws are required.
export const isSomaBag=bag=>bag.toUpperCase().replaceAll('J','L').replaceAll('Z','S').split('').sort().join('')==='BDFLST';
