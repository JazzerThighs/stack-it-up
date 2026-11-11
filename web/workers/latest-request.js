/** A newer request invalidates earlier UI work without discarding shared caches. */
export function createLatestRequest() {
  let revision=0;
  return {
    begin(){const id=++revision;return {isCurrent:()=>id===revision};},
    invalidate(){revision++;},
  };
}
