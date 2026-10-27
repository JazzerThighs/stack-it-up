import {createEngine} from './wasm.js';
import {forecast} from './forecast-search.js';
self.onmessage = async ({data}) => {
  try {
    const engine = await createEngine();
    engine.game_init(1); // Initialize thread-local tables before importing the snapshot.
    const search = forecast(engine, data.words, data.horizon);
    let last = 0;
    for (;;) {
      const result = search.next();
      if (result.done || performance.now() - last > 500) {
        self.postMessage(result.value);
        last = performance.now();
      }
      if (result.done) break;
      // Give the worker event loop time to breathe; the UI owns cancellation.
      await new Promise(resolve=>setTimeout(resolve,0));
    }
  } catch (error) { self.postMessage({status:'error', message:String(error)}); }
};
