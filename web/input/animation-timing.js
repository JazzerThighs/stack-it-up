// Limits are presentation policy; logical moves are never skipped for speed.
export function catchUpRate(duration, backlog) {
  if (!backlog?.playing || duration <= 0) return 0;
  const budget = Math.max(24,120-backlog.oldestAge);
  const target = backlog.pending ? budget/(backlog.pending+1) : 90;
  return Math.max(1,duration/Math.max(24,target));
}
