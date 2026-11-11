/** One owned worker job. Cancellation rejects callers and ignores late replies. */
export function createWorkerTask({createWorker,runFallback,errorMessage='Worker task failed'}) {
  let active=null;
  function cancel() {active?.finish(Error('Path cancelled'));}
  function run(payload) {
    cancel();
    return new Promise((resolve,reject)=>{
      const job={worker:null,finish(error,value){
        if(active!==job)return;
        active=null;
        if(job.worker){job.worker.onmessage=null;job.worker.onerror=null;job.worker.terminate();}
        error?reject(error):resolve(value);
      }};
      active=job;
      try {
        job.worker=createWorker();
        if(!job.worker) {
          Promise.resolve().then(()=>runFallback(payload)).then(value=>job.finish(null,value),error=>job.finish(error));
          return;
        }
        job.worker.onmessage=({data})=>data.error?job.finish(Error(data.error)):job.finish(null,data.moves);
        job.worker.onerror=()=>job.finish(Error(errorMessage));
        job.worker.postMessage(payload);
      }catch(error){job.finish(error);}
    });
  }
  return {run,cancel,get running(){return active!==null;}};
}
