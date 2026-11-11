import {createWorkerRpc} from './rpc.js';
// At most one running job and one replaceable pending request. Already-running
// Wasm is not interruptible; obsolete replies are ignored before renderer upload.
export function createGeometryClient(worker) {
  const rpc=createWorkerRpc(worker,{errorMessage:'Geometry worker failed'});
  let running=false,queued=null,revision=0,disposed=false;
  const counts={requested:0,started:0,completed:0,supersededQueued:0,staleReplies:0,failed:0};
  async function pump(){
    if(running||!queued||disposed)return;
    const job=queued;queued=null;running=true;counts.started++;
    try{const result=await rpc.call('prepare',job.request);const current=!disposed&&job.revision===revision;counts[current?'completed':'staleReplies']++;job.resolve(current?result:null);}
    catch(error){counts.failed++;if(!disposed&&job.revision===revision)job.reject(error);else job.resolve(null);}
    finally{running=false;pump();}
  }
  return {
    request(request){
      if(disposed)return Promise.reject(Error('Geometry client disposed'));
      return new Promise((resolve,reject)=>{
        const snapshot=structuredClone(request);
        counts.requested++;
        if(queued){counts.supersededQueued++;queued.resolve(null);}
        queued={request:snapshot,resolve,reject,revision:++revision};pump();
      });
    },
    dispose(){if(disposed)return;disposed=true;revision++;queued?.resolve(null);queued=null;rpc.dispose();},
    get pendingCount(){return Number(running)+Number(!!queued);},
    get diagnostics(){return {...counts,pendingCount:Number(running)+Number(!!queued),disposed};},
  };
}
