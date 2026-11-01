// Fixed isometric preview: no animation, WebGL context, or mirrored transforms.
export function spatialPreview(cells,color) {
  if(!/^#[0-9a-f]{6}$/i.test(color))color='#cccccc';
  const project=([x,y,z])=>[50+(x-z)*13,65+(x+z)*6-y*15];
  const faces=[[[0,1,0],[1,1,0],[1,1,1],[0,1,1]],[[1,0,0],[1,0,1],[1,1,1],[1,1,0]],[[0,0,1],[0,1,1],[1,1,1],[1,0,1]]];
  const points=cells.map(p=>p.slice()).sort((a,b)=>(a[0]+a[2]-a[1])-(b[0]+b[2]-b[1]));
  const polygons=points.flatMap(p=>faces.map((f,i)=>{
    const coords=f.map(q=>project(q.map((v,k)=>v+p[k]))).map(q=>q.join(',')).join(' ');
    return `<polygon points="${coords}" fill="${color}" stroke="#111" stroke-width=".6"/><polygon points="${coords}" fill="${i?'black':'white'}" opacity="${i===1?.16:i===2?.3:.15}"/>`;
  })).join('');
  const projected=cells.flatMap(p=>[0,1].flatMap(x=>[0,1].flatMap(y=>[0,1].map(z=>project([p[0]+x,p[1]+y,p[2]+z])))));
  const min=[0,1].map(a=>Math.min(...projected.map(p=>p[a]))-3),max=[0,1].map(a=>Math.max(...projected.map(p=>p[a]))+3);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${min[0]} ${min[1]} ${max[0]-min[0]} ${max[1]-min[1]}">${polygons}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
