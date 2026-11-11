import {readFile} from 'node:fs/promises';
import {distribution,bufferPlateau} from './performance-metrics.mjs';
const filename=process.argv[2];
if(!filename)throw Error('Usage: node tools/report-browser-performance.mjs <browser-performance.json>');
const report=JSON.parse(await readFile(filename,'utf8'));
if(report.schema!==1||!Array.isArray(report.scenarios))throw Error('Unsupported benchmark report');
console.log(JSON.stringify({build:report.build,environment:report.environment,completed:report.completed,errors:report.errors},null,2));
const rows=report.scenarios.map(s=>{
  const samples=s.samples.filter(x=>x.label==='playback').map(x=>x.commandToDrawMs);
  const early=distribution(samples.slice(0,30)),late=distribution(samples.slice(-30));
  const heap=s.samples.map(x=>x.resources.heapBytes).filter(Number.isFinite);
  return {family:s.familySize,familyId:s.familyId,effect:s.effect,turns:samples.length,
    requestedCycles:s.requestedCycles,p50ms:distribution(samples).p50,p95ms:distribution(samples).p95,
    firstUpTo5CyclesP50ms:early.p50,lastUpTo5CyclesP50ms:late.p50,
    firstUpTo5CyclesP95ms:early.p95,lastUpTo5CyclesP95ms:late.p95,
    lateToEarlyP95Ratio:early.p95?late.p95/early.p95:null,
    sampledPeakPageHeapMiB:heap.length?Math.max(...heap)/1048576:null,
    bufferPlateau:report.plateauCycles?bufferPlateau(s.checkpoints,report.plateauCycles).stable:s.bufferPlateau,remainingBuffers:s.afterDestroy?.liveBuffers??null};
});
console.table(rows);
console.log('Latency includes intentional animation; page heap excludes workers and includes benchmark samples. Early/late ratios are observations, not a statistical regression verdict.');
console.log('Plateau checkpoints:',report.plateauCycles??'not specified by this older report');
console.log('A null buffer plateau means the resource plateau was not assessed. Current runs compare cycles 10 and 15.');
if(!report.completed||report.invalidatedByHiddenTab||report.errors.length||rows.length!==2||rows.some(r=>r.turns!==r.requestedCycles*6||r.bufferPlateau===false||(r.requestedCycles>=15&&r.bufferPlateau!==true)||r.remainingBuffers!==0))process.exitCode=1;
