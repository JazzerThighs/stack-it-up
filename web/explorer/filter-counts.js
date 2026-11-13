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
// Dropdown entries appear in this order. Edit IDs/labels here; no HTML changes.
export const filterPresetPlaceholder = 'Custom counts';
export const filterPresets = [
  ['pieces', 'Reset All Shape Inclusion Filters'],
  ['planar', 'Planar tetrominos only'],
  ['spatial', 'Spatial tetrominos only'],
  ['surface', 'Surfacebound only'],
  ['nonface', 'Non-facebound surface only'],
  ['face', 'Facebound only'],
  ['core', 'Non-surfacebound only'],
  ['placements', 'Reset All placement types'],
  ['six', 'All-6 planar tetrominos (JLOTSZ)'],
  ['faceSix', 'Facebound + All-6 Bag'],
  ['official', 'Tetris × Rubik’s Cube compatible (Family 562)'],
  ['soma', 'Soma Cube'],
  ['sloth', 'Slothouber–Graatsma puzzle (OOOOOO)'],
];
export function presetCounts(name, current = {}, currentFamily = 0) {
  /* EDITING TEMPLATE
   * Each case below is deliberately self-contained. Repeated assignments make
   * it possible to edit one preset without changing another preset's behavior.
   * Start from the current counts/family; omitted rows keep their current values.
   * Missing rows start unrestricted (0 through the maximum in countSpecs).
   *
   * Copy a case and use these operations:
   *   case 'myPreset':
   *     ranges.T = { min: 1, max: 1 }; // Require exactly one T.
   *     ranges.O = { min: 0, max: 0 }; // Exclude O entirely.
   *     ranges.B = { min: 2, max: 6 }; // Require at least two branches.
   *     ranges.JL = { min: 0, max: 6 }; // Remove this row's restriction.
   *     // Omit ranges.ExtraV to preserve the player's current V restriction.
   *     family = 562; // Restrict to this family; 0 means all families.
   *     // Omit family to preserve the player's current family restriction.
   *     break;
   *
   * Keys and allowed maxima are listed in countSpecs above. Min/max are inclusive.
   * Keep 0 <= min <= max <= that row's maximum. This function does not clamp values.
   * All count restrictions AND together; incompatible choices yield no matches.
   * JL counts J + L + non-facebound j; SZ counts S + Z + non-facebound s.
   * Therefore an all-six bag needs JL=2 and SZ=2, not 1. Individual J/L/S/Z
   * rows count only their facebound identities. B=branch, D=right screw, F=left screw.
   * Extras shape rows count whole connected components, not overlapping subshapes.
   * Facebound + SurfaceNonface + CorePieces always totals six.
   *
   * To add a selectable preset, also add its ID/label to filterPresets above;
   * the menu is populated from that list at startup. No HTML edits are needed.
   * 'all' is the separate Reset button.
   * This function returns { ranges, family }; it does not run the database query.
   */
  const ranges = Object.fromEntries(
    countSpecs.map(([id, , max]) => [id, { min: 0, max }]),
  );
  // Copy, rather than mutate, the caller's existing range objects.
  for (const [id, value] of Object.entries(current)) {
    if (ranges[id]) ranges[id] = { ...value };
  }
  let family = currentFamily;

  switch (name) {
    case 'all':
      // Reset every filter count and family restriction.
      ranges.O = { min: 0, max: 6 };
      ranges.T = { min: 0, max: 6 };
      ranges.S = { min: 0, max: 6 };
      ranges.Z = { min: 0, max: 6 };
      ranges.J = { min: 0, max: 6 };
      ranges.L = { min: 0, max: 6 };
      ranges.JL = { min: 0, max: 6 };
      ranges.SZ = { min: 0, max: 6 };
      ranges.B = { min: 0, max: 6 };
      ranges.F = { min: 0, max: 6 };
      ranges.D = { min: 0, max: 6 };
      ranges.ExtraSingle = { min: 0, max: 3 };
      ranges.ExtraDomino = { min: 0, max: 1 };
      ranges.ExtraV = { min: 0, max: 1 };
      ranges.ExtraBar = { min: 0, max: 1 };
      ranges.ExtraCore = { min: 0, max: 1 };
      ranges.ExtraCenters = { min: 0, max: 3 };
      ranges.ExtraEdges = { min: 0, max: 3 };
      ranges.ExtraCorners = { min: 0, max: 3 };
      ranges.Facebound = { min: 0, max: 6 };
      ranges.SurfaceNonface = { min: 0, max: 6 };
      ranges.CorePieces = { min: 0, max: 1 };
      family = 0;
          break;
      
    case 'family0':
      // Reset to family 0.
      family = 0;
          break;

    case 'planar':
      // Reset piece counts; exclude spatial pieces. Preserve placement, extras and family.
      ranges.O = { min: 0, max: 6 };
      ranges.T = { min: 0, max: 6 };
      ranges.S = { min: 0, max: 6 };
      ranges.Z = { min: 0, max: 6 };
      ranges.J = { min: 0, max: 6 };
      ranges.L = { min: 0, max: 6 };
      ranges.JL = { min: 0, max: 6 };
      ranges.SZ = { min: 0, max: 6 };
      ranges.B = { min: 0, max: 0 };
      ranges.F = { min: 0, max: 0 };
      ranges.D = { min: 0, max: 0 };
      break;

    case 'spatial':
      // Reset piece counts; exclude planar pieces. Preserve placement, extras and family.
      ranges.O = { min: 0, max: 0 };
      ranges.T = { min: 0, max: 0 };
      ranges.S = { min: 0, max: 0 };
      ranges.Z = { min: 0, max: 0 };
      ranges.J = { min: 0, max: 0 };
      ranges.L = { min: 0, max: 0 };
      ranges.JL = { min: 0, max: 0 };
      ranges.SZ = { min: 0, max: 0 };
      ranges.B = { min: 0, max: 6 };
      ranges.F = { min: 0, max: 6 };
      ranges.D = { min: 0, max: 6 };
      break;

    case 'pieces':
      // Remove only piece-count restrictions.
      ranges.O = { min: 0, max: 6 };
      ranges.T = { min: 0, max: 6 };
      ranges.S = { min: 0, max: 6 };
      ranges.Z = { min: 0, max: 6 };
      ranges.J = { min: 0, max: 6 };
      ranges.L = { min: 0, max: 6 };
      ranges.JL = { min: 0, max: 6 };
      ranges.SZ = { min: 0, max: 6 };
      ranges.B = { min: 0, max: 6 };
      ranges.F = { min: 0, max: 6 };
      ranges.D = { min: 0, max: 6 };
      break;

    case 'surface':
      // All pieces stay on the surface; the core must be an extra.
      ranges.Facebound = { min: 0, max: 6 };
      ranges.SurfaceNonface = { min: 0, max: 6 };
      ranges.CorePieces = { min: 0, max: 1 };
      ranges.ExtraCore = { min: 1, max: 1 };
      break;

    case 'nonface':
      // Surface-only, with at least one piece spanning faces.
      ranges.Facebound = { min: 0, max: 5 };
      ranges.SurfaceNonface = { min: 1, max: 6 };
      ranges.CorePieces = { min: 0, max: 1 };
      ranges.ExtraCore = { min: 1, max: 1 };
      break;

    case 'face':
      // All six pieces lie on outer faces.
      ranges.Facebound = { min: 6, max: 6 };
      ranges.SurfaceNonface = { min: 0, max: 6 };
      ranges.CorePieces = { min: 0, max: 1 };
      ranges.ExtraCore = { min: 1, max: 1 };
      break;

    case 'core':
      // Exactly one piece occupies the core; it cannot also be an extra.
      ranges.Facebound = { min: 0, max: 6 };
      ranges.SurfaceNonface = { min: 0, max: 6 };
      ranges.CorePieces = { min: 1, max: 1 };
      ranges.ExtraCore = { min: 0, max: 1 };
      break;

    case 'placements':
      // Remove only placement-type and extra-piece restrictions.
      ranges.ExtraSingle = { min: 0, max: 3 };
      ranges.ExtraDomino = { min: 0, max: 1 };
      ranges.ExtraV = { min: 0, max: 1 };
      ranges.ExtraBar = { min: 0, max: 1 };
      ranges.ExtraCore = { min: 0, max: 1 };
      ranges.ExtraCenters = { min: 0, max: 3 };
      ranges.ExtraEdges = { min: 0, max: 3 };
      ranges.ExtraCorners = { min: 0, max: 3 };
      ranges.Facebound = { min: 0, max: 6 };
      ranges.SurfaceNonface = { min: 0, max: 6 };
      ranges.CorePieces = { min: 0, max: 1 };
      break;

    case 'six':
      // O + T + two J/L + two S/Z (handedness is free). Reset extra shapes; preserve family and placement limits.
      ranges.O = { min: 1, max: 6 };
      ranges.T = { min: 1, max: 6 };
      ranges.S = { min: 0, max: 6 };
      ranges.Z = { min: 0, max: 6 };
      ranges.J = { min: 0, max: 6 };
      ranges.L = { min: 0, max: 6 };
      ranges.JL = { min: 2, max: 6 };
      ranges.SZ = { min: 2, max: 6 };
      ranges.B = { min: 0, max: 6 };
      ranges.F = { min: 0, max: 6 };
      ranges.D = { min: 0, max: 6 };
      ranges.ExtraSingle = { min: 0, max: 3 };
      ranges.ExtraDomino = { min: 0, max: 1 };
      ranges.ExtraV = { min: 0, max: 1 };
      ranges.ExtraBar = { min: 0, max: 1 };
      break;

    case 'faceSix':
      // Independent all-six facebound preset: edit here without changing the six or face cases.
      ranges.O = { min: 1, max: 6 };
      ranges.T = { min: 1, max: 6 };
      ranges.S = { min: 1, max: 6 };
      ranges.Z = { min: 1, max: 6 };
      ranges.J = { min: 1, max: 6 };
      ranges.L = { min: 1, max: 6 };
      ranges.JL = { min: 0, max: 6 };
      ranges.SZ = { min: 0, max: 6 };
      ranges.B = { min: 0, max: 6 };
      ranges.F = { min: 0, max: 6 };
      ranges.D = { min: 0, max: 6 };
      ranges.ExtraSingle = { min: 0, max: 3 };
      ranges.ExtraDomino = { min: 0, max: 1 };
      ranges.ExtraV = { min: 0, max: 1 };
      ranges.ExtraBar = { min: 0, max: 1 };
      ranges.Facebound = { min: 6, max: 6 };
      ranges.SurfaceNonface = { min: 0, max: 6 };
      ranges.CorePieces = { min: 0, max: 1 };
      ranges.ExtraCore = { min: 0, max: 1 };
      break;

    case 'official':
      // Change only the family; preserve every current count.
      family = 562;
      break;

    case 'soma':
      // Soma bag and V-shaped extras. Preserve placement and extra-coordinate limits.
      ranges.O = { min: 0, max: 6 };
      ranges.T = { min: 1, max: 6 };
      ranges.S = { min: 0, max: 6 };
      ranges.Z = { min: 0, max: 6 };
      ranges.J = { min: 0, max: 6 };
      ranges.L = { min: 0, max: 6 };
      ranges.JL = { min: 1, max: 6 };
      ranges.SZ = { min: 1, max: 6 };
      ranges.B = { min: 1, max: 6 };
      ranges.F = { min: 1, max: 6 };
      ranges.D = { min: 1, max: 6 };
      ranges.ExtraSingle = { min: 0, max: 3 };
      ranges.ExtraDomino = { min: 0, max: 1 };
      ranges.ExtraV = { min: 1, max: 1 };
      ranges.ExtraBar = { min: 0, max: 1 };
      break;

    case 'sloth':
      // Six O pieces. Reset extra shapes and family; preserve placement limits.
      ranges.O = { min: 6, max: 6 };
      ranges.T = { min: 0, max: 6 };
      ranges.S = { min: 0, max: 6 };
      ranges.Z = { min: 0, max: 6 };
      ranges.J = { min: 0, max: 6 };
      ranges.L = { min: 0, max: 6 };
      ranges.JL = { min: 0, max: 6 };
      ranges.SZ = { min: 0, max: 6 };
      ranges.B = { min: 0, max: 6 };
      ranges.F = { min: 0, max: 6 };
      ranges.D = { min: 0, max: 6 };
      ranges.ExtraSingle = { min: 0, max: 3 };
      ranges.ExtraDomino = { min: 0, max: 1 };
      ranges.ExtraV = { min: 0, max: 1 };
      ranges.ExtraBar = { min: 0, max: 1 };
      family = 2570;
      break;

    default:
      // Unknown/custom preset: preserve the current counts and family.
      break;
  }
  return { ranges, family };
}
