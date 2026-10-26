import { createEngine } from "../engine/wasm.js";
import { displayIdentity, canonicalColor } from "./model.js";
import { createExplorerViews } from "./views.js";
export async function initializeExplorer(root = document) {
  const meshEngine = await createEngine();
  const $ = (id) => root.getElementById(id);

  // ============================================================
  // CONSTANTS
  // ============================================================

  // Packing-file order:
  //
  //   mask 0 = J = blue
  //   mask 1 = O = yellow
  //   mask 2 = T = purple
  //   mask 3 = L = orange
  //   mask 4 = S = green
  //   mask 5 = Z = red
  //
  const PIECE_COLORS = {
    T: "m", // purple
    O: "y", // yellow
    JL1: "b", // blue
    JL2: "o", // orange
    SZ1: "g", // green
    SZ2: "r", // red
  };
  const UNKNOWN_PIECE_COLOR = "d";

  const CORE = 13;
  const FULL = (1 << 27) - 1;

  /*
   * Logical cubie labels.
   *
   * These correspond directly to bit positions 0..26:
   *
   *   1 = cell 0
   *   2 = cell 1
   *   ...
   *   9 = cell 8
   *   a = cell 9
   *   ...
   *   r = cell 26
   */
  const CUBIE_LABELS = "123456789abcdefghijklmnopqr";

  /*
   * Experimentally verified mapping from logical cubies to
   * AnimCubeJS's 54 facelet positions.
   *
   * AnimCube face order:
   *
   *   UUUUUUUUU
   *   DDDDDDDDD
   *   FFFFFFFFF
   *   BBBBBBBBB
   *   LLLLLLLLL
   *   RRRRRRRRR
   *
   * Each character says which logical cubie owns that sticker.
   */
  const ANIMCUBE_CUBIE_MAP =
    "123456789" + // U
    "jmpknqlor" + // D
    "1aj2bk3cl" + // F
    "9ir8hq7gp" + // B
    "147adgjmp" + // L
    "3cl6fo9ir"; // R
  const FACE_CUBIES = [
    "123456789", // U
    "jmpknqlor", // D
    "1aj2bk3cl", // F
    "9ir8hq7gp", // B
    "147adgjmp", // L
    "3cl6fo9ir", // R
  ];

  const J_2D = [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 0],
  ];

  const L_2D = [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
  ];

  const Z_2D = [
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 1],
  ];

  const S_2D = [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 2],
  ];

  function cubieLabelToCell(label) {
    const cell = CUBIE_LABELS.indexOf(label);

    if (cell === -1) {
      throw new Error(`Invalid cubie label "${label}"`);
    }

    return cell;
  }

  const FACE_MASKS = FACE_CUBIES.map((face) =>
    [...face].reduce((mask, label) => mask | (1 << cubieLabelToCell(label)), 0),
  );

  const MOVE_FACES = ["R", "L", "U", "D", "F", "B"];
  const MOVE_SUFFIXES = ["", "'", "2"];

  // ============================================================
  // STATE
  // ============================================================

  let packings = [];
  const packingsByLine = new Map();
  let selected = 0;
  let scramble = [];
  let solution = [];

  let packingIndices = {
    all: [],
    surfaceOnly: [],
    oneOfEach: [],
    allSurfaceIdentities: [],
    surfaceOnly_oneOfEach: [],
    surfaceOnly_allSurfaceIdentities: [],
  };

  // AnimCube registers event listeners for each cube.
  // Remove the old listeners before replacing a rendered cube.
  window.acjs_removeListeners = window.acjs_removeListeners || [];
  window.acjs_get_var = window.acjs_get_var || [];

  // ============================================================
  // BITMASK HELPERS
  // ============================================================

  function coords(i) {
    return [Math.floor(i / 9), Math.floor((i % 9) / 3), i % 3];
  }

  function hasBit(mask, i) {
    return (mask & (1 << i)) !== 0;
  }

  function bits(mask) {
    const result = [];

    for (let i = 0; i < 27; i++) {
      if (hasBit(mask, i)) {
        result.push(i);
      }
    }

    return result;
  }

  // ============================================================
  // PACKING PARSER
  // ============================================================
  const REFINED_FAMILIES_URL = "./refined_families.txt";

  function parsePackings(text) {
    const result = [];
    const lines = text.split(/\r?\n/);

    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      const raw = lines[lineNumber].trim();

      if (!raw) {
        continue;
      }

      const tokens = raw.split(/\s+/);

      /*
       * Some generator output may begin with:
       *
       *   I
       *   II
       *   III
       *   IV
       *
       * Skip that prefix when present.
       */
      let start = 0;

      if (/^(I|II|III|IV)$/.test(tokens[0])) {
        start = 1;
      }

      const maskStrings = tokens.slice(start, start + 6);

      const extrasToken = tokens.find((token) => token.startsWith("extras="));

      if (maskStrings.length !== 6 || !extrasToken) {
        throw new Error(
          `Line ${lineNumber + 1}: ` +
            `expected six piece masks and extras=...`,
        );
      }

      if (!maskStrings.every((value) => /^[0-9a-fA-F]{1,8}$/.test(value))) {
        throw new Error(
          `Line ${lineNumber + 1}: ` + `invalid hexadecimal piece mask`,
        );
      }

      const masks = maskStrings.map((value) => parseInt(value, 16));

      const extrasString = extrasToken.slice("extras=".length);

      if (!/^[0-9a-fA-F]{1,8}$/.test(extrasString)) {
        throw new Error(`Line ${lineNumber + 1}: ` + `invalid extras mask`);
      }

      const extras = parseInt(extrasString, 16);

      /*
       * Every tetromino must contain exactly four cells
       * and must fit inside the 27-cell cube.
       */
      for (let pieceIndex = 0; pieceIndex < 6; pieceIndex++) {
        const mask = masks[pieceIndex];

        if (
          !Number.isFinite(mask) ||
          (mask & ~FULL) !== 0 ||
          bits(mask).length !== 4
        ) {
          throw new Error(
            `Line ${lineNumber + 1}: ` +
              `piece ${pieceIndex + 1} ` +
              `must occupy exactly four cells`,
          );
        }
      }

      /*
       * Make sure the six pieces don't overlap.
       */
      let occupied = 0;

      for (const mask of masks) {
        if ((occupied & mask) !== 0) {
          throw new Error(`Line ${lineNumber + 1}: ` + `piece masks overlap`);
        }

        occupied |= mask;
      }

      /*
       * Six tetrominoes occupy 24 cells.
       * The extras must be exactly the other three.
       */
      if (
        !Number.isFinite(extras) ||
        (extras & ~FULL) !== 0 ||
        bits(extras).length !== 3 ||
        (occupied & extras) !== 0 ||
        (occupied | extras) !== FULL
      ) {
        throw new Error(
          `Line ${lineNumber + 1}: ` +
            `extras must be exactly the three ` +
            `unoccupied cells`,
        );
      }

      result.push({
        lineNumber: lineNumber + 1,
        code: raw,
        masks,
        extras,
      });
    }

    return result;
  }
  function parseMetadata(text) {
    const result = [];

    const lines = text.split(/\r?\n/);

    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      const raw = lines[lineNumber].trim();

      if (!raw) {
        continue;
      }

      const parts = raw.split(/\s+/);

      if (parts.length !== 2) {
        throw new Error(
          `Metadata line ${lineNumber + 1}: ` +
            `expected "<flags> <identities>"`,
        );
      }

      const [flagsText, identitiesText] = parts;

      if (!/^[0-7]$/.test(flagsText)) {
        throw new Error(
          `Metadata line ${lineNumber + 1}: ` + `invalid flags "${flagsText}"`,
        );
      }

      if (!/^[JLSZTOjlszto?]{6}$/.test(identitiesText)) {
        throw new Error(
          `Metadata line ${lineNumber + 1}: ` +
            `invalid identities "${identitiesText}"`,
        );
      }

      const flags = parseInt(flagsText, 16);

      result.push({
        surfaceOnly: (flags & 1) !== 0,

        allSurfaceIdentities: (flags & 2) !== 0,

        oneOfEach: (flags & 4) !== 0,

        identities: [...identitiesText].map((identity) =>
          "JLSZTO".includes(identity) ? identity : null,
        ),
      });
    }

    return result;
  }
  function buildPackingIndices() {
    const indices = {
      all: [],
      surfaceOnly: [],
      oneOfEach: [],
      allSurfaceIdentities: [],
      surfaceOnly_oneOfEach: [],
      surfaceOnly_allSurfaceIdentities: [],
    };

    for (let i = 0; i < packings.length; i++) {
      const packing = packings[i];

      indices.all.push(i);

      if (packing.surfaceOnly) {
        indices.surfaceOnly.push(i);
      }

      if (packing.oneOfEach) {
        indices.oneOfEach.push(i);
      }

      if (packing.allSurfaceIdentities) {
        indices.allSurfaceIdentities.push(i);
      }

      if (packing.surfaceOnly && packing.oneOfEach) {
        indices.surfaceOnly_oneOfEach.push(i);
      }

      if (packing.surfaceOnly && packing.allSurfaceIdentities) {
        indices.surfaceOnly_allSurfaceIdentities.push(i);
      }
    }

    packingIndices = indices;

    console.log("Packing indices:", {
      all: indices.all.length,

      surfaceOnly: indices.surfaceOnly.length,

      oneOfEach: indices.oneOfEach.length,

      allSurfaceIdentities: indices.allSurfaceIdentities.length,

      surfaceOnly_oneOfEach: indices.surfaceOnly_oneOfEach.length,

      surfaceOnly_allSurfaceIdentities:
        indices.surfaceOnly_allSurfaceIdentities.length,
    });
  }

  // ============================================================
  // ASSIGN COLORS TO THE 27 LOGICAL CUBIES
  // ============================================================

  function isSurfaceCenter(i) {
    const [x, y, z] = coords(i);

    const boundaryCount = [x, y, z].filter(
      (value) => value === 0 || value === 2,
    ).length;

    return boundaryCount === 1;
  }

  function centerCount(mask) {
    return bits(mask).filter(isSurfaceCenter).length;
  }

  function normalize2D(points) {
    const minRow = Math.min(...points.map(([row]) => row));

    const minCol = Math.min(...points.map(([, col]) => col));

    return points
      .map(([row, col]) => [row - minRow, col - minCol])
      .sort(([ar, ac], [br, bc]) => ar - br || ac - bc);
  }

  function rotate2D(points) {
    return normalize2D(points.map(([row, col]) => [col, -row]));
  }

  function same2DPattern(a, b) {
    const aa = normalize2D(a);
    const bb = normalize2D(b);

    return aa.every(([row, col], i) => row === bb[i][0] && col === bb[i][1]);
  }

  function sameUnder2DRotation(points, reference) {
    let current = normalize2D(reference);

    for (let rotation = 0; rotation < 4; rotation++) {
      if (same2DPattern(points, current)) {
        return true;
      }

      current = rotate2D(current);
    }

    return false;
  }

  // ============================================================
  // TETROMINO SHAPE IDENTIFICATION
  // ============================================================

  function projectPieceOntoFace(mask, faceIndex) {
    const face = FACE_CUBIES[faceIndex];

    const points = [];

    for (let position = 0; position < face.length; position++) {
      const cell = cubieLabelToCell(face[position]);

      if (hasBit(mask, cell)) {
        points.push([Math.floor(position / 3), position % 3]);
      }
    }

    // All four cells of the tetromino must
    // occur on this face.
    return points.length === 4 ? points : null;
  }

  function areNeighbors(a, b) {
    const [ax, ay, az] = coords(a);
    const [bx, by, bz] = coords(b);

    return Math.abs(ax - bx) + Math.abs(ay - by) + Math.abs(az - bz) === 1;
  }

  function identifyTetromino(mask) {
    const cells = bits(mask);

    if (cells.length !== 4) {
      throw new Error(
        `Tetromino mask must contain 4 cells, got ${cells.length}`,
      );
    }

    // Number of neighbors each cube has within this tetromino.
    const degrees = cells.map(
      (cell) =>
        cells.filter((other) => other !== cell && areNeighbors(cell, other))
          .length,
    );

    const sortedDegrees = [...degrees].sort((a, b) => a - b);

    // T:
    //
    //   X
    // XXX
    //
    // One cube touches the other three.
    if (sortedDegrees.join(",") === "1,1,1,3") {
      return "T";
    }

    // O:
    //
    // XX
    // XX
    //
    // Every cube touches two others.
    if (sortedDegrees.join(",") === "2,2,2,2") {
      return "O";
    }

    // Both J/L and S/Z have adjacency graph:
    //
    // X-X-X-X
    //
    // so both have degrees 1,1,2,2.
    //
    // We distinguish the geometric classes by looking at
    // the two degree-2 cubes.
    if (sortedDegrees.join(",") === "1,1,2,2") {
      const middleCells = cells.filter((_, index) => degrees[index] === 2);

      const [a, b] = middleCells;

      // Find the endpoint attached to each middle cell.
      const endpointA = cells.find(
        (cell) => degrees[cells.indexOf(cell)] === 1 && areNeighbors(cell, a),
      );

      const endpointB = cells.find(
        (cell) => degrees[cells.indexOf(cell)] === 1 && areNeighbors(cell, b),
      );

      const ca = coords(a);
      const cb = coords(b);
      const cea = coords(endpointA);
      const ceb = coords(endpointB);

      // Direction vectors from each middle cube toward
      // its attached endpoint.
      const va = [cea[0] - ca[0], cea[1] - ca[1], cea[2] - ca[2]];

      const vb = [ceb[0] - cb[0], ceb[1] - cb[1], ceb[2] - cb[2]];

      // For an S/Z piece, the two end segments point in
      // opposite directions.
      //
      // For a J/L piece, they are perpendicular.
      const dot = va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2];

      if (dot === -1) {
        return "SZ";
      }

      if (dot === 0) {
        return "JL";
      }
    }

    throw new Error(
      `Could not identify tetromino mask ${mask.toString(16).padStart(7, "0")}`,
    );
  }
  function identifySurfaceTetromino(mask, shape = identifyTetromino(mask)) {
    // Per our definition, a tetromino occupying
    // two centers doesn't receive a surface identity.
    if (centerCount(mask) > 1) {
      return null;
    }

    // Find a face containing all four cells.
    let projection = null;

    for (let faceIndex = 0; faceIndex < FACE_CUBIES.length; faceIndex++) {
      projection = projectPieceOntoFace(mask, faceIndex);

      if (projection) {
        break;
      }
    }

    if (!projection) {
      return null;
    }

    switch (shape) {
      case "T":
        return "T";

      case "O":
        return "O";

      case "JL":
        if (sameUnder2DRotation(projection, J_2D)) {
          return "J";
        }

        if (sameUnder2DRotation(projection, L_2D)) {
          return "L";
        }

        return null;

      case "SZ":
        if (sameUnder2DRotation(projection, S_2D)) {
          return "S";
        }

        if (sameUnder2DRotation(projection, Z_2D)) {
          return "Z";
        }

        return null;

      default:
        return null;
    }
  }

  function swapPiecePair(type) {
    const packing = packings[selected];

    if (!packing) {
      return;
    }

    const matchingIndices = [];

    for (let i = 0; i < packing.masks.length; i++) {
      if (identifyTetromino(packing.masks[i]) === type) {
        matchingIndices.push(i);
      }
    }

    if (matchingIndices.length !== 2) {
      throw new Error(
        `Expected exactly two ${type} pieces, ` +
          `found ${matchingIndices.length}.`,
      );
    }

    const [a, b] = matchingIndices;

    [packing.masks[a], packing.masks[b]] = [packing.masks[b], packing.masks[a]];

    updatePackingCode(packing);
    showSelected();
  }
  function centerCount(mask) {
    let count = 0;

    for (let cell = 0; cell < 27; cell++) {
      if (hasBit(mask, cell) && isSurfaceCenter(cell)) {
        count++;
      }
    }

    return count;
  }

  function allPiecesHaveSurfaceIdentities(packing) {
    return packing.masks.every(
      (mask) => identifySurfaceTetromino(mask) !== null,
    );
  }

  function hasOneOfEachTetromino(packing) {
    const identities = packing.masks.map((mask) =>
      identifySurfaceTetromino(mask, identifyTetromino(mask)),
    );

    if (identities.includes(null)) {
      return false;
    }

    const identitySet = new Set(identities);

    return (
      identitySet.size === 6 &&
      identitySet.has("J") &&
      identitySet.has("L") &&
      identitySet.has("S") &&
      identitySet.has("Z") &&
      identitySet.has("T") &&
      identitySet.has("O")
    );
  }

  function updatePackingCode(packing) {
    const masks = packing.masks
      .map((mask) => mask.toString(16).padStart(7, "0"))
      .join(" ");

    const extras = packing.extras.toString(16).padStart(7, "0");

    packing.code = `${masks} extras=${extras}`;
  }

  function isSurfaceOnlyPacking(packing) {
    return hasBit(packing.extras, CORE);
  }

  function indexedPackingIndices() {
    const surface = $("surfaceOnly").checked;

    const oneEach = $("oneOfEach").checked;

    const identified = $("allSurfaceIdentities").checked;

    // oneOfEach already implies identified.
    if (surface && oneEach) {
      return packingIndices.surfaceOnly_oneOfEach;
    }

    if (oneEach) {
      return packingIndices.oneOfEach;
    }

    if (surface && identified) {
      return packingIndices.surfaceOnly_allSurfaceIdentities;
    }

    if (surface) {
      return packingIndices.surfaceOnly;
    }

    if (identified) {
      return packingIndices.allSurfaceIdentities;
    }

    return packingIndices.all;
  }

  // A straight 1×1 passage spans three cells; the fourth I cell stays outside
  // as the piece slides through. Extras represent unoccupied packing cells.
  function hasITunnel(extras) {
    const cells = bits(extras).map(coords);
    return (
      cells.length === 3 &&
      [0, 1, 2].some(
        (axis) =>
          [0, 1, 2].every(
            (other) =>
              other === axis ||
              cells.every((c) => c[other] === cells[0][other]),
          ) && new Set(cells.map((c) => c[axis])).size === 3,
      )
    );
  }
  const additionalFilters = [
    "nonSurfaceOnly",
    "nonFaceboundSurface",
    "ungroupedOnly",
    "iTunnelOnly",
  ];
  const extraFilters = [
    ["extraEdges", 2],
    ["extraCorners", 3],
    ["extraCenters", 1],
  ];
  function basePackingIndices() {
    const activeExtras = extraFilters.filter(
      ([id]) => $(id).value && $(id).value !== "any",
    );
    return indexedPackingIndices().filter((i) => {
      const p = packings[i];
      if ($("iTunnelOnly").checked && !p.iTunnel) return false;
      if ($("nonSurfaceOnly").checked && p.surfaceOnly) return false;
      if (
        $("nonFaceboundSurface").checked &&
        (!p.surfaceOnly || p.allSurfaceIdentities)
      )
        return false;
      if ($("ungroupedOnly").checked && familyByLine.has(p.lineNumber))
        return false;
      return activeExtras.every(([id, kind]) => {
        const has = !!(p.extraKinds & (1 << kind));
        return $(id).value === "yes" ? has : !has;
      });
    });
  }
  function resetAdditionalFilters() {
    additionalFilters.forEach((id) => ($(id).checked = false));
    extraFilters.forEach(([id]) => ($(id).value = "any"));
  }
  const officialColors = new Map();
  const officialLines = new Set();
  const orbit = (cell) => coords(cell).filter((v) => v !== 1).length;
  const profile = (mask) =>
    [0, 1, 2, 3]
      .map((o) => bits(mask).filter((i) => orbit(i) === o).length)
      .join(",");
  let officialSource;
  let centerRotations;
  function initializeOfficial() {
    const officialFamily = familyByLine.get(77451)?.family;
    if (!officialFamily)
      throw new Error("Refined data has no official cube family");
    for (const [line] of officialFamily.members) officialLines.add(line);
    const source = packings.find((p) => p.lineNumber === 77451);
    if (!source) throw new Error("Official source packing is missing");
    officialSource = Array(27).fill("l");
    source.masks.forEach((mask, i) =>
      bits(mask).forEach((cell) => (officialSource[cell] = "brogym"[i])),
    );
    bits(source.extras).forEach(
      (cell) =>
        (officialSource[cell] =
          cell === CORE ? "l" : orbit(cell) === 1 ? "k" : "w"),
    );
    officialColors.set(77451, officialSource);
    centerRotations = [];
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
            centerRotations.push(
              [4, 10, 12, 14, 16, 22].map((i) => {
                const p = coords(i),
                  q = axes.map((axis, k) => 1 + signs[k] * (p[axis] - 1));
                return officialSource[q[0] * 9 + q[1] * 3 + q[2]];
              }),
            );
          }
    }
  }
  function deriveOfficialColors(packing) {
    const source = packings.find((p) => p.lineNumber === 77451);
    const profiles = source.masks.map(profile);
    const choices = packing.masks.map((mask) =>
      profiles
        .map((p, i) => (p === profile(mask) ? i : -1))
        .filter((i) => i >= 0),
    );
    const colors = Array(27).fill("l"),
      candidates = [];
    function assign(piece, used) {
      if (piece < 6) {
        for (const i of choices[piece])
          if (!(used & (1 << i))) {
            bits(packing.masks[piece]).forEach(
              (cell) => (colors[cell] = "brogym"[i]),
            );
            assign(piece + 1, used | (1 << i));
          }
        return;
      }
      const extras = bits(packing.extras);
      for (const singles of ["klw", "kwl", "lkw", "lwk", "wkl", "wlk"]) {
        if (
          !extras.every(
            (cell, i) =>
              orbit(cell) === orbit(officialSource.indexOf(singles[i])),
          )
        )
          continue;
        extras.forEach((cell, i) => (colors[cell] = singles[i]));
        if (
          centerRotations.some((rotation) =>
            [4, 10, 12, 14, 16, 22].every(
              (cell, i) => colors[cell] === rotation[i],
            ),
          )
        )
          candidates.push(colors.slice());
      }
    }
    assign(0, 0);
    const yellowO = (colors) =>
      packing.masks.some((mask) => {
        const cells = bits(mask),
          spans = [0, 1, 2]
            .map(
              (a) =>
                Math.max(...cells.map((i) => coords(i)[a])) -
                Math.min(...cells.map((i) => coords(i)[a])),
            )
            .sort();
        return (
          spans.join(",") === "0,1,1" && cells.every((i) => colors[i] === "y")
        );
      });
    candidates.sort(
      (a, b) =>
        Number(yellowO(b)) - Number(yellowO(a)) ||
        (a.join("") < b.join("") ? -1 : a.join("") > b.join("") ? 1 : 0),
    );
    return candidates[0] || null;
  }
  function officialColoring(packing) {
    if (!officialLines.has(packing.lineNumber)) return null;
    if (!officialColors.has(packing.lineNumber))
      officialColors.set(packing.lineNumber, deriveOfficialColors(packing));
    const colors = officialColors.get(packing.lineNumber);
    // Match the complete packing code as well as its source line.
    const reference = packingsByLine.get(packing.lineNumber);
    return colors && reference === packing ? colors : null;
  }
  const families = [];
  const familyByLine = new Map();
  function initializeFamilies(text) {
    for (const line of text.split(/\r?\n/)) {
      let match = line.match(
        /^FAMILY (\d+) score=(\d+) count=(\d+) bags=(\d+)$/,
      );
      if (match)
        families.push({
          id: +match[1],
          score: match[2],
          count: +match[3],
          bagCount: +match[4],
          members: [],
          bags: [],
        });
      else if (line.startsWith("BAGS "))
        families.at(-1).bags = line.split(/\s+/).slice(1);
      else if ((match = line.match(/^  line=(\d+) identities=([JLSZTOj?]{6})/)))
        families
          .at(-1)
          .members.push([+match[1], match[2].split("").sort().join("")]);
    }
    if (!families.length) throw new Error("No documented families found");
    families.forEach((f) => {
      f.seeds = f.members.filter((m) => m[1] === "JLOSTZ").length;
    });
    for (const family of families) {
      for (const [line, bag] of family.members)
        familyByLine.set(line, { family, bag });
    }
    $("familySelect").innerHTML =
      '<option value="">All packings</option>' +
      families
        .map(
          (f) =>
            `<option value="${f.id}">Family ${f.id} · ${f.score} · ${f.count} packings · ${f.bagCount} bags · ${f.seeds} 6-bag packings</option>`,
        )
        .join("");
  }
  function selectedFamily() {
    return families.find((f) => String(f.id) === $("familySelect").value);
  }
  function refreshFamilyOptions() {
    const select = $("familySelect");
    let previous = select.value || "";
    const matchingCounts = () => {
      const counts = new Map();
      const bag = $("familyBag").value || "";
      for (const i of basePackingIndices()) {
        const packing = packings[i];
        if ($("officialOnly").checked && !officialLines.has(packing.lineNumber))
          continue;
        const membership = familyByLine.get(packing.lineNumber);
        if (!membership || (bag && packing.bag !== bag)) continue;
        const id = membership.family.id;
        counts.set(id, (counts.get(id) || 0) + 1);
      }
      return counts;
    };
    let counts = matchingCounts();
    // Bag is global and remains selected even when its intersection is empty.
    if (previous && !counts.has(Number(previous))) previous = "";
    const visible = families.filter((f) => counts.has(f.id));
    select.innerHTML =
      `<option value="">All edge families (${visible.length})</option>` +
      visible
        .map(
          (f) =>
            `<option value="${f.id}">${f.id} · ${counts.get(f.id)} matching · ${f.seeds} 6-Bag</option>`,
        )
        .join("");
    select.value = previous;
    return visible.length;
  }
  function refreshBagOptions() {
    const previous = $("familyBag").value || "",
      counts = new Map();
    for (const { bag } of packings) counts.set(bag, (counts.get(bag) || 0) + 1);
    const options = (facebound) =>
      [...counts]
        .filter(([bag]) => /^[JLOSTZ]+$/.test(bag) === facebound)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(
          ([bag, count]) => `<option value="${bag}">${bag} · ${count}</option>`,
        )
        .join("");
    $("familyBag").innerHTML =
      '<option value="">All bags</option><optgroup label="Facebound bags">' +
      options(true) +
      '</optgroup><optgroup label="Bags with non-facebound pieces">' +
      options(false) +
      "</optgroup>";
    $("familyBag").value = previous;
    $("familyBag").disabled = false;
  }
  function familyChanged() {
    if (selectedFamily()) $("ungroupedOnly").checked = false;
    filterChanged();
  }
  function updateFamilySummary() {
    const family = selectedFamily();
    $("familySummary").textContent = family
      ? `Edge family ${family.id} · ${selectablePackingIndices().length} matches · ${family.seeds} 6-Bag`
      : `${families.length} edge families · ${selectablePackingIndices().length.toLocaleString()} matches`;
  }
  $("familySelect").addEventListener("change", familyChanged);
  $("familyBag").addEventListener("change", filterChanged);
  $("familyBag").disabled = false;
  $("exploreFamily").addEventListener("click", () => {
    if (!selectedFamily()) {
      const membership = familyByLine.get(packings[selected]?.lineNumber);
      $("familySelect").value = String(
        membership ? membership.family.id : families[0]?.id || "",
      );
    }
    for (const id of [
      "oneOfEach",
      "surfaceOnly",
      "allSurfaceIdentities",
      "officialOnly",
    ])
      $(id).checked = false;
    $("familyBag").value = "";
    resetAdditionalFilters();
    familyChanged();
  });
  function selectablePackingIndices() {
    const choices = basePackingIndices();
    const family = selectedFamily();
    return choices.filter((i) => {
      if (
        $("officialOnly").checked &&
        !officialLines.has(packings[i].lineNumber)
      )
        return false;
      const membership = familyByLine.get(packings[i].lineNumber);
      return (
        (!family || membership?.family === family) &&
        (!$("familyBag").value || packings[i].bag === $("familyBag").value)
      );
    });
  }

  const positionalColorCache = new Map();
  function positionalColoring(packing) {
    const key = packing.masks.join(",");
    if (positionalColorCache.has(key)) return positionalColorCache.get(key);
    const overlap = packing.masks.map((mask) =>
      FACE_MASKS.map((face) => bits(mask & face).length),
    );
    const tPieces = packing.identities
      .map((v, i) => (v === "T" ? i : -1))
      .filter((i) => i >= 0);
    let best = -1,
      result;
    function assign(faces, used, score) {
      const i = faces.length;
      if (i < 6) {
        for (let f = 0; f < 6; f++)
          if (!(used & (1 << f)))
            assign([...faces, f], used | (1 << f), score + overlap[i][f]);
        return;
      }
      if (score <= best) return;
      // Face order is U,D,F,B,L,R: each adjacent pair is opposite.
      const purple = tPieces.length ? faces[tPieces[0]] : 0;
      const faceColors = Array(6);
      faceColors[purple] = "m";
      faceColors[purple ^ 1] = "y";
      const green = [4, 2, 0, 5, 3, 1].find((f) => !faceColors[f]);
      faceColors[green] = "g";
      faceColors[green ^ 1] = "r";
      const blue = [2, 0, 4, 3, 1, 5].find((f) => !faceColors[f]);
      faceColors[blue] = "b";
      faceColors[blue ^ 1] = "o";
      const colors = Array(27).fill("d");
      packing.masks.forEach((mask, p) =>
        bits(mask).forEach((cell) => (colors[cell] = faceColors[faces[p]])),
      );
      paintExtraColors(packing, colors);
      best = score;
      result = {
        colors,
        faces: faces.slice(),
        faceColors,
        exact: score === 24,
      };
    }
    assign([], 0, 0);
    positionalColorCache.set(key, result);
    return result;
  }

  // Only the core may be gray; reserve black for one extra face center.
  // Without either location, its color is unused and the extras stay white.
  function paintExtraColors(packing, colors) {
    const extras = bits(packing.extras);
    const black = extras.find(isSurfaceCenter);
    extras.forEach(
      (cell) =>
        (colors[cell] = cell === CORE ? "l" : cell === black ? "k" : "w"),
    );
    return colors;
  }

  function assignCellColors(packing) {
    if ($("positionalColors").checked)
      return positionalColoring(packing).colors;
    if ($("officialColors").checked) {
      const colors = officialColoring(packing);
      if (colors) {
        return paintExtraColors(packing, colors.slice());
      }
    }
    const cellColors = Array(27).fill(null);

    function paint(mask, color) {
      for (const cell of bits(mask)) {
        cellColors[cell] = color;
      }
    }

    for (let i = 0; i < packing.masks.length; i++) {
      const mask = packing.masks[i];

      const identity = packing.identities[i];

      const color =
        identity === null ? UNKNOWN_PIECE_COLOR : canonicalColor(identity);

      paint(mask, color);
    }

    paintExtraColors(packing, cellColors);

    return cellColors;
  }

  // ============================================================
  // CELL COLORS -> ANIMCUBE FACELETS
  // ============================================================
  //
  // There are intentionally NO coordinate transformations here.
  //
  // No rotations.
  // No reflections.
  // No per-face permutations.
  //
  // ANIMCUBE_CUBIE_MAP is the complete experimentally measured
  // mapping.
  //
  // ============================================================

  function toFacelets(cellColors) {
    return [...ANIMCUBE_CUBIE_MAP]
      .map((cubieLabel) => {
        const cell = CUBIE_LABELS.indexOf(cubieLabel);

        if (cell === -1) {
          throw new Error(
            `Invalid cubie label ` +
              `"${cubieLabel}" in ` +
              `ANIMCUBE_CUBIE_MAP`,
          );
        }

        const color = cellColors[cell];

        if (color == null) {
          throw new Error(
            `Logical cubie ${cell} ` + `(${cubieLabel}) has no color`,
          );
        }

        return color;
      })
      .join("");
  }

  // ============================================================
  // SCRAMBLE GENERATION
  // ============================================================

  function randomScramble(length = 25) {
    const moves = [];

    const axis = {
      U: "UD",
      D: "UD",
      R: "RL",
      L: "RL",
      F: "FB",
      B: "FB",
    };

    while (moves.length < length) {
      const face = MOVE_FACES[Math.floor(Math.random() * MOVE_FACES.length)];

      const previousFace =
        moves.length >= 1 ? moves[moves.length - 1][0] : null;

      const twoBackFace = moves.length >= 2 ? moves[moves.length - 2][0] : null;

      // Never repeat the exact same face consecutively.
      if (face === previousFace) {
        continue;
      }

      // Don't allow A B A when A and B are opposite faces
      // on the same axis:
      //
      // U D U
      // R L R
      // F B F
      if (
        previousFace &&
        twoBackFace &&
        axis[face] === axis[previousFace] &&
        axis[face] === axis[twoBackFace]
      ) {
        continue;
      }

      const suffix =
        MOVE_SUFFIXES[Math.floor(Math.random() * MOVE_SUFFIXES.length)];

      moves.push(face + suffix);
    }

    return moves;
  }

  function inverseMoves(moves) {
    return [...moves].reverse().map((move) => {
      if (move.endsWith("2")) {
        return move;
      }

      if (move.endsWith("'")) {
        return move.slice(0, -1);
      }

      return move + "'";
    });
  }

  const views = createExplorerViews({
    meshGenerator: mask => meshEngine.bandMesh(mask),
    root,
    getPackings: () => packings,
    getChoices: selectablePackingIndices,
    getFamilies: () => familyByLine,
  });
  const renderPieceModel = views.showPieces;
  const renderCube = views.showCube;

  // ============================================================
  // DISPLAY CURRENT PUZZLE
  // ============================================================

  let activeCubeView = "solved";
  function syncCubeViews() {
    const scrambled = $("showScrambled").checked;
    const solved = $("showSolved").checked;
    $("scrambledPanel").hidden = !scrambled;
    $("solvedPanel").hidden = !solved;
    $("cubeLayout").dataset.views = Number(scrambled) + Number(solved);
    $("emptyView").hidden = scrambled || solved;
    if (activeCubeView === "scrambled" && !scrambled) activeCubeView = "solved";
    if (activeCubeView === "solved" && !solved && scrambled) activeCubeView = "scrambled";
    $("cubeLayout").dataset.active = activeCubeView;
    $("viewTabs").hidden = Number(scrambled) + Number(solved) < 2;
    $("viewSolved").setAttribute("aria-pressed", String(activeCubeView === "solved"));
    $("viewScrambled").setAttribute(
      "aria-pressed",
      String(activeCubeView === "scrambled"),
    );
    for (const [id, visible] of [
      ["scrambledCube", scrambled],
      ["solvedCube", solved],
    ]) {
      if (!visible) {
        views.hide(id);
      }
    }
  }

  function showSelected() {
    const packing = packings[selected];

    if (!packing) {
      return;
    }
    $("sourceLine").value = packing.lineNumber;

    updateFamilySummary();
    const membership = familyByLine.get(packing.lineNumber);
    $("packingFamily").textContent = membership
      ? `Edge family ${membership.family.id} · ${membership.bag}`
      : "No documented edge family";
    syncCubeViews();
    const cellColors = assignCellColors(packing);
    const facelets = toFacelets(cellColors);
    renderPieceModel(packing, cellColors);

    $("scrambleText").textContent = scramble.join(" ");
    $("solutionText").textContent = solution.join(" ");

    const choices = selectablePackingIndices();

    const filtering =
      $("surfaceOnly").checked ||
      $("oneOfEach").checked ||
      $("allSurfaceIdentities").checked ||
      $("officialOnly").checked ||
      !!selectedFamily() ||
      !!$("familyBag").value ||
      additionalFilters.some((id) => $(id).checked) ||
      extraFilters.some(([id]) => $(id).value && $(id).value !== "any");

    if (filtering) {
      const filteredPosition = choices.indexOf(selected) + 1;

      $("packingIndex").textContent =
        `${filteredPosition} of ${choices.length} matching ` +
        `(source line ${packing.lineNumber})`;
    } else {
      $("packingIndex").textContent =
        `${selected + 1} of ${packings.length} ` +
        `(source line ${packing.lineNumber})`;
    }

    $("packingCode").textContent = packing.code;

    if ($("showScrambled").checked)
      renderCube("scrambledCube", packing, cellColors, scramble);

    $("solvedPanel").hidden = !$("showSolved").checked;

    $("solvedFacelets").textContent = facelets.toString();
    if ($("showSolved").checked) {
      renderCube("solvedCube", packing, cellColors);
      $("solvedFacelets").textContent = facelets.toString();
    }
    const colorNames = {
      b: "blue",
      o: "orange",
      g: "green",
      r: "red",
      m: "purple",
      y: "yellow",
      d: "gray",
    };
    const transportedColors = $("positionalColors").checked
      ? positionalColoring(packing).colors
      : $("officialColors").checked
        ? officialColoring(packing)
        : null;
    const identities = packing.identities
      .map((identity, i) => {
        const label =
          identity !== null
            ? displayIdentity(identity)
            : `${identifyTetromino(packing.masks[i])}?`;
        const color = transportedColors
          ? transportedColors[bits(packing.masks[i])[0]]
          : identity === null
            ? UNKNOWN_PIECE_COLOR
            : canonicalColor(identity);
        return { label, color: colorNames[color] || color };
      })
      .sort(
        (a, b) =>
          a.label.localeCompare(b.label) || a.color.localeCompare(b.color),
      );

    $("pieceIdentities").textContent =
      `Pieces: ${identities.map((piece) => `${piece.label} (${piece.color})`).join(" · ")}`;
    $("colorStatus").textContent = $("positionalColors").checked
      ? `Multicolor · ${positionalColoring(packing).exact ? "opposite-face match" : "closest placement"}`
      : $("officialColors").checked
        ? officialColoring(packing)
          ? "Official colors"
          : "No official match · canonical colors"
        : "Canonical · colors by shape";

    $("previous").disabled = packings.length < 2;

    $("next").disabled = packings.length < 2;
  }
  function generateNewScramble() {
    scramble = randomScramble(25);
    solution = inverseMoves(scramble);
  }
  // ============================================================
  // LOAD PACKINGS
  // ============================================================
  async function fetchText(url) {
    const response = await fetch(new URL(url, import.meta.url));

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ` + `${response.statusText}: ${url}`,
      );
    }

    return response.text();
  }

  async function loadDatabase() {
    const [text, catalogText] = await Promise.all([
      fetchText(REFINED_FAMILIES_URL),
      fetchText(
        REFINED_FAMILIES_URL.replace(
          "refined_families.txt",
          "packings_with_metadata.txt",
        ),
      ),
    ]);
    initializeFamilies(text);
    const loaded = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line.trimStart().startsWith("line=")) continue;
      const match = line.match(
        /^\s+line=(\d+) identities=([JLSZTOj?]{6}) scores=(\d{6}) (.+)$/,
      );
      if (!match) throw new Error("Malformed refined family member");
      const sourceLine = Number(match[1]),
        fields = match[4].split(/\s+/);
      if (
        fields.length !== 11 ||
        !/^[0-7]$/.test(fields[7]) ||
        fields[8] !== match[2] ||
        fields[9] !== match[3]
      ) {
        throw new Error(
          `Inconsistent refined metadata at source line ${sourceLine}`,
        );
      }
      const packing = parsePackings(match[4])[0];
      const meta = parseMetadata(`${fields[7]} ${fields[8]}`)[0];
      Object.assign(packing, meta, {
        lineNumber: sourceLine,
        bag: [...fields[8]].sort().join(""),
      });
      if (!hasBit(packing.extras, CORE) || !meta.surfaceOnly)
        throw new Error(`Non-surface packing at source line ${sourceLine}`);
      if (packingsByLine.has(sourceLine))
        throw new Error(`Duplicate source line ${sourceLine}`);
      packingsByLine.set(sourceLine, packing);
      loaded.push(packing);
    }
    for (const family of families) {
      if (
        family.members.length !== family.count ||
        new Set(family.members.map((m) => m[1])).size !== family.bagCount
      ) {
        throw new Error(`Refined family ${family.id} count mismatch`);
      }
      if (!family.members.every(([line]) => packingsByLine.has(line)))
        throw new Error(`Refined family ${family.id} has missing packing data`);
    }
    if (!loaded.length || loaded.length !== familyByLine.size)
      throw new Error("Refined family membership mismatch");
    const catalog = parsePackings(catalogText);
    const rows = catalogText
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => line.trim().split(/\s+/));
    const metadata = parseMetadata(
      rows.map((fields) => fields[7] + " " + fields[8]).join("\n"),
    );
    if (catalog.length !== metadata.length)
      throw new Error("Catalog metadata count mismatch");
    catalog.forEach((p, i) => {
      Object.assign(p, metadata[i], {
        iTunnel: hasITunnel(p.extras),
        bag: [...rows[i][8]].sort().join(""),
        extraKinds: bits(p.extras).reduce(
          (mask, cell) => mask | (1 << orbit(cell)),
          0,
        ),
      });
      const member = packingsByLine.get(p.lineNumber);
      if (
        member &&
        (member.extras !== p.extras ||
          member.masks.some((mask, k) => mask !== p.masks[k]) ||
          member.bag !== p.bag)
      )
        throw new Error(
          "Catalog/family mismatch at source line " + p.lineNumber,
        );
      packingsByLine.set(p.lineNumber, p);
    });
    const catalogLines = new Set(catalog.map((p) => p.lineNumber));
    if (loaded.some((p) => !catalogLines.has(p.lineNumber)))
      throw new Error("Missing catalog family member");
    return catalog;
  }

  // ============================================================
  // RANDOM PACKING
  // ============================================================

  function chooseRandomPacking() {
    if (!packings.length) {
      return;
    }

    const choices = selectablePackingIndices();

    if (choices.length === 0) {
      $("status").textContent = "No surface-only packings found.";
      return;
    }

    // Avoid selecting the current packing again when possible.
    const alternatives = choices.filter((index) => index !== selected);

    const pool = alternatives.length > 0 ? alternatives : choices;

    selected = pool[Math.floor(Math.random() * pool.length)];

    generateNewScramble();
    showSelected();
  }

  // ============================================================
  // PREVIOUS / NEXT
  // ============================================================

  function previousPacking() {
    const choices = selectablePackingIndices();

    if (!choices.length) {
      return;
    }

    let position = choices.indexOf(selected);

    // If somehow the current selection isn't in the filtered
    // set, start at the beginning.
    if (position === -1) {
      position = 0;
    } else {
      position = (position - 1 + choices.length) % choices.length;
    }

    selected = choices[position];

    generateNewScramble();
    showSelected();
  }

  function nextPacking() {
    const choices = selectablePackingIndices();

    if (!choices.length) {
      return;
    }

    let position = choices.indexOf(selected);

    if (position === -1) {
      position = 0;
    } else {
      position = (position + 1) % choices.length;
    }

    selected = choices[position];

    generateNewScramble();
    showSelected();
  }
  // ============================================================
  // COPY PACKING CODE
  // ============================================================

  async function copyPackingCode() {
    const text = $("packingCode").textContent;

    try {
      await navigator.clipboard.writeText(text);

      $("copyCode").textContent = "Copied!";

      setTimeout(() => {
        $("copyCode").textContent = "Copy packing code";
      }, 1200);
    } catch {
      $("status").textContent =
        "Clipboard access failed; " +
        "select and copy the packing " +
        "code manually.";
    }
  }

  // ============================================================
  // UI EVENTS
  // ============================================================

  $("random").addEventListener("click", chooseRandomPacking);

  $("previous").addEventListener("click", previousPacking);

  $("next").addEventListener("click", nextPacking);
  function skipPackings(offset) {
    const choices = selectablePackingIndices();
    if (!choices.length) return;
    const position = Math.max(0, choices.indexOf(selected));
    selected =
      choices[
        (((position + offset) % choices.length) + choices.length) %
          choices.length
      ];
    $("jumpStatus").textContent = "";
    generateNewScramble();
    showSelected();
  }
  for (const [id, offset] of [
    ["back100", -100],
    ["back10", -10],
    ["forward10", 10],
    ["forward100", 100],
  ]) {
    $(id).addEventListener("click", () => skipPackings(offset));
  }
  $("sourceJump").addEventListener("submit", (event) => {
    event.preventDefault();
    const line = Number($("sourceLine").value),
      target = packings.findIndex((p) => p.lineNumber === line);
    if (!Number.isSafeInteger(line) || line < 1 || target < 0) {
      $("jumpStatus").textContent = "Source line not found.";
      return;
    }
    const excluded = !selectablePackingIndices().includes(target);
    if (excluded) {
      for (const id of [
        "oneOfEach",
        "surfaceOnly",
        "allSurfaceIdentities",
        "officialOnly",
      ])
        $(id).checked = false;
      $("familySelect").value = "";
      $("familyBag").value = "";
      resetAdditionalFilters();
      refreshFamilyOptions();
    }
    selected = target;
    generateNewScramble();
    filterChanged();
    $("jumpStatus").textContent = excluded
      ? "Filters cleared for this line."
      : "";
  });

  function viewChanged() {
    syncCubeViews();
    showSelected();
  }
  $("viewSolved").addEventListener("click", () => {
    activeCubeView = "solved";
    viewChanged();
  });
  $("viewScrambled").addEventListener("click", () => {
    activeCubeView = "scrambled";
    viewChanged();
  });
  $("showSolved").addEventListener("change", viewChanged);
  $("showScrambled").addEventListener("change", viewChanged);

  $("copyCode").addEventListener("click", copyPackingCode);

  function filterChanged() {
    if ($("surfaceOnly").checked) $("nonSurfaceOnly").checked = false;
    if ($("allSurfaceIdentities").checked || $("oneOfEach").checked) {
      $("nonSurfaceOnly").checked = false;
      $("nonFaceboundSurface").checked = false;
    }
    refreshFamilyOptions();
    updateFamilySummary();
    const choices = selectablePackingIndices();

    if (choices.length === 0) {
      $("status").textContent =
        "No packings match the selected filters. The cube still shows the previous selection.";
      $("packingIndex").textContent = "Previous selection · no matches";
      for (const id of [
        "previous",
        "next",
        "random",
        "back100",
        "back10",
        "forward10",
        "forward100",
      ])
        $(id).disabled = true;
      return;
    }

    for (const id of [
      "previous",
      "next",
      "random",
      "back100",
      "back10",
      "forward10",
      "forward100",
    ])
      $(id).disabled = false;
    $("status").textContent =
      `${choices.length.toLocaleString()} packings match current filters.`;
    // Keep the current packing whenever it still
    // satisfies the new filter combination.
    if (choices.includes(selected)) {
      showSelected();
      return;
    }

    // Otherwise jump to a valid packing.
    selected = choices[Math.floor(Math.random() * choices.length)];

    generateNewScramble();
    showSelected();
  }

  for (const id of additionalFilters)
    $(id).addEventListener("change", () => {
      if ($(id).checked) {
        if (id === "nonSurfaceOnly") {
          $("surfaceOnly").checked = false;
          $("nonFaceboundSurface").checked = false;
          $("allSurfaceIdentities").checked = false;
          $("oneOfEach").checked = false;
        }
        if (id === "nonFaceboundSurface") {
          $("nonSurfaceOnly").checked = false;
          $("allSurfaceIdentities").checked = false;
          $("oneOfEach").checked = false;
        }
        if (id === "ungroupedOnly") $("familySelect").value = "";
      }
      filterChanged();
    });
  for (const [id] of extraFilters)
    $(id).addEventListener("change", filterChanged);
  $("surfaceOnly").addEventListener("change", filterChanged);

  $("oneOfEach").addEventListener("change", filterChanged);

  $("allSurfaceIdentities").addEventListener("change", filterChanged);

  $("officialOnly").addEventListener("change", filterChanged);
  for (const mode of [
    "canonicalColors",
    "officialColors",
    "positionalColors",
  ]) {
    $(mode).addEventListener("change", () => {
      for (const other of [
        "canonicalColors",
        "officialColors",
        "positionalColors",
      ])
        $(other).checked = other === mode;
      showSelected();
    });
  }

  // ============================================================
  // START
  // ============================================================

  async function init() {
    try {
      $("status").textContent = "Downloading packing database...";

      packings = await loadDatabase();
      initializeOfficial();

      $("status").textContent = "Building indices...";

      buildPackingIndices();
      refreshBagOptions();
      refreshFamilyOptions();

      selected = Math.max(
        0,
        packings.findIndex((p) => p.lineNumber === 77451),
      );

      generateNewScramble();
      showSelected();

      $("status").textContent =
        `Loaded ${packings.length.toLocaleString()} packings.`;
    } catch (error) {
      console.error("Failed to load packing database:", error);

      $("status").textContent =
        `Failed to load packing database: ` + error.message;
    }
  }

  $("closeSettings").addEventListener("click", () => {
    $("settingsPanel").open = false;
    $("settingsPanel").querySelector("summary").focus();
  });
  $("settingsPanel").addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      $("settingsPanel").open = false;
      $("settingsPanel").querySelector("summary").focus();
    }
  });
  return init();
}
export const ready = document.getElementById("cubeLayout") ? initializeExplorer() : null;
