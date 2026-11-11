// Owns asynchronous playback admission and cancellation, independently of views.
export function createPlaybackController({cancelSearch = () => {}} = {}) {
  let active = null;
  function cancel() {
    active = null;
    cancelSearch();
  }
  async function run({prepare, plan, onPlan, play, onStep, onError, onFinish}) {
    if (active) return false;
    const job = {};
    active = job;
    const current = () => active === job;
    try {
      await prepare?.();
      if (!current()) return false;
      const moves = await plan();
      if (!current()) return false;
      onPlan?.(moves);
      for (let i = 0; i < moves.length; i++) {
        if (!current()) return false;
        await play(moves[i]);
        if (!current()) return false;
        onStep?.(i + 1, moves.length);
      }
      return true;
    } catch (error) {
      if (current()) onError?.(error);
      return false;
    } finally {
      if (current()) {
        active = null;
        onFinish?.();
      }
    }
  }
  return {run, cancel, get busy() {return active !== null;}};
}
