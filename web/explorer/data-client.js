export async function createPackingClient() {
  if(typeof Worker==='undefined'||typeof DecompressionStream==='undefined')throw Error('This collection needs Web Workers and gzip decompression support. Update your browser to load the packing database.');
  const worker=new Worker(new URL('./data-worker.js',import.meta.url),{type:'module'}),pending=new Map();let next=0;
  worker.onmessage=({data})=>{const p=pending.get(data.id);if(!p)return;pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.value);};
  worker.onerror=e=>{for(const p of pending.values())p.reject(Error(e.message||'Packing worker failed'));pending.clear();};
  const call=(method,...args)=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});worker.postMessage({id,method,args});});
  const info=await call('init');
  return {info,query:options=>call('query',options),record:id=>call('record',+id),pair:filters=>call('pair',filters),lookup:(id,masks)=>call('lookup',+id,masks)};
}
