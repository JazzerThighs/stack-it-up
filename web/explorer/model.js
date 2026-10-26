import { CubeStack } from "../engine/coordinates.js";

// Catalog identities are preserved by the proper rotation into renderer space.
export const displayIdentity = identity => identity;
export const CANONICAL_COLORS = {J:'b',L:'o',S:'g',Z:'r',O:'y',T:'m'};
export const canonicalColor = identity => CANONICAL_COLORS[displayIdentity(identity)] || 'd';

export const PALETTE = {
  b: "#649aff",
  y: "#ffd35c",
  m: "#bd8cff",
  o: "#ffab5c",
  g: "#62d9ad",
  r: "#ff718d",
  w: "#f0f3f7",
  k: "#202833",
  l: "#68717d",
  d: "#68717d",
};
export const cellsOf = (mask) =>
  Array.from({ length: 27 }, (_, i) => i).filter((i) => mask & (1 << i));
const xyz = CubeStack.xyz;
const index = (p) => p[0] * 9 + p[1] * 3 + p[2];
const kind = (i) => xyz(i).filter((v) => v !== 1).length;

// Rotate catalog coordinates into renderer space (determinant +1).
// The old (z, -x, y) transform reflected the packing, reversing chirality.
// Retain the measured legacy facelet map separately for safekeeping.
export function displayIndex(i) {
  const [x, y, z] = xyz(i);
  return (2 - z) * 9 + (2 - x) * 3 + y;
}
export function packingCells(packing, colors) {
  const owner = Array(27).fill(-1);
  packing.masks.forEach((mask, id) =>
    cellsOf(mask).forEach((i) => {
      owner[i] = id;
    }),
  );
  const result = Array(27);
  colors.forEach(
    (color, i) =>
      (result[displayIndex(i)] = { color: color || "d", piece: owner[i] }),
  );
  return result;
}
export function turn(cells, move) {
  const [, axis, layer, side] = CubeStack.moves[move % 15];
  const sign = move >= 15 === (side === 0) ? -1 : 1;
  const result = cells.slice(),
    a = (axis + 1) % 3,
    b = (axis + 2) % 3;
  cells.forEach((cell, i) => {
    const p = xyz(i);
    if (layer === "wide" ? p[axis] === 2 - side : p[axis] !== layer) return;
    const x = p[a] - 1,
      y = p[b] - 1;
    p[a] = 1 - sign * y;
    p[b] = 1 + sign * x;
    result[index(p)] = cell;
  });
  return result;
}
// Conventional notation in the explorer's displayed frame (game labels retain
// their historical R/L naming). Geometry index 4 is x-negative, index 5 positive.
export const NOTATION = [
  "U",
  "D",
  "F",
  "B",
  "L",
  "R",
  "M",
  "E",
  "S",
  "u",
  "d",
  "f",
  "b",
  "l",
  "r",
];
export function parseMoves(tokens) {
  return tokens.flatMap((token) => {
    const match = /^([UDFBLRMESudfblr])(['2]?)$/.exec(token);
    if (!match) throw Error(`Unsupported move: ${token}`);
    const move = NOTATION.indexOf(match[1]);
    return match[2] === "2"
      ? [move, move]
      : [move + (match[2] === "'" ? 15 : 0)];
  });
}
export const ROTATIONS = [];
for (const axes of [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
]) {
  const inversions = axes.reduce(
    (n, a, i) => n + axes.slice(i + 1).filter((b) => a > b).length,
    0,
  );
  for (const a of [-1, 1])
    for (const b of [-1, 1])
      for (const c of [-1, 1]) {
        const signs = [a, b, c];
        if ((inversions % 2 ? -1 : 1) * a * b * c !== 1) continue;
        ROTATIONS.push(
          Array.from({ length: 27 }, (_, i) =>
            index(axes.map((axis, k) => 1 + signs[k] * (xyz(i)[axis] - 1))),
          ),
        );
      }
}
ROTATIONS.sort(
  (a, b) =>
    Number(b.every((v, i) => v === i)) - Number(a.every((v, i) => v === i)),
);
const descriptor = (cells) =>
  [
    cells.filter((i) => kind(i) === 3).length,
    cells.filter((i) => kind(i) === 2).length,
    cells
      .filter((i) => kind(i) <= 1)
      .sort((a, b) => a - b)
      .join(","),
  ].join("/");

// Exact family invariant: corner/edge multiplicities and center positions for
// each physical piece, under 24 proper rotations. Extras stay a separate group.
export function practicePair(source, target) {
  const sourceGroups = source.masks.map(cellsOf),
    targetGroups = target.masks.map(cellsOf);
  const descriptors = sourceGroups.map(descriptor),
    extras = descriptor(cellsOf(source.extras));
  const colors = Array(27).fill("w");
  colors[13] = "l";
  sourceGroups.forEach((cells, id) =>
    cells.forEach((i) => (colors[i] = "bymogr"[id])),
  );
  const left = packingCells(source, colors);
  for (const rotation of ROTATIONS) {
    if (descriptor(cellsOf(target.extras).map((i) => rotation[i])) !== extras)
      continue;
    const used = new Set(),
      mapping = [];
    for (const group of targetGroups) {
      const key = descriptor(group.map((i) => rotation[i]));
      const id = descriptors.findIndex(
        (value, i) => value === key && !used.has(i),
      );
      if (id < 0) break;
      used.add(id);
      mapping.push(id);
    }
    if (mapping.length !== 6) continue;
    const right = Array.from({ length: 27 }, (_, i) => ({
      color: i === 13 ? "l" : "w",
      piece: -1,
    }));
    targetGroups.forEach((group, k) =>
      group.forEach(
        (i) =>
          (right[displayIndex(rotation[i])] = {
            color: "bymogr"[mapping[k]],
            piece: mapping[k],
          }),
      ),
    );
    return { left, right, compatible: true };
  }
  const targetColors = Array(27).fill("w");
  targetColors[13] = "l";
  targetGroups.forEach((cells, id) =>
    cells.forEach((i) => (targetColors[i] = "bymogr"[id])),
  );
  return { left, right: packingCells(target, targetColors), compatible: false };
}
export function matchesTarget(cells, target) {
  return ROTATIONS.some((rotation) =>
    cells.every((cell, i) => cell.color === target[rotation[i]].color),
  );
}
export function randomFamilyPair(packings, familyByLine, random = Math.random) {
  const buckets = new Map();
  for (const p of packings) {
    const id = familyByLine.get(p.lineNumber)?.family.id;
    if (id == null) continue;
    if (!buckets.has(id)) buckets.set(id, []);
    buckets.get(id).push(p);
  }
  const groups = [...buckets.values()].filter((g) => g.length >= 2);
  if (!groups.length) return null;
  const group = groups[Math.floor(random() * groups.length)],
    a = Math.floor(random() * group.length);
  const b = (a + 1 + Math.floor(random() * (group.length - 1))) % group.length;
  return [group[a], group[b]];
}
