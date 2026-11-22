export const moveLabels = [
  "U",
  "D",
  "F",
  "B",
  "R",
  "L",
  "M",
  "E",
  "S",
  "u",
  "d",
  "f",
  "b",
  "r",
  "l",
];
export const explorerMoveLabels = [
  'U','D','B','F','L','R','M','E','S','u','d','b','f','l','r',
];
// Game and Explorer world frames differ by half a turn about Y.
// Post-multiply a column-major camera matrix by that rotation (its own inverse).
export function flipCameraFrame(matrix) {
  return matrix.map((v,i) => i >= 3 && i < 6 ? v : -v);
}
// Numeric moves are also stored in replays. Translate at the notation boundary:
// the internal M rotates like face 4, which Explorer labels L and Game labels R.
export function notationMove(move, labels = moveLabels) {
  const base = move % 15;
  const reversed = (base === 6 && labels[4] === 'R') || (base === 8 && labels[2] === 'B');
  return reversed ? (move + 15) % 30 : move;
}
export function formatMove(move, prime = "'", labels = moveLabels) {
  return labels[move % 15] + (notationMove(move, labels) >= 15 ? prime : '');
}
const faces = [
  ["U", 1, 2],
  ["D", 1, 0],
  ["F", 2, 0],
  ["B", 2, 2],
  ["L", 0, 0],
  ["R", 0, 2],
];
const slices = [
  ["M", 0, 1, 0],
  ["E", 1, 1, 0],
  ["S", 2, 1, 0],
];
const wide = faces.map(([name, axis, side]) => [
  name.toLowerCase(),
  axis,
  "wide",
  side,
]);
export const CubeStack = {
  xyz: (i) => [Math.floor(i / 9), Math.floor(i / 3) % 3, i % 3],
  moves: [
    ...faces.map(([name, axis, layer]) => [name, axis, layer, layer]),
    ...slices,
    ...wide,
  ],
};
