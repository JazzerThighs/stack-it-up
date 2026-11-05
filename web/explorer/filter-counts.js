// Counts use catalog identities; lowercase j/s are the free non-facebound forms.
export const countSpecs = [
  ['O', 'O', 6],
  ['T', 'T', 6],
  ['S', 'Specifically S', 6],
  ['Z', 'Specifically Z', 6],
  ['J', 'Specifically J', 6],
  ['L', 'Specifically L', 6],
  ['JL', 'J/L free tetromino', 6],
  ['SZ', 'S/Z free tetromino', 6],
  ['B', 'Branch', 6],
  ['F', 'Left screw', 6],
  ['D', 'Right screw', 6],
  ['ExtraSingle', '1-fragment extra cubie', 3],
  ['ExtraDomino', '2-fragment extra cubie', 1],
  ['ExtraV', 'V-piece (Soma)', 1],
  ['ExtraBar', 'Straight 3-fragment', 1],
  ['ExtraCore', 'Extra cubies in core', 1],
  ['ExtraCenters', 'Extra cubies in centers', 3],
  ['ExtraEdges', 'Extra cubies in edges', 3],
  ['ExtraCorners', 'Extra cubies in corners', 3],
  ['Facebound', 'Facebound pieces', 6],
  ['SurfaceNonface', 'Non-facebound surface pieces', 6],
  ['CorePieces', 'Core-occupying pieces', 1],
];
export const countLimits = Object.fromEntries(
  countSpecs.map(([id, , max]) => [id, max]),
);
export const pieceCountTypes = new Set([
  'O',
  'T',
  'S',
  'Z',
  'J',
  'L',
  'JL',
  'SZ',
  'B',
  'F',
  'D',
]);
export function identityCount(bag, type) {
  let n = 0;
  for (const letter of bag) {
    if (
      type === 'JL'
        ? 'JLj'.includes(letter)
        : type === 'SZ'
          ? 'SZs'.includes(letter)
          : 'JLSZ'.includes(type)
            ? letter === type
            : letter.toUpperCase() === type
    )
      n++;
  }
  return n;
}
export const bitCount = (n) => {
  let c = 0;
  while (n) {
    n &= n - 1;
    c++;
  }
  return c;
};
export function familyExtraCounts(invariant) {
  const n = parseInt(invariant.split('-').at(-1), 16);
  return {
    ExtraCore: (n >>> 15) & 1,
    ExtraCenters: bitCount(n & 63),
    ExtraEdges: (n >>> 6) & 7,
    ExtraCorners: (n >>> 9) & 7,
  };
}
export function indexedCounts(flags, spatial, core, span, gaps, extras) {
  const connected3 = !!(gaps & 3),
    domino = !!(gaps & 4) && !connected3;
  return {
    ...extras,
    ExtraSingle: connected3 ? 0 : domino ? 1 : 3,
    ExtraDomino: Number(domino),
    ExtraV: Number(!!(gaps & 2)),
    ExtraBar: Number(!!(gaps & 1)),
    Facebound: 6 - bitCount(spatial | core | span),
    SurfaceNonface: bitCount((spatial | span) & ~core),
    CorePieces: bitCount(core),
  };
}
export const filterPresets = [
  ['planar', 'Planar tetrominos only'],
  ['spatial', 'Spatial tetrominos only'],
  ['pieces', 'All tetrominos'],
  ['surface', 'Surfacebound only'],
  ['nonface', 'Non-facebound surface only'],
  ['face', 'Facebound only'],
  ['core', 'Non-surfacebound only'],
  ['placements', 'All placement types'],
  ['six', 'All-6 planar tetrominos (JLOTSZ)'],
  ['faceSix', 'Facebound + All-6 Bag'],
  ['official', 'Tetris × Rubik’s Cube compatible (Family 562)'],
  ['soma', 'Soma Cube'],
  ['sloth', 'Slothouber–Graatsma puzzle (OOOOOO)'],
];
export function presetCounts(name, current = {}, currentFamily = 0) {
  if (name === 'faceSix') {
    const six = presetCounts('six', current, currentFamily);
    return presetCounts('face', six.ranges, six.family);
  }
  const ranges = Object.fromEntries(
    countSpecs.map(([id, , max]) => [id, { min: 0, max }]),
  );
  const resetAll = name === 'all';
  if (!resetAll)
    for (const [id, value] of Object.entries(current))
      if (ranges[id]) ranges[id] = { ...value };
  const reset = (ids) => {
    for (const id of ids) ranges[id] = { min: 0, max: countLimits[id] };
  };
  if (['planar', 'spatial', 'pieces', 'six', 'soma', 'sloth'].includes(name))
    reset(pieceCountTypes);
  if (['surface', 'nonface', 'face', 'core', 'placements'].includes(name))
    reset(['Facebound', 'SurfaceNonface', 'CorePieces', 'ExtraCore']);
  if (['six', 'soma', 'sloth'].includes(name))
    reset(['ExtraSingle', 'ExtraDomino', 'ExtraV', 'ExtraBar']);
  const exact = (id, n) => (ranges[id] = { min: n, max: n });
  let family =
    resetAll || ['six', 'soma', 'sloth'].includes(name) ? 0 : currentFamily;
  if (name === 'planar') for (const id of ['B', 'D', 'F']) exact(id, 0);
  if (name === 'spatial')
    for (const id of ['O', 'T', 'J', 'L', 'S', 'Z', 'JL', 'SZ']) exact(id, 0);
  if (['surface', 'nonface', 'face'].includes(name)) {
    exact('CorePieces', 0);
    exact('ExtraCore', 1);
  }
  if (name === 'nonface') {
    ranges.SurfaceNonface.min = 1;
    ranges.Facebound.max = 5;
  }
  if (name === 'face') {
    exact('Facebound', 6);
    exact('SurfaceNonface', 0);
  }
  if (name === 'core') {
    exact('CorePieces', 1);
    exact('ExtraCore', 0);
    ranges.Facebound.max = 5;
    ranges.SurfaceNonface.max = 5;
  }
  if (name === 'six') {
    for (const id of ['O', 'T', 'J', 'L', 'S', 'Z']) exact(id, 1);
    exact('JL', 2);
    exact('SZ', 2);
    for (const id of ['B', 'D', 'F']) exact(id, 0);
  }
  if (name === 'soma') {
    for (const id of ['T', 'JL', 'SZ', 'B', 'D', 'F']) exact(id, 1);
    for (const id of ['J', 'L', 'S', 'Z']) ranges[id].max = 1;
    exact('O', 0);
    exact('ExtraV', 1);
    exact('ExtraSingle', 0);
    exact('ExtraDomino', 0);
    exact('ExtraBar', 0);
  }
  if (name === 'sloth') {
    exact('O', 6);
    for (const id of ['T', 'J', 'L', 'S', 'Z', 'JL', 'SZ', 'B', 'D', 'F'])
      exact(id, 0);
  }
  if (name === 'official') family = 562;
  return { ranges, family };
}
