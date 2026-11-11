import {distribution,observeBuffers,bufferPlateau} from './performance-metrics.mjs';
const status=document.querySelector('#status'),button=document.querySelector('#run');
const base='/'+window.benchmarkBuild.assets+'/';
const load=name=>import(base+name);
const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
const check=(condition,message)=>{if(!condition)throw Error(message);};
const report={schema:1,plateauCycles:[10,15],build:window.benchmarkBuild,started:new Date().toISOString(),scenarios:[],errors:[],
  scope:'Production PackingCube and data worker in an isolated page; not whole-app or path-search timing.',
  latencyDefinition:'Command start through ready geometry and synchronous draw submission on the next animation frame. Not GPU completion or physical presentation.',
  memoryDefinition:'Sampled main-page JS heap (when exposed) and tracked GL buffer allocations. Excludes worker heaps, GPU textures/driver overhead and total process memory.'};
let invalidated=false,running=false;
let stopRequested=false,downloadUrl;
const stopButton=document.querySelector('#stop');
stopButton.onclick=()=>{stopRequested=true;stopButton.disabled=true;status.textContent='Stopping after the current turn…';};
function publishReport(){
  if(downloadUrl)URL.revokeObjectURL(downloadUrl);
  downloadUrl=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
  const link=document.querySelector('#download');link.href=downloadUrl;link.download='browser-performance.json';link.hidden=false;
}
document.addEventListener('visibilitychange',()=>{if(running&&document.hidden)invalidated=true;});
window.addEventListener('error',e=>report.errors.push(e.message));
window.addEventListener('unhandledrejection',e=>report.errors.push(String(e.reason)));
button.onclick=async()=>{
  button.disabled=true;running=true;let client,cube,observer,restoreSettings,activeMetrics;
  stopButton.disabled=false;
  report.cycles={jelly:Number(document.querySelector('#jellyCycles').value)};
  document.querySelector('#jellyCycles').disabled=true;
  const longTasks=[];
  try{
    check(Object.values(report.cycles).every(n=>Number.isInteger(n)&&n>=1&&n<=15),'Cycle counts must be between 1 and 15');
    check(!document.hidden,'Keep the benchmark tab visible');
    if(PerformanceObserver.supportedEntryTypes?.includes('longtask')){
      observer=new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>({startMs:e.startTime,durationMs:e.duration}))));
      observer.observe({type:'longtask',buffered:false});
    }
    const [{PackingCube},{createPackingClient},{packingCells,canonicalColor},{visualSettings}]=await Promise.all([
      load('explorer/cube-view.js'),load('explorer/data-client.js'),load('explorer/model.js'),load('render/visual-settings.js')]);
    const originalSettings={...visualSettings};restoreSettings=()=>Object.assign(visualSettings,originalSettings);
    // Isolated module state only: no preference-store writes.
    Object.assign(visualSettings,{cubieScale:100,jellyProfile:3,jellyBevel:20,jellyElbows:50});
    report.settings={...visualSettings};
    const dataStart=performance.now();status.textContent='Loading dataset in worker…';
    client=await createPackingClient();report.dataInitMs=performance.now()-dataStart;
    const families=client.info.families.filter(f=>f.count>1).sort((a,b)=>a.count-b.count||a.id-b.id);
    check(families.length>0,'No multi-packing families');
    report.environment={userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,deviceMemoryGiB:navigator.deviceMemory??null,
      devicePixelRatio,viewport:{width:640,height:480},reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};
    check(!report.environment.reducedMotion,'Disable reduced motion for reproducible animated playback');
    for(const [familySize,family]of [['small',families[0]],['large',families.at(-1)]]){
      const querySamples=[];let record;
      for(let i=0;i<5;i++){
        const start=performance.now();const result=await client.query({filters:{family:family.id},position:i%2});
        querySamples.push(performance.now()-start);record??=result.record;
        check(result.record?.familyId===family.id,'Query family invariant failed');
      }
      const colors=Array(27).fill('d');record.masks.forEach((mask,id)=>{for(let i=0;i<27;i++)if(mask&(1<<i))colors[i]=canonicalColor(record.identities[id]);});
      const cells=packingCells(record,colors);
      for(const effect of ['jelly']){
        status.textContent=`${familySize} family ${family.id} (${family.count} packings), ${effect}: preparing`;
        const cycles=report.cycles[effect];
        const scenario={familySize,familyId:family.id,familyCount:family.count,sourceId:record.lineNumber,effect,requestedCycles:cycles,queryMs:{cold:querySamples[0],warm:distribution(querySamples.slice(1))},samples:[],checkpoints:[]};
        report.scenarios.push(scenario);
        // Observe context from creation, including base renderer buffers.
        let metrics;const getContext=HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext=function(type,...args){const gl=getContext.call(this,type,...args);if(type==='webgl2'&&gl&&!metrics)metrics=observeBuffers(gl);return gl;};
        try{cube=new PackingCube(document.querySelector('#cube'),{controls:false});}finally{HTMLCanvasElement.prototype.getContext=getContext;}
        check(metrics,'WebGL2 unavailable');activeMetrics=metrics;
        const gl=cube.gl,debug=gl.getExtension('WEBGL_debug_renderer_info');
        report.environment.renderer=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
        report.environment.vendor=debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR);
        cube.connected=true;cube.familyExploration=true;cube.assembly='whole';cube.modelShape='jelly';cube.appearance=effect;cube.fixedPieceColors=true;
        cube.meshGenerator=()=>{throw Error('Unexpected main-thread mesh generation');};
        cube.playbackMs=180;
        let frameUploads=metrics.snapshot();const uploadsPerFrame=[];
        const draw=cube.draw.bind(cube);cube.draw=()=>{
          draw();const now=metrics.snapshot();uploadsPerFrame.push({uploads:now.uploads-frameUploads.uploads,bytes:now.uploadBytes-frameUploads.uploadBytes});frameUploads=now;
        };
        const snapshot=()=>({...metrics.snapshot(),heapBytes:performance.memory?.usedJSHeapSize??null,worker:cube.geometry?.client?.diagnostics??null});
        const measure=async(label,action)=>{
          check(!stopRequested,'Stopped by user');
          check(!invalidated,'Tab was hidden during benchmark; reload and rerun');
          const start=performance.now();await action();
          check(await cube.geometry.ready(),'Geometry preparation failed');
          await frame();cube.draw();
          const sample={label,commandToDrawMs:performance.now()-start,preparation:{...cube.geometry.timings},resources:snapshot()};
          scenario.samples.push(sample);return sample;
        };
        await measure('cold-worker',()=>cube.setCells(cells));
        for(let i=0;i<5;i++)await measure('warm-state',()=>cube.setState(cube.cells));
        for(const scale of [40,100])await measure('size-'+scale,()=>{visualSettings.cubieScale=scale;cube.setState(cube.cells);});
        // Force one running request, then replace pending work. The final revision must win.
        await measure('settings-burst',async()=>{
          visualSettings.jellyProfile=6;cube.setState(cube.cells);await Promise.resolve();await Promise.resolve();
          visualSettings.jellyProfile=4;cube.setState(cube.cells);await Promise.resolve();await Promise.resolve();
          visualSettings.jellyProfile=3;cube.setState(cube.cells);
        });
        check(cube.geometry.readyKey===cube.geometry.base.key,'Stale geometry accepted');
        // A fixed path and its inverse close each cycle. Reset clears history while
        // preserving the session branch cache, matching repeated demonstration use.
        const path=[0,2,4,19,17,15];scenario.path=path;
        for(let cycle=1;cycle<=cycles;cycle++){
          for(const move of path)await measure('playback',()=>cube.play(move));
          check(cube.cells.every((cell,i)=>cell?.piece===cells[i]?.piece&&cell?.color===cells[i]?.color),'Playback failed to return to start');
          cube.reset();check(await cube.geometry.ready(),'Reset failed');
          if([1,5,10,15,cycles].includes(cycle)){scenario.checkpoints.push({cycle,...snapshot()});publishReport();}
          status.textContent=`${familySize} family ${family.id}, ${effect}: ${cycle}/${cycles} cycles`;
        }
        scenario.playbackLatencyMs=distribution(scenario.samples.filter(s=>s.label==='playback').map(s=>s.commandToDrawMs));
        scenario.uploadsPerDraw=distribution(uploadsPerFrame.map(f=>f.uploads));scenario.uploadBytesPerDraw=distribution(uploadsPerFrame.map(f=>f.bytes));
        const plateau=bufferPlateau(scenario.checkpoints,report.plateauCycles);
        scenario.bufferPlateau=plateau.stable;scenario.bufferGrowthAfterWarmup=plateau.growth;
        cube.destroy();cube=null;scenario.afterDestroy=metrics.snapshot();metrics.restore();activeMetrics=null;
        check(scenario.afterDestroy.liveBuffers===0,'Renderer leaked GL buffers on destroy');
      }
    }
    check(!invalidated,'Tab was hidden during benchmark; reload and rerun');
    check(report.errors.length===0,'Browser reported runtime errors');report.completed=true;
    status.textContent='Complete. Download the report. Buffer plateau: '+report.scenarios.map(s=>`${s.familySize}/${s.effect}: ${s.bufferPlateau??'not assessed (short run)'}`).join(', ');
  }catch(error){report.completed=false;report.stopped=stopRequested;if(!stopRequested)report.errors.push(String(error.stack||error));status.textContent=stopRequested?'Stopped. Collected results are available to download.':'FAILED: '+error.message;}
  finally{
    running=false;stopButton.disabled=true;cube?.destroy();activeMetrics?.restore();client?.dispose();restoreSettings?.();
    await new Promise(resolve=>setTimeout(resolve,0));observer?.disconnect();
    report.longTasks=longTasks;report.longTaskDurationMs=distribution(longTasks.map(t=>t.durationMs));report.finished=new Date().toISOString();report.invalidatedByHiddenTab=invalidated;
    publishReport();
    window.benchmarkReport=report;
  }
};
