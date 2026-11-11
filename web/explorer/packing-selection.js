// Owns catalog selection only; live cube/history changes belong to the views.
export function createPackingSelection() {
  let current, position = 0, total = 0, counts = [];
  return {
    get current() { return current; },
    get position() { return position; },
    get total() { return total; },
    get counts() { return counts; },
    request(filters, action = {}, refresh = false) {
      return {
        filters, position,
        // Refilter and step relative to the selected source line.
        ...(current && (refresh || action.offset) ? {line: current.lineNumber} : {}),
        ...action,
      };
    },
    // Call only after the caller has rejected stale asynchronous results.
    accept(result, {action = {}, refresh = false, apply = true, inspect = false} = {}) {
      const inspecting = !!(refresh && current && inspect &&
        !action.line && !action.offset && !action.random);
      const retained = !!(inspecting || refresh && result.record && current &&
        result.record.lineNumber === current.lineNumber);
      total = result.count;
      position = result.position;
      counts = result.familyCounts;
      const changed = !!(result.record && !retained);
      if (changed) current = result.record;
      // Explicit navigation starts a new cube even if it selects the same line.
      return {inspecting, retained, changed, navigate: changed && apply};
    },
  };
}
