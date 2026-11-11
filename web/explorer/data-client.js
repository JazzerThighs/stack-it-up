import {createWorkerRpc} from '../workers/rpc.js';
export async function createPackingClient({onProgress=()=>{}}={}) {
  if(typeof Worker==='undefined'||typeof DecompressionStream==='undefined')throw Error('This collection needs Web Workers and gzip decompression support. Update your browser to load the packing database.');
  const worker=new Worker(new URL('./data-worker.js',import.meta.url),{type:'module'});
  const rpc=createWorkerRpc(worker,{onProgress,errorMessage:'Packing worker failed'});
  try {
    const info=await rpc.call('init');
    return {info,query:options=>rpc.call('query',options),record:id=>rpc.call('record',+id),pair:filters=>rpc.call('pair',filters),lookup:(id,masks)=>rpc.call('lookup',+id,masks),dispose:rpc.dispose};
  }catch(error){rpc.dispose(error);throw error;}
}
