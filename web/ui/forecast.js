export function createForecast({enabled, status, targets, onWitness = () => {}}) {
  let worker, timer, previous, generation = 0;
  const clear = () => targets.forEach(el => {
    el.classList.remove('queue-dead-end');
    el.removeAttribute?.('data-forecast');
    el.removeAttribute?.('title');
  });
  function stop() {
    generation++; clearTimeout(timer); worker?.terminate(); worker = null;
    clear(); previous = null; status.textContent = ''; onWitness(null);
  }
  return {
    stop,
    update(engine) {
      if (!enabled.checked) { stop(); return; }
      const words = engine.exportState(), key = words.join(',');
      if (key === previous) return;
      stop(); previous = key;
      const token = generation;
      status.textContent = 'Checking queue…';
      timer = setTimeout(() => {
        if (typeof Worker === 'undefined') { status.textContent = 'Queue analysis unavailable.'; return; }
        worker = new Worker(new URL('../engine/forecast-worker.js', import.meta.url), {type:'module'});
        worker.onmessage = ({data}) => {
          if (token !== generation) return;
          if (data.status === 'checking') return;
          if (data.status === 'error') console.error('Queue forecast:', data.message);
          worker?.terminate(); worker = null;
          if (data.status === 'safe') { status.textContent = `Verified path: ${data.steps.length} actions through the shown queue.`; onWitness({initial:words, ...data}); return; }
          if (data.status === 'blocked') {
            const target = targets[data.longest];
            target?.classList.add('queue-dead-end');
            target?.setAttribute('data-forecast', 'Cannot place this piece in the current queue order');
            target?.setAttribute('title', 'No legal continuation can place this piece in the current queue order.');
            status.textContent = `Dead end: at most ${data.longest} pieces, including the current piece, can be placed in queue order.`;
          } else status.textContent = 'Queue analysis inconclusive; no dead end proven.';
        };
        worker.onerror = () => { worker?.terminate(); worker = null; status.textContent = 'Queue analysis unavailable.'; };
        worker.postMessage({words, horizon:targets.length});
      }, 200);
    }
  };
}
