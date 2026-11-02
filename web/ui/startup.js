const checks = ['engine','graphics','saved','explorer'];
const complete = new Set();
export function startupCheck(id, text, done = false) {
  const row = document.getElementById('startup-' + id);
  if (row) { row.textContent = text; row.dataset.state = done ? 'done' : 'running'; }
  if (done) complete.add(id);
  if (checks.every(key => complete.has(key))) document.getElementById('startupScreen').hidden = true;
}
export function startupError(error) {
  const screen = document.getElementById('startupScreen');
  screen.hidden = false;
  document.getElementById('startupError').textContent = error.message || String(error);
  document.getElementById('startupActions').hidden = false;
}

const number = value => value.toLocaleString();
const megabytes = value => `${(value/1048576).toFixed(1)} MB`;
export function packingProgress(event) {
  const $ = id => document.getElementById(id);
  if (!$('packingLoadProgress') || $('startupScreen')?.hidden) return;
  $('packingLoadProgress').hidden = false;
  const main = $('packingLoadBar'), work = $('packingWorkBar');
  if (event.phase === 'manifest') {
    main.max = event.total; main.value = 0;
    $('packingLoadCount').textContent = `0 / ${number(event.total)} packings`;
  }
  if (event.packings != null) {
    main.max = event.packingTotal; main.value = event.packings;
    $('packingLoadCount').textContent = `${number(event.packings)} / ${number(event.packingTotal)} packings`;
  }
  const labels = {
    download:event.asset === 'index' ? 'Downloading packing metadata' : 'Downloading selected family cube data',
    verify:'Verifying data checksum',
    decode:event.asset === 'index' ? 'Unpacking packing metadata' : 'Unpacking selected family cube data',
    metadata:'Preparing family metadata and query buffers',
    filter:'Checking packing filters',
    cache:'Caching selected family cube data',
    lookup:'Building family recognition cache',
  };
  if (!labels[event.phase]) return;
  $('packingWorkLabel').textContent = labels[event.phase];
  if (event.total != null) {
    work.max = Math.max(1,event.total); work.value = event.loaded;
    const bytes = event.phase === 'download' || event.phase === 'decode';
    $('packingWorkCount').textContent = bytes
      ? `${megabytes(event.loaded)} / ${megabytes(event.total)}`
      : `${number(event.loaded)} / ${number(event.total)} ${event.phase === 'metadata' ? 'families' : 'packings'}`;
  } else {
    work.removeAttribute('value');
    $('packingWorkCount').textContent = 'Checking downloaded data before use…';
  }
  if (event.phase === 'cache') $('packingCacheStatus').textContent =
    `Family ${number(event.family)} cached in memory (${megabytes(event.cacheBytes)} cached). Other families load when needed.`;
}
