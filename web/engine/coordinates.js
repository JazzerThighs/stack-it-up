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
