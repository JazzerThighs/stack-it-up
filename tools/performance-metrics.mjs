// Shared by the browser probe and its deterministic accounting tests.
export function distribution(values) {
  const sorted=values.slice().sort((a,b)=>a-b);
  const percentile=p=>sorted.length?sorted[Math.ceil(sorted.length*p)-1]:null;
  return {count:sorted.length,p50:percentile(.5),p95:percentile(.95),max:sorted.at(-1)??null};
}

export function bufferPlateau(checkpoints,cycles=[10,15]) {
  const [before,after]=cycles.map(cycle=>checkpoints.find(c=>c.cycle===cycle));
  if(!before||!after)return {stable:null,growth:null};
  const growth={buffers:after.liveBuffers-before.liveBuffers,bytes:after.bufferBytes-before.bufferBytes};
  return {stable:growth.buffers===0&&growth.bytes===0,growth};
}

// Install on one real context before renderer construction. No retained data copies.
export function observeBuffers(gl) {
  const live=new Map(),bound=new Map(),originals=new Map();
  let uploads=0,uploadBytes=0,peakBuffers=0,peakBytes=0,bytes=0;
  function wrap(name,observe){const original=gl[name];originals.set(name,original);gl[name]=function(...args){const result=original.apply(this,args);observe(args,result);return result;};}
  wrap('createBuffer',(_,buffer)=>{if(buffer)live.set(buffer,0);peakBuffers=Math.max(peakBuffers,live.size);});
  wrap('bindBuffer',([target,buffer])=>bound.set(target,buffer));
  wrap('bufferData',([target,data,,offset=0,length])=>{
    const buffer=bound.get(target);if(!live.has(buffer))return;
    const size=typeof data==='number'?data:data==null?0:
      (length===undefined||length===0?data.byteLength-offset*(data.BYTES_PER_ELEMENT||1):length*(data.BYTES_PER_ELEMENT||1));
    bytes+=size-live.get(buffer);live.set(buffer,size);peakBytes=Math.max(peakBytes,bytes);
    uploads++;if(typeof data!=='number')uploadBytes+=size;
  });
  wrap('bufferSubData',([, ,data,offset=0,length])=>{uploads++;uploadBytes+=length?length*(data.BYTES_PER_ELEMENT||1):data.byteLength-offset*(data.BYTES_PER_ELEMENT||1);});
  wrap('deleteBuffer',([buffer])=>{if(live.has(buffer)){bytes-=live.get(buffer);live.delete(buffer);}});
  return {snapshot:()=>({liveBuffers:live.size,bufferBytes:bytes,peakBuffers,peakBufferBytes:peakBytes,uploads,uploadBytes}),
    restore(){for(const [name,original]of originals)gl[name]=original;}};
}
