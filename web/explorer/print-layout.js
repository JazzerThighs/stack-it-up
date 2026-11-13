// Arrange physical pieces without changing their meshes or relative fragments.
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);};
const key=part=>part.piece>=0?'piece:'+part.piece:'extra:'+part.cells[0];
function floorBasis(parts){
  const vertices=[],candidates=new Map();
  for(const {data} of parts)for(let i=0;i<data.length;i+=27){
    const a=Array.from(data.slice(i,i+3)),b=Array.from(data.slice(i+9,i+12)),c=Array.from(data.slice(i+18,i+21));
    vertices.push(a,b,c);
    const normal=cross(b.map((v,j)=>v-a[j]),c.map((v,j)=>v-a[j])),area=Math.hypot(...normal)/2;
    if(area<1e-12)continue;
    const n=unit(normal),id=n.map(v=>Math.round(v*1e5)).join(',');
    if(!candidates.has(id))candidates.set(id,{n,area:0,triangles:[]});
    const candidate=candidates.get(id);candidate.area+=area;candidate.triangles.push({a,b,c,area});
  }
  // All potential supporting mesh faces are considered. Summed parallel-face
  // area is an upper bound, so small candidates can be skipped after a winner.
  let best=null;
  for(const candidate of [...candidates.values()].sort((a,b)=>b.area-a.area)){
    if(best&&candidate.area<best.area-1e-9)break;
    const y=candidate.n.map(v=>-v),reference=Math.abs(y[0])<.9?[1,0,0]:[0,0,1];
    const z=unit(cross(reference,y)),x=cross(y,z),basis=[x,y,z];
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(const p of vertices)for(let j=0;j<3;j++){const v=dot(basis[j],p);min[j]=Math.min(min[j],v);max[j]=Math.max(max[j],v);}
    const tolerance=Math.max(1,...max.map((v,j)=>v-min[j]))*1e-5;
    const area=candidate.triangles.reduce((sum,t)=>sum+([t.a,t.b,t.c].every(p=>dot(y,p)-min[1]<=tolerance)?t.area:0),0);
    const height=max[1]-min[1];
    if(!best||area>best.area+1e-9||Math.abs(area-best.area)<=1e-9&&height<best.height-1e-9)best={basis,min,max,area,height};
  }
  if(!best)throw Error('A piece has no usable surface for floor placement.');
  return best;
}
export function arrangePrintLayout(parts,{sizeMm=60,gapMm=5}={}){
  if(!Number.isFinite(sizeMm)||sizeMm<=0||sizeMm>10000)throw Error('Cube size must be greater than 0 and at most 10000 mm.');
  if(!Number.isFinite(gapMm)||gapMm<0||gapMm>1000)throw Error('Piece spacing must be between 0 and 1000 mm.');
  const groups=new Map();
  for(const part of parts){
    if(!part.data?.length)continue;
    if(part.data.length%27)throw Error('Model geometry contains an incomplete triangle.');
    if(!part.data.every(Number.isFinite))throw Error('Model geometry contains non-finite values.');
    const id=key(part);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(part);
  }
  // The three-cell grid spans sizeMm millimetres; metre conversion happens only in the GLB encoder.
  const gap=gapMm*3/sizeMm,columns=Math.ceil(Math.sqrt(groups.size)),result=[];
  let column=0,left=0,back=0,rowDepth=0;
  for(const group of groups.values()){
    const {basis,min,max}=floorBasis(group),width=max[0]-min[0],depth=max[2]-min[2];
    for(const part of group){
      const data=part.data.slice();
      for(let i=0;i<data.length;i+=9){
        const p=part.data.subarray(i,i+3),normal=part.data.subarray(i+3,i+6);
        for(let j=0;j<3;j++){data[i+j]=dot(basis[j],p)-min[j]+(j===0?left:j===2?back:0);data[i+j+3]=dot(basis[j],normal);}
      }
      result.push({...part,data});
    }
    left+=width+gap;rowDepth=Math.max(rowDepth,depth);
    if(++column===columns){column=0;left=0;back+=rowDepth+gap;rowDepth=0;}
  }
  return result;
}
