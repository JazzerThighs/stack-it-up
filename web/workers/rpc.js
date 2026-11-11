/** Multiplexed RPC for a persistent worker; all requests settle on shutdown. */
export function createWorkerRpc(worker,{onProgress=()=>{},errorMessage='Worker failed'}={}) {
  const pending=new Map();let next=0,closed=null;
  function dispose(reason=Error('Worker disposed')) {
    if(closed)return;
    closed=reason instanceof Error?reason:Error(String(reason));
    worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;
    worker.terminate();
    for(const request of pending.values())request.reject(closed);
    pending.clear();
  }
  worker.onmessage=({data})=>{
    if(closed||!data)return;
    if(data.progress){onProgress(data.progress);return;}
    const request=pending.get(data.id);if(!request)return;
    pending.delete(data.id);
    data.error?request.reject(Error(data.error)):request.resolve(data.value);
  };
  worker.onerror=event=>dispose(Error(event.message||errorMessage));
  worker.onmessageerror=()=>dispose(Error('Worker response could not be decoded'));
  function call(method,...args) {
    if(closed)return Promise.reject(closed);
    return new Promise((resolve,reject)=>{
      const id=++next;pending.set(id,{resolve,reject});
      try {worker.postMessage({id,method,args});}
      catch(error){pending.delete(id);reject(error);}
    });
  }
  return {call,dispose,get pendingCount(){return pending.size;}};
}
