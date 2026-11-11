import assert from 'node:assert/strict';
import {createPackingSelection} from '../web/explorer/packing-selection.js';
const s = createPackingSelection();
const first = {lineNumber: 10}, other = {lineNumber: 20};
const result = (record, count = 5) => ({record, count, position: 2, familyCounts: [0, count]});
assert.deepEqual(s.request({family: 1}), {filters: {family: 1}, position: 0});
assert.equal(s.accept(result(first)).navigate, true);
assert.equal(s.current, first);
assert.deepEqual(s.request({}, {offset: -10}), {filters: {}, position: 2, line: 10, offset: -10});
assert.equal(s.request({}, {}, true).line, 10);
assert.equal(s.request({}, {line: 20}, true).line, 20);
assert.equal(s.request({}, {random: true}).line, undefined);
// An equivalent result cannot replace the live selection on a refresh.
assert.deepEqual(s.accept(result({...first}), {refresh: true}),
  {inspecting: false, retained: true, changed: false, navigate: false});
assert.equal(s.current, first);
// Inspection keeps the live cube even when filters exclude it entirely.
for (const record of [other, null]) {
  const transition = s.accept(result(record, record ? 5 : 0), {refresh: true, inspect: true});
  assert.equal(transition.inspecting, true);
  assert.equal(transition.navigate, false);
  assert.equal(s.current, first);
}
assert.equal(s.total, 0);
assert.deepEqual(s.counts, [0, 0]);
// Explicit actions leave inspection and replace the selection.
for (const action of [{random: true}, {offset: 1}, {line: 20}]) {
  s.accept(result(first));
  assert.equal(s.accept(result(other), {action, refresh: true, inspect: true}).navigate, true);
  assert.equal(s.current, other);
}
// Navigating to the same line still asks the view for a new undo boundary.
assert.equal(s.accept(result(other), {action: {random: true}}).navigate, true);
assert.equal(s.accept(result(first), {apply: false}).navigate, false);
assert.equal(s.current, first);
assert.equal(s.accept(result(other), {refresh: true}).navigate, true);
assert.deepEqual(s.accept(result(null, 0)),
  {inspecting: false, retained: false, changed: false, navigate: false});
assert.equal(s.current, other);
console.log('PASS: packing selection, filter retention, inspection and navigation policy.');
