// Display colors only: logical colors/IDs still govern reconstruction and sharing.
export const tetracubeColors = Object.freeze({left:'#c8c8c8',right:'#505050',branch:'#996633'});
export function placedTetracubeColor(mask) {
  const cells=[];
  for(let i=0;i<27;i++)if(mask&(1<<i))cells.push([Math.floor(i/9),Math.floor(i/3)%3,i%3]);
  if(cells.length!==4 || [0,1,2].some(a=>cells.every(p=>p[a]===cells[0][a])))return null;
  const neighbors=cells.map(p=>cells.flatMap((q,j)=>p.reduce((d,v,a)=>d+Math.abs(v-q[a]),0)===1?[j]:[]));
  if(neighbors.some(n=>n.length===3))return tetracubeColors.branch;
  let current=neighbors.findIndex(n=>n.length===1),previous=-1;
  if(current<0)return null;
  const path=[];
  while(current!==undefined && path.length<4){path.push(cells[current]);const next=neighbors[current].find(i=>i!==previous);previous=current;current=next;}
  if(path.length!==4)return null;
  const [a,b,c]=path.slice(1).map((p,i)=>p.map((v,k)=>v-path[i][k]));
  // The signed triple product is invariant under rotation and path reversal.
  const chirality=a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]);
  return chirality>0?tetracubeColors.right:chirality<0?tetracubeColors.left:null;
}
