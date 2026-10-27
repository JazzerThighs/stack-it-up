// Exact legal-move graph over the real engine's versioned state transport.
// No geometry, placement, clearing, or spawn rules are duplicated here.
export function stateKey(words) {
  const key = words.slice();
  // Cosmetic counters do not affect future rules. Keep RNG, IDs and queue.
  key[5] = key[6] = key[20] = key[21] = 0;
  let i = 76;
  i += 1 + key[i]; // queue
  i += 1 + 3 * key[i]; // floating cells
  i += 1 + key[i]; // rebuild IDs
  i += 1 + key[i]; // bands
  const count = key[i];
  key.splice(i, 1 + count, 0); // last clear display
  return key.join(',');
}
export function* forecast(engine, initial, horizon, maxStates = 150000) {
  const start = initial[4], end = start + horizon;
  const stack = [{words:initial, parent:null, action:null}], seen = new Set();
  let longest = 0, examined = 0;
  while (stack.length) {
    const node = stack.pop(), words = node.words;
    longest = Math.max(longest, words[4] - start);
    // Automatic chains may consume several pieces, then top out AFTER the
    // horizon. Completing the requested prefix is still a successful path.
    if (words[4] >= end) {
      const steps = [];
      for (let n=node; n.parent; n=n.parent) steps.push({...n.action, placed:n.words[4]-n.parent.words[4], over:!!n.words[18]});
      steps.reverse();
      // Verify the witness from the original snapshot, independently of DFS.
      if (!engine.importState(initial)) throw Error('Witness origin rejected');
      for (const step of steps) if (!engine[step.method](step.arg)) throw Error('Witness action rejected');
      if (stateKey(engine.exportState()) !== stateKey(words)) throw Error('Witness replay diverged');
      return {status:'safe', longest:horizon, examined, steps, finalState:words};
    }
    if (words[18]) continue;
    const key = stateKey(words);
    if (seen.has(key)) continue;
    if (seen.size + stack.length >= maxStates) return {status:'unknown', longest, examined};
    seen.add(key); examined++;
    const next = [];
    const actions = words[19] ? Array.from({length:6},(_,f)=>['game_choose',f]) :
      [...Array.from({length:30},(_,m)=>['game_turn',m]),
       ...Array.from({length:27},(_,c)=>['game_lock_band',c])];
    for (const [method, arg] of actions) {
      if (!engine.importState(words)) throw Error('Forecast state rejected');
      if (engine[method](arg)) next.push({words:engine.exportState(), parent:node, action:{method,arg}});
    }
    // Explore placements before moves that only rearrange the active inventory.
    next.sort((a,b)=>a.words[4]-b.words[4]);
    stack.push(...next);
    if (examined % 16 === 0) yield {status:'checking', longest, examined};
  }
  return {status:'blocked', longest, examined};
}
