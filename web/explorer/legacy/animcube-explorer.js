(() => {
  const $ = (id) => document.getElementById(id);

  // AnimCube handles document-level gesture starts by canvas coordinates,
  // including taps on controls overlaid on that canvas. Keep control gestures
  // local without cancelling native checkbox activation or panel scrolling.
  document.querySelectorAll(".toolbar, .view-tabs, .packing-info, .jelly-controls").forEach((controls) => {
    for (const type of ["touchstart", "mousedown"]) {
      controls.addEventListener(type, (event) => event.stopPropagation(), { passive: true });
    }
  });

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
    SZ2: "r" // red
  };
  const IDENTITY_COLORS = {
    T: "m",
    O: "y",
    J: "b",
    L: "o",
    S: "g",
    Z: "r"
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
    "3cl6fo9ir"  // R
  ];

  const J_2D = [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 0]
  ];
  
  const L_2D = [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2]
  ];
  
  const Z_2D = [
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 1]
  ];
  
  const S_2D = [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 2]
  ];

  function cubieLabelToCell(label) {
    const cell = CUBIE_LABELS.indexOf(label);
  
    if (cell === -1) {
      throw new Error(
        `Invalid cubie label "${label}"`
      );
    }
  
    return cell;
  }
  
  const FACE_MASKS = FACE_CUBIES.map((face) =>
    [...face].reduce(
      (mask, label) =>
        mask | (1 << cubieLabelToCell(label)),
      0
    )
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
    surfaceOnly_allSurfaceIdentities: []
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
  const REFINED_FAMILIES_URL =
    "./refined_families.txt";

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
          `Line ${lineNumber + 1}: ` + `expected six piece masks and extras=...`
        );
      }

      if (!maskStrings.every((value) => /^[0-9a-fA-F]{1,8}$/.test(value))) {
        throw new Error(
          `Line ${lineNumber + 1}: ` + `invalid hexadecimal piece mask`
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
              `must occupy exactly four cells`
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
            `unoccupied cells`
        );
      }

      result.push({
        lineNumber: lineNumber + 1,
        code: raw,
        masks,
        extras
      });
    }

    return result;
  }
  function parseMetadata(text) {
    const result = [];
  
    const lines =
      text.split(/\r?\n/);
  
    for (
      let lineNumber = 0;
      lineNumber < lines.length;
      lineNumber++
    ) {
      const raw =
        lines[lineNumber].trim();
  
      if (!raw) {
        continue;
      }
  
      const parts =
        raw.split(/\s+/);
  
      if (parts.length !== 2) {
        throw new Error(
          `Metadata line ${lineNumber + 1}: ` +
          `expected "<flags> <identities>"`
        );
      }
  
      const [
        flagsText,
        identitiesText
      ] = parts;
  
      if (!/^[0-7]$/.test(flagsText)) {
        throw new Error(
          `Metadata line ${lineNumber + 1}: ` +
          `invalid flags "${flagsText}"`
        );
      }
  
      if (!/^[JLSZTOjlszto?]{6}$/.test(identitiesText)) {
        throw new Error(
          `Metadata line ${lineNumber + 1}: ` +
          `invalid identities "${identitiesText}"`
        );
      }
  
      const flags =
        parseInt(flagsText, 16);
  
      result.push({
        surfaceOnly:
          (flags & 1) !== 0,
  
        allSurfaceIdentities:
          (flags & 2) !== 0,
  
        oneOfEach:
          (flags & 4) !== 0,
  
        identities:
          [...identitiesText].map(
            identity =>
              "JLSZTO".includes(identity)
                ? identity
                : null
          )
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
      surfaceOnly_allSurfaceIdentities: []
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
  
      if (
        packing.surfaceOnly &&
        packing.oneOfEach
      ) {
        indices.surfaceOnly_oneOfEach.push(i);
      }
  
      if (
        packing.surfaceOnly &&
        packing.allSurfaceIdentities
      ) {
        indices
          .surfaceOnly_allSurfaceIdentities
          .push(i);
      }
    }
  
    packingIndices = indices;
  
    console.log("Packing indices:", {
      all:
        indices.all.length,
  
      surfaceOnly:
        indices.surfaceOnly.length,
  
      oneOfEach:
        indices.oneOfEach.length,
  
      allSurfaceIdentities:
        indices.allSurfaceIdentities.length,
  
      surfaceOnly_oneOfEach:
        indices.surfaceOnly_oneOfEach.length,
  
      surfaceOnly_allSurfaceIdentities:
        indices.surfaceOnly_allSurfaceIdentities.length
    });
  }
  
  // ============================================================
  // ASSIGN COLORS TO THE 27 LOGICAL CUBIES
  // ============================================================

  function isSurfaceCenter(i) {
    const [x, y, z] = coords(i);

    const boundaryCount = [x, y, z].filter(
      (value) => value === 0 || value === 2
    ).length;

    return boundaryCount === 1;
  }
  
  function centerCount(mask) {
    return bits(mask)
      .filter(isSurfaceCenter)
      .length;
  }
  
  function normalize2D(points) {
    const minRow =
      Math.min(...points.map(([row]) => row));
  
    const minCol =
      Math.min(...points.map(([, col]) => col));
  
    return points
      .map(([row, col]) => [
        row - minRow,
        col - minCol
      ])
      .sort(
        ([ar, ac], [br, bc]) =>
          ar - br || ac - bc
      );
  }

  function rotate2D(points) {
    return normalize2D(
      points.map(([row, col]) => [
        col,
        -row
      ])
    );
  }
  
  function same2DPattern(a, b) {
    const aa = normalize2D(a);
    const bb = normalize2D(b);
  
    return aa.every(
      ([row, col], i) =>
        row === bb[i][0] &&
        col === bb[i][1]
    );
  }

  function sameUnder2DRotation(
    points,
    reference
  ) {
    let current =
      normalize2D(reference);
  
    for (let rotation = 0; rotation < 4; rotation++) {
      if (
        same2DPattern(
          points,
          current
        )
      ) {
        return true;
      }
  
      current =
        rotate2D(current);
    }
  
    return false;
  }

  // ============================================================
  // TETROMINO SHAPE IDENTIFICATION
  // ============================================================

  function projectPieceOntoFace(
    mask,
    faceIndex
  ) {
    const face =
      FACE_CUBIES[faceIndex];
  
    const points = [];
  
    for (
      let position = 0;
      position < face.length;
      position++
    ) {
      const cell =
        cubieLabelToCell(
          face[position]
        );
  
      if (hasBit(mask, cell)) {
        points.push([
          Math.floor(position / 3),
          position % 3
        ]);
      }
    }
  
    // All four cells of the tetromino must
    // occur on this face.
    return points.length === 4
      ? points
      : null;
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
        `Tetromino mask must contain 4 cells, got ${cells.length}`
      );
    }

    // Number of neighbors each cube has within this tetromino.
    const degrees = cells.map(
      (cell) =>
        cells.filter((other) => other !== cell && areNeighbors(cell, other))
          .length
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
        (cell) => degrees[cells.indexOf(cell)] === 1 && areNeighbors(cell, a)
      );

      const endpointB = cells.find(
        (cell) => degrees[cells.indexOf(cell)] === 1 && areNeighbors(cell, b)
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
      `Could not identify tetromino mask ${mask.toString(16).padStart(7, "0")}`
    );
  }
  function identifySurfaceTetromino(
    mask,
    shape = identifyTetromino(mask)
  ) {
    // Per our definition, a tetromino occupying
    // two centers doesn't receive a surface identity.
    if (centerCount(mask) > 1) {
      return null;
    }
  
    // Find a face containing all four cells.
    let projection = null;
  
    for (
      let faceIndex = 0;
      faceIndex < FACE_CUBIES.length;
      faceIndex++
    ) {
      projection =
        projectPieceOntoFace(
          mask,
          faceIndex
        );
  
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
        if (
          sameUnder2DRotation(
            projection,
            J_2D
          )
        ) {
          return "J";
        }
  
        if (
          sameUnder2DRotation(
            projection,
            L_2D
          )
        ) {
          return "L";
        }
  
        return null;
  
      case "SZ":
        if (
          sameUnder2DRotation(
            projection,
            S_2D
          )
        ) {
          return "S";
        }
  
        if (
          sameUnder2DRotation(
            projection,
            Z_2D
          )
        ) {
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
        `found ${matchingIndices.length}.`
      );
    }
  
    const [a, b] = matchingIndices;
  
    [
      packing.masks[a],
      packing.masks[b]
    ] = [
      packing.masks[b],
      packing.masks[a]
    ];
  
    updatePackingCode(packing);
    showSelected();
  }
  function centerCount(mask) {
    let count = 0;
  
    for (let cell = 0; cell < 27; cell++) {
      if (
        hasBit(mask, cell) &&
        isSurfaceCenter(cell)
      ) {
        count++;
      }
    }
  
    return count;
  }
  

  function allPiecesHaveSurfaceIdentities(
    packing
  ) {
    return packing.masks.every(
      (mask) =>
        identifySurfaceTetromino(mask) !== null
    );
  }
  
  function hasOneOfEachTetromino(packing) {
    const identities = packing.masks.map((mask) =>
      identifySurfaceTetromino(
        mask,
        identifyTetromino(mask)
      )
    );
  
    if (identities.includes(null)) {
      return false;
    }
  
    const identitySet =
      new Set(identities);
  
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
      .map((mask) =>
        mask.toString(16).padStart(7, "0")
      )
      .join(" ");
  
    const extras =
      packing.extras
        .toString(16)
        .padStart(7, "0");
  
    packing.code =
      `${masks} extras=${extras}`;
  }

  function isSurfaceOnlyPacking(packing) {
    return hasBit(packing.extras, CORE);
  }


  function indexedPackingIndices() {
    const surface =
      $("surfaceOnly").checked;
  
    const oneEach =
      $("oneOfEach").checked;
  
    const identified =
      $("allSurfaceIdentities").checked;
  
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
    return cells.length === 3 && [0,1,2].some(axis =>
      [0,1,2].every(other => other === axis || cells.every(c => c[other] === cells[0][other])) &&
      new Set(cells.map(c => c[axis])).size === 3);
  }
  const additionalFilters=["nonSurfaceOnly","nonFaceboundSurface","ungroupedOnly","iTunnelOnly"];
  const extraFilters=[["extraEdges",2],["extraCorners",3],["extraCenters",1]];
  function basePackingIndices(){
    const activeExtras=extraFilters.filter(([id])=>$(id).value&&$(id).value!=='any');
    return indexedPackingIndices().filter(i=>{
      const p=packings[i];
      if($("iTunnelOnly").checked&&!p.iTunnel)return false;
      if($("nonSurfaceOnly").checked&&p.surfaceOnly)return false;
      if($("nonFaceboundSurface").checked&&(!p.surfaceOnly||p.allSurfaceIdentities))return false;
      if($("ungroupedOnly").checked&&familyByLine.has(p.lineNumber))return false;
      return activeExtras.every(([id,kind])=>{
        const has=!!(p.extraKinds&(1<<kind));
        return $(id).value==='yes'?has:!has;
      });
    });
  }
  function resetAdditionalFilters(){
    additionalFilters.forEach(id=>$(id).checked=false);
    extraFilters.forEach(([id])=>$(id).value='any');
  }
  const officialColors = new Map();
  const officialLines = new Set();
  const orbit = cell => coords(cell).filter(v => v !== 1).length;
  const profile = mask => [0,1,2,3].map(o => bits(mask).filter(i => orbit(i) === o).length).join(',');
  let officialSource;
  let centerRotations;
  function initializeOfficial() {
    const officialFamily = familyByLine.get(77451)?.family;
    if (!officialFamily) throw new Error('Refined data has no official cube family');
    for (const [line] of officialFamily.members) officialLines.add(line);
    const source = packings.find(p => p.lineNumber === 77451);
    if (!source) throw new Error('Official source packing is missing');
    officialSource = Array(27).fill('l');
    source.masks.forEach((mask,i) => bits(mask).forEach(cell => officialSource[cell] = 'brogym'[i]));
    bits(source.extras).forEach(cell => officialSource[cell] = cell === CORE ? 'l' : orbit(cell) === 1 ? 'k' : 'w');
    officialColors.set(77451, officialSource);
    centerRotations = [];
    for (const axes of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]) {
      const inversions = axes.reduce((n,a,i) => n + axes.slice(i+1).filter(b => a>b).length,0);
      for (const a of [-1,1]) for (const b of [-1,1]) for (const c of [-1,1]) {
        const signs = [a,b,c];
        if ((inversions % 2 ? -1 : 1)*a*b*c !== 1) continue;
        centerRotations.push([4,10,12,14,16,22].map(i => {
          const p = coords(i), q = axes.map((axis,k) => 1+signs[k]*(p[axis]-1));
          return officialSource[q[0]*9+q[1]*3+q[2]];
        }));
      }
    }
  }
  function deriveOfficialColors(packing) {
    const source = packings.find(p => p.lineNumber === 77451);
    const profiles = source.masks.map(profile);
    const choices = packing.masks.map(mask => profiles.map((p,i) => p === profile(mask) ? i : -1).filter(i => i >= 0));
    const colors = Array(27).fill('l'), candidates = [];
    function assign(piece, used) {
      if (piece < 6) {
        for (const i of choices[piece]) if (!(used & (1<<i))) {
          bits(packing.masks[piece]).forEach(cell => colors[cell] = 'brogym'[i]);
          assign(piece+1, used | (1<<i));
        }
        return;
      }
      const extras = bits(packing.extras);
      for (const singles of ['klw','kwl','lkw','lwk','wkl','wlk']) {
        if (!extras.every((cell,i) => orbit(cell) === orbit(officialSource.indexOf(singles[i])))) continue;
        extras.forEach((cell,i) => colors[cell] = singles[i]);
        if (centerRotations.some(rotation => [4,10,12,14,16,22].every((cell,i) => colors[cell] === rotation[i]))) candidates.push(colors.slice());
      }
    }
    assign(0,0);
    const yellowO = colors => packing.masks.some(mask => {
      const cells = bits(mask), spans = [0,1,2].map(a => Math.max(...cells.map(i => coords(i)[a]))-Math.min(...cells.map(i => coords(i)[a]))).sort();
      return spans.join(',') === '0,1,1' && cells.every(i => colors[i] === 'y');
    });
    candidates.sort((a,b) => Number(yellowO(b))-Number(yellowO(a)) || (a.join('') < b.join('') ? -1 : a.join('') > b.join('') ? 1 : 0));
    return candidates[0] || null;
  }
  function officialColoring(packing) {
    if (!officialLines.has(packing.lineNumber)) return null;
    if (!officialColors.has(packing.lineNumber)) officialColors.set(packing.lineNumber, deriveOfficialColors(packing));
    const colors = officialColors.get(packing.lineNumber);
    // Match the complete packing code as well as its source line.
    const reference = packingsByLine.get(packing.lineNumber);
    return colors && reference === packing ? colors : null;
  }
  const families = [];
  const familyByLine = new Map();
  function initializeFamilies(text) {
    for (const line of text.split(/\r?\n/)) {
      let match = line.match(/^FAMILY (\d+) score=(\d+) count=(\d+) bags=(\d+)$/);
      if (match) families.push({id:+match[1],score:match[2],count:+match[3],bagCount:+match[4],members:[],bags:[]});
      else if (line.startsWith('BAGS ')) families.at(-1).bags = line.split(/\s+/).slice(1);
      else if ((match = line.match(/^  line=(\d+) identities=([JLSZTOj?]{6})/))) families.at(-1).members.push([+match[1],match[2].split('').sort().join('')]);
    }
    if (!families.length) throw new Error('No documented families found');
    families.forEach(f => { f.seeds = f.members.filter(m => m[1] === 'JLOSTZ').length; });
  for (const family of families) {
    for (const [line, bag] of family.members) familyByLine.set(line, {family, bag});
  }
  $("familySelect").innerHTML = '<option value="">All packings</option>' + families.map(f =>
    `<option value="${f.id}">Family ${f.id} · ${f.score} · ${f.count} packings · ${f.bagCount} bags · ${f.seeds} 6-bag packings</option>`).join('');
  }
  function selectedFamily() {
    return families.find(f => String(f.id) === $("familySelect").value);
  }
  function refreshFamilyOptions() {
    const select = $("familySelect");
    let previous = select.value || "";
    const matchingCounts = () => {
      const counts = new Map();
      const bag = $("familyBag").value || "";
      for (const i of basePackingIndices()) {
        const packing = packings[i];
        if ($("officialOnly").checked && !officialLines.has(packing.lineNumber)) continue;
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
    const visible = families.filter(f => counts.has(f.id));
    select.innerHTML = `<option value="">All edge families (${visible.length})</option>` + visible.map(f =>
      `<option value="${f.id}">${f.id} · ${counts.get(f.id)} matching · ${f.seeds} 6-Bag</option>`).join('');
    select.value = previous;
    return visible.length;
  }
  function refreshBagOptions() {
    const previous=$("familyBag").value||"", counts=new Map();
    for(const {bag} of packings)counts.set(bag,(counts.get(bag)||0)+1);
    const options=(facebound)=>[...counts].filter(([bag])=>/^[JLOSTZ]+$/.test(bag)===facebound).sort(([a],[b])=>a.localeCompare(b)).map(([bag,count])=>`<option value="${bag}">${bag} · ${count}</option>`).join('');
    $("familyBag").innerHTML='<option value="">All bags</option><optgroup label="Facebound bags">'+options(true)+'</optgroup><optgroup label="Bags with non-facebound pieces">'+options(false)+'</optgroup>';
    $("familyBag").value=previous;$("familyBag").disabled=false;
  }
  function familyChanged() { if(selectedFamily())$("ungroupedOnly").checked=false;filterChanged(); }
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
      $("familySelect").value = String(membership ? membership.family.id : families[0]?.id || '');
    }
    for (const id of ["oneOfEach", "surfaceOnly", "allSurfaceIdentities", "officialOnly"]) $(id).checked = false;
    $("familyBag").value="";resetAdditionalFilters();
    familyChanged();
  });
  function selectablePackingIndices() {
    const choices = basePackingIndices();
    const family = selectedFamily();
    return choices.filter(i => {
      if ($("officialOnly").checked && !officialLines.has(packings[i].lineNumber)) return false;
      const membership = familyByLine.get(packings[i].lineNumber);
      return (!family || membership?.family === family) && (!$("familyBag").value || packings[i].bag === $("familyBag").value);
    });
  }

  const positionalColorCache=new Map();
  function positionalColoring(packing){
    const key=packing.masks.join(',');
    if(positionalColorCache.has(key))return positionalColorCache.get(key);
    const overlap=packing.masks.map(mask=>FACE_MASKS.map(face=>bits(mask&face).length));
    const tPieces=packing.identities.map((v,i)=>v==='T'?i:-1).filter(i=>i>=0);
    let best=-1,result;
    function assign(faces,used,score){
      const i=faces.length;
      if(i<6){for(let f=0;f<6;f++)if(!(used&(1<<f)))assign([...faces,f],used|(1<<f),score+overlap[i][f]);return;}
      if(score<=best)return;
      // Face order is U,D,F,B,L,R: each adjacent pair is opposite.
      const purple=tPieces.length?faces[tPieces[0]]:0;
      const faceColors=Array(6);faceColors[purple]='m';faceColors[purple^1]='y';
      const green=[4,2,0,5,3,1].find(f=>!faceColors[f]);
      faceColors[green]='g';faceColors[green^1]='r';
      const blue=[2,0,4,3,1,5].find(f=>!faceColors[f]);
      faceColors[blue]='b';faceColors[blue^1]='o';
      const colors=Array(27).fill('d');
      packing.masks.forEach((mask,p)=>bits(mask).forEach(cell=>colors[cell]=faceColors[faces[p]]));
      paintExtraColors(packing, colors);
      best=score;result={colors,faces:faces.slice(),faceColors,exact:score===24};
    }
    assign([],0,0);positionalColorCache.set(key,result);return result;
  }

  // Only the core may be gray; reserve black for one extra face center.
  // Without either location, its color is unused and the extras stay white.
  function paintExtraColors(packing, colors) {
    const extras = bits(packing.extras);
    const black = extras.find(isSurfaceCenter);
    extras.forEach(cell => colors[cell] = cell === CORE ? 'l' : cell === black ? 'k' : 'w');
    return colors;
  }

  function assignCellColors(packing) {
    if($("positionalColors").checked)return positionalColoring(packing).colors;
    if ($("officialColors").checked) {
      const colors = officialColoring(packing);
      if (colors) {
        // Manufactured frame: U purple, F yellow, R red, B orange, L green, D black.
        const oriented = Array(27);
        paintExtraColors(packing, colors.slice()).forEach((color, i) => {
          const [x, y, z] = coords(i);
          oriented[(2-z)*9 + (2-y)*3 + (2-x)] = color;
        });
        return oriented;
      }
    }
    const cellColors =
      Array(27).fill(null);
  
    function paint(mask, color) {
      for (const cell of bits(mask)) {
        cellColors[cell] = color;
      }
    }
  
    for (
      let i = 0;
      i < packing.masks.length;
      i++
    ) {
      const mask =
        packing.masks[i];
    
      const identity =
        packing.identities[i];
    
      const color =
        identity === null
          ? UNKNOWN_PIECE_COLOR
          : IDENTITY_COLORS[identity];
    
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
              `ANIMCUBE_CUBIE_MAP`
          );
        }

        const color = cellColors[cell];

        if (color == null) {
          throw new Error(
            `Logical cubie ${cell} ` + `(${cubieLabel}) has no color`
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
      B: "FB"
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

  // ============================================================
  // ANIMCUBE RENDERING
  // ============================================================

  function renderCube(id, facelets, extraParams = "") {
    if (typeof window.AnimCube3 !== "function") {
      $(id).textContent = "AnimCubeJS failed to load.";

      return;
    }

    if (typeof window.acjs_removeListeners[id] === "function") {
      window.acjs_removeListeners[id]();
    }

    $(id).innerHTML = "";

    const params = [
      `id=${id}`,
      `facelets=${facelets}`,
      "bgcolor=1a202b",
      "cubecolor=11151c",
      "buttonbar=1",
      "speed=10",
      "counter=1",
      extraParams
    ]
      .filter(Boolean)
      .join("&");

    window.AnimCube3(params);
    // Give every sticker a unique palette slot with its unchanged visible color.
    // AnimCube then carries identity through all turns, undo, playback and reset.
    const get=window.acjs_get_var[id];
    if(get){
      const cube=get('cube'), initial=get('initialCube'), palette=get('colors');
      const original=initial.map(row=>row.slice());
      for(let f=0;f<6;f++) for(let s=0;s<9;s++){
        const tag=32+f*9+s;palette[tag]=palette[original[f][s]];
        cube[f][s]=initial[f][s]=tag;
      }
      for(const [name,reversed] of [['initialMove',false],['initialReversedMove',true]]){
        const moves=get(name)[0];if(moves?.length)get('doMove')(cube,moves,0,moves.length,reversed);
      }
      get('paint')();
    }
  }

  // A separate field per physical piece prevents equal-colored pieces from fusing.
  function jellyGroups(packing, colors) {
    const rotated = $("officialColors").checked && !!officialColoring(packing);
    const used = new Set();
    const groups = packing.masks.map((mask, id) => ({id, cells: bits(mask)}));
    groups.forEach(g => g.cells.forEach(i => used.add(i)));
    for (let i=0;i<27;i++) if (!used.has(i)) groups.push({id:groups.length,cells:[i]});
    return groups.map(g => {
      const cells = g.cells.map(i => { const [x,y,z]=coords(i); return rotated ? (2-z)*9+(2-y)*3+2-x : i; });
      return {id:g.id,color:colors[cells[0]],cells:cells.map(i=>{const [x,y,z]=coords(i);return [y-1,1-x,z-1];})};
    });
  }

  function jellyField(cells, connectivity=1) {
    // Merge complete runs/rectangles BEFORE rounding. Shared segment faces
    // disappear, giving straight Tengen-like bars rather than pinched beads.
    const occupied=new Set(cells.map(c=>c.join(','))), candidates=[];
    for(const lo of cells) for(const hi of cells){
      if(lo.some((v,k)=>v>hi[k])) continue;
      let filled=true;
      for(let x=lo[0];x<=hi[0];x++) for(let y=lo[1];y<=hi[1];y++) for(let z=lo[2];z<=hi[2];z++){
        if(!occupied.has([x,y,z].join(','))) filled=false;
      }
      if(filled) candidates.push({lo,hi});
    }
    const boxes=candidates.filter(a=>!candidates.some(b=>a!==b&&
      a.lo.every((v,k)=>v>=b.lo[k])&&a.hi.every((v,k)=>v<=b.hi[k])))
      .map(({lo,hi})=>({c:lo.map((v,k)=>(v+hi[k])/2),h:lo.map((v,k)=>(hi[k]-v+1)/2-.055),r:.16}));
    const separate=cells.map(c=>({c,h:[.445,.445,.445],r:.19}));
    const distance=(p,parts,smooth)=>{
      let d=10;
      for (const box of parts) {
        const x=Math.abs(p[0]-box.c[0])-box.h[0]+box.r;
        const y=Math.abs(p[1]-box.c[1])-box.h[1]+box.r;
        const z=Math.abs(p[2]-box.c[2])-box.h[2]+box.r;
        const a=Math.max(x,0),b0=Math.max(y,0),c=Math.max(z,0);
        const b=Math.sqrt(a*a+b0*b0+c*c)+Math.min(Math.max(x,y,z),0)-box.r;
        const h=Math.max(.06-Math.abs(d-b),0)/.06;
        d=Math.min(d,b)-(smooth?h*h*.06*.25:0);
      }
      return d;
    };
    return p=>connectivity ? distance(p,boxes,true) : distance(p,separate,false);
  }

  // Marching tetrahedra generates a single seamless surface, with field normals.
  function jellySurface(cells, connectivity=1) {
    const field=jellyField(cells,connectivity), step=.14;
    const lo=[0,1,2].map(k=>Math.min(...cells.map(c=>c[k]))-.6);
    const n=[0,1,2].map(k=>Math.ceil((Math.max(...cells.map(c=>c[k]))+.6-lo[k])/step));
    const positions=[], normals=[], cache=new Map();
    const corners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
    const tets=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
    const gradient=p=>[0,1,2].map(k=>{const a=p.slice(),b=p.slice();a[k]+=.001;b[k]-=.001;return (field(a)-field(b))/.002;});
    function triangle(a,b,c) {
      const normal=gradient(a.map((v,k)=>(v+b[k]+c[k])/3));
      const u=b.map((v,k)=>v-a[k]),v=c.map((v,k)=>v-a[k]);
      const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
      if(cross.reduce((s,v,k)=>s+v*normal[k],0)<0) [b,c]=[c,b];
      for(const p of [a,b,c]) {positions.push(...p);const g=gradient(p),l=Math.hypot(...g)||1;normals.push(...g.map(v=>v/l));}
    }
    for(let x=0;x<n[0];x++) for(let y=0;y<n[1];y++) for(let z=0;z<n[2];z++) {
      const vertices=corners.map(c=>{
        const grid=[x+c[0],y+c[1],z+c[2]], key=grid.join(',');
        if(!cache.has(key)){const p=grid.map((v,k)=>lo[k]+v*step);cache.set(key,{p,d:field(p)});}
        return cache.get(key);
      });
      for(const tet of tets) {
        const inside=tet.filter(i=>vertices[i].d<0),outside=tet.filter(i=>vertices[i].d>=0);
        const edge=(a,b)=>{const A=vertices[a],B=vertices[b],t=A.d/(A.d-B.d);return A.p.map((v,k)=>v+(B.p[k]-v)*t);};
        if(inside.length===1) triangle(...outside.map(i=>edge(inside[0],i)));
        if(inside.length===3) triangle(...inside.map(i=>edge(outside[0],i)));
        if(inside.length===2){const [a,b]=inside,[c,d]=outside;const ac=edge(a,c),ad=edge(a,d),bc=edge(b,c),bd=edge(b,d);triangle(ac,ad,bc);triangle(ad,bd,bc);}
      }
    }
    return {positions,normals};
  }

  let jellyViewer, jellyLoading, jellyPending;
  function connectedPiece(cells){
    if(cells.length!==4)return false;
    const seen=new Set([0]),queue=[0];
    for(const i of queue)cells.forEach((p,j)=>{
      if(!seen.has(j)&&p.reduce((s,v,k)=>s+Math.abs(v-cells[i][k]),0)===1){seen.add(j);queue.push(j);}
    });
    return seen.size===4;
  }

  function liveJellyGroups(base,cube){
    const moved=new Map([[13,13]]);
    cube.flat().forEach((tag,slot)=>{
      const origin=CUBIE_LABELS.indexOf(ANIMCUBE_CUBIE_MAP[tag-32]);
      const destination=CUBIE_LABELS.indexOf(ANIMCUBE_CUBIE_MAP[slot]);
      if(origin>=0)moved.set(origin,destination);
    });
    return base.filter(p=>p.cells.length===4).map(p=>({...p,cells:p.cells.map(([a,b,c])=>{
      const cell=moved.get((1-b)*9+(a+1)*3+c+1);
      if(cell===undefined)return [NaN,NaN,NaN];
      const [x,y,z]=coords(cell);return [y-1,1-x,z-1];
    })})).filter(p=>connectedPiece(p.cells));
  }
  async function renderPieceModel(packing, cellColors) {
    jellyPending={packing,cellColors};
    if (!$("show3d").checked) return;
    if (!jellyViewer) {
      if (jellyLoading) return;
      $("piece3d").textContent="Softening the pieces…";
      jellyLoading=true;
      try {
        const T=await import("https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js");
        jellyViewer=createJellyViewer(T);
      } catch(error) {
        $("piece3d").textContent="3D view unavailable. Enable WebGL and allow the Three.js CDN, then toggle this view to retry.";
        console.error("Jelly viewer:",error);
      } finally { jellyLoading=false; }
    }
    if(jellyViewer) jellyViewer.update(jellyPending.packing,jellyPending.cellColors);
  }

  function createJellyViewer(T) {
    const host=$("piece3d"), renderer=new T.WebGLRenderer({antialias:true,alpha:true});
    const connectivity=()=>($("jellyConnected").checked?1:0);
    const opacity=()=>1-Number($("jellyTransparency").value)/100;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    renderer.setClearColor(0x000000,0);
    renderer.toneMapping=T.ACESFilmicToneMapping;
    const scene=new T.Scene(), camera=new T.PerspectiveCamera(35,1,.1,40), group=new T.Group();
    scene.add(group,new T.HemisphereLight(0xe9f6ff,0x4b365d,2.5));
    const light=new T.DirectionalLight(0xffffff,3.5);light.position.set(-3,5,4);scene.add(light);
    const rim=new T.DirectionalLight(0xaccbff,2);rim.position.set(4,1,-4);scene.add(rim);
    // Weighted blended transparency: collect continuous color and coverage,
    // then resolve once. No random discarded pixels or per-piece sorting.
    const accumulation=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false});
    const coverage=new T.WebGLRenderTarget(1,1,{depthBuffer:false});
    const revealMaterial=new T.MeshBasicMaterial({color:0xffffff,opacity:opacity(),transparent:true,
      depthWrite:false,depthTest:false,blending:T.CustomBlending,blendSrc:T.ZeroFactor,
      blendDst:T.OneMinusSrcAlphaFactor,blendEquation:T.AddEquation,toneMapped:false});
    const resolveScene=new T.Scene(), resolveCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);
    const resolveMaterial=new T.ShaderMaterial({
      uniforms:{accumulated:{value:accumulation.texture},coverage:{value:coverage.texture}},
      vertexShader:'varying vec2 uvOut; void main(){uvOut=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:`uniform sampler2D accumulated; uniform sampler2D coverage; varying vec2 uvOut;
        void main(){vec4 sum=texture2D(accumulated,uvOut);
          float alpha=1.-texture2D(coverage,uvOut).r;
          gl_FragColor=vec4(sum.rgb/max(sum.a,0.00001),alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      depthTest:false,depthWrite:false,transparent:true
    });
    const resolveQuad=new T.Mesh(new T.PlaneGeometry(2,2),resolveMaterial);
    resolveScene.add(resolveQuad);
    host.replaceChildren(renderer.domElement);
    const canvas=renderer.domElement;
    canvas.tabIndex=0;canvas.setAttribute("aria-label","Jelly packing. Drag or use arrow keys to rotate. Home resets the view.");
    let yaw=.65,pitch=.45,drag=null,lastKey="",frame=0;
    function draw(){
      frame=0;const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
      renderer.setSize(w,h,false);
      const size=renderer.getDrawingBufferSize(new T.Vector2());
      if(accumulation.width!==size.x||accumulation.height!==size.y){accumulation.setSize(size.x,size.y);coverage.setSize(size.x,size.y);}
      camera.aspect=w/h;camera.position.set(0,0,Math.max(7.4,7.4/camera.aspect));camera.updateProjectionMatrix();group.rotation.set(pitch,yaw,0);
      const source=$("jellySource").value,get=window.acjs_get_var[source];
      if(source!=="packing"&&get){
        const [r,u,v]=['eyeX','eyeY','eye'].map(name=>get(name));
        group.quaternion.setFromRotationMatrix(new T.Matrix4().set(r[2],-r[1],r[0],0,u[2],-u[1],u[0],0,v[2],-v[1],v[0],0,0,0,0,1));
      }
      if(opacity()>=1){
        group.children.forEach(mesh=>{mesh.userData.translucent=mesh.material;mesh.material=mesh.userData.opaque;});
        renderer.setRenderTarget(null);renderer.setClearColor(0x000000,0);renderer.render(scene,camera);
        group.children.forEach(mesh=>mesh.material=mesh.userData.translucent);
        return;
      }
      renderer.setRenderTarget(accumulation);renderer.setClearColor(0x000000,0);renderer.render(scene,camera);
      scene.overrideMaterial=revealMaterial;
      renderer.setRenderTarget(coverage);renderer.setClearColor(0xffffff,1);renderer.render(scene,camera);
      scene.overrideMaterial=null;
      renderer.setRenderTarget(null);renderer.setClearColor(0x000000,0);renderer.render(resolveScene,resolveCamera);
    }
    function requestDraw(){if(!frame)frame=requestAnimationFrame(draw);}
    new ResizeObserver(requestDraw).observe(host);
    for(const event of ["touchstart","mousedown","pointerdown"]) host.addEventListener(event,e=>e.stopPropagation());
    canvas.addEventListener("pointerdown",e=>{drag={x:e.clientX,y:e.clientY,id:e.pointerId};canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener("pointermove",e=>{if(!drag||drag.id!==e.pointerId)return;yaw+=(e.clientX-drag.x)*.009;pitch=Math.max(-1.5,Math.min(1.5,pitch+(e.clientY-drag.y)*.009));drag.x=e.clientX;drag.y=e.clientY;requestDraw();});
    for(const name of ["pointerup","pointercancel","lostpointercapture"])canvas.addEventListener(name,()=>{drag=null;});
    function reset(){yaw=.65;pitch=.45;requestDraw();}
    canvas.addEventListener("dblclick",reset);
    canvas.addEventListener("keydown",e=>{if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home"].includes(e.key))return;e.preventDefault();if(e.key==="Home")return reset();yaw+=e.key==="ArrowLeft"?-.12:e.key==="ArrowRight"?.12:0;pitch=Math.max(-1.5,Math.min(1.5,pitch+(e.key==="ArrowUp"?-.12:e.key==="ArrowDown"?.12:0)));requestDraw();});
    canvas.addEventListener("webglcontextlost",e=>{e.preventDefault();});
    canvas.addEventListener("webglcontextrestored",requestDraw);
    const palette={b:0x1689ed,o:0xef8b26,g:0x49b66a,r:0xe64e56,m:0xb35be5,y:0xf0c83e,d:0x657082,k:0x303643,w:0xeef3fa,l:0x8994a4};
    let worker=null;
    const workerURL=URL.createObjectURL(new Blob([
      jellyField.toString(), jellySurface.toString(),
      'onmessage=e=>{const meshes=e.data.pieces.map(p=>{const m=jellySurface(p.cells,e.data.connectivity);return {positions:new Float32Array(m.positions),normals:new Float32Array(m.normals)};});postMessage(meshes,meshes.flatMap(m=>[m.positions.buffer,m.normals.buffer]));};'
    ],{type:"text/javascript"}));
    window.addEventListener("pagehide",()=>{worker?.terminate();URL.revokeObjectURL(workerURL);accumulation.dispose();coverage.dispose();revealMaterial.dispose();resolveMaterial.dispose();resolveQuad.geometry.dispose();renderer.dispose();},{once:true});
    const api={update(packing,colors){
      const source=$("jellySource").value||"packing",base=jellyGroups(packing,colors);
      const get=window.acjs_get_var[source];
      const enabled=source==='packing'||(source==='solvedCube'?$("showSolved").checked:$("showScrambled").checked);
      const pieces=source==='packing'?base:(get&&enabled?liveJellyGroups(base,get('cube')):[]);
      $("jellyStatus").textContent=source==='packing'?'All six pieces · selected packing':!get||!enabled?'Enable the selected cube in Filters & display.':`${pieces.length} of 6 connected pieces · completed turns${get('natural')?'':' · turn in progress'}`;
      const key=JSON.stringify(pieces)+":"+connectivity()+":"+source;
      if(key!==lastKey){
        lastKey=key;
        worker?.terminate();
        host.dataset.loading="true";
        // Never leave stale valid pieces on-screen while their replacements build.
        group.visible=false;
        try { worker=new Worker(workerURL); }
        catch(error) { host.dataset.loading="error";lastKey="";console.error("Jelly worker:",error);return; }
        worker.onerror=()=>{host.dataset.loading="error";lastKey="";worker?.terminate();};
        worker.onmessage=e=>{
        host.dataset.loading="false";
        group.visible=true;
        for(const mesh of [...group.children]){group.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();mesh.userData.opaque?.dispose();}
        pieces.forEach((piece,i)=>{
          const data=e.data[i],geometry=new T.BufferGeometry();
          geometry.setAttribute("position",new T.Float32BufferAttribute(data.positions,3));
          geometry.setAttribute("normal",new T.Float32BufferAttribute(data.normals,3));
          const material=new T.MeshPhysicalMaterial({color:palette[piece.color]??palette.d,roughness:.38,metalness:0,clearcoat:.32,clearcoatRoughness:.45,opacity:opacity(),
            transparent:true,depthWrite:false,depthTest:false,toneMapped:false,
            blending:T.CustomBlending,blendSrc:T.OneFactor,blendDst:T.OneFactor,blendEquation:T.AddEquation});
          material.onBeforeCompile=shader=>{
            shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>',`
              // Nearer surfaces contribute more; addition is order-independent.
              float weight=1./(1.+0.04*pow(length(vViewPosition),4.));
              gl_FragColor=vec4(gl_FragColor.rgb*diffuseColor.a*weight,diffuseColor.a*weight);
            `);
          };
          const mesh=new T.Mesh(geometry,material);
          mesh.userData.opaque=new T.MeshPhysicalMaterial({color:palette[piece.color]??palette.d,roughness:.38,metalness:0,clearcoat:.32,clearcoatRoughness:.45});
          group.add(mesh);
        });
        worker.terminate();worker=null;
        requestDraw();
        };
        worker.postMessage({pieces,connectivity:connectivity()});
      }
      requestDraw();
    }};
    const refresh=()=>{if(jellyPending&&$("show3d").checked)api.update(jellyPending.packing,jellyPending.cellColors);};
    $("jellyConnected").addEventListener('change',refresh);
    $("jellyTransparency").addEventListener('input',()=>{
      $("transparencyValue").textContent=$("jellyTransparency").value+'%';
      revealMaterial.opacity=opacity();group.children.forEach(mesh=>mesh.material.opacity=opacity());requestDraw();
    });
    $("jellySource").addEventListener('change',refresh);
    const liveTimer=setInterval(()=>{if(!document.hidden&&$("jellySource").value!=='packing')refresh();},100);
    window.addEventListener('pagehide',()=>{clearInterval(liveTimer);},{once:true});
    return api;
  }


  // ============================================================
  // DISPLAY CURRENT PUZZLE
  // ============================================================

  let activeCubeView = "solved";
  function syncCubeViews() {
    const scrambled = $("showScrambled").checked;
    const solved = $("showSolved").checked;
    const pieces3d = $("show3d").checked;
    $("scrambledPanel").hidden = !scrambled;
    $("solvedPanel").hidden = !solved;
    $("piece3dPanel").hidden = !pieces3d;
    $("cubeLayout").dataset.views = Number(scrambled) + Number(solved) + Number(pieces3d);
    $("emptyView").hidden = scrambled || solved || pieces3d;
    if (activeCubeView === "scrambled" && !scrambled) activeCubeView = solved ? "solved" : pieces3d ? "pieces3d" : "solved";
    if (activeCubeView === "solved" && !solved) activeCubeView = pieces3d ? "pieces3d" : scrambled ? "scrambled" : "solved";
    if (activeCubeView === "pieces3d" && !pieces3d) activeCubeView = solved ? "solved" : scrambled ? "scrambled" : "solved";
    $("cubeLayout").dataset.active = activeCubeView;
    $("viewTabs").hidden = Number(scrambled) + Number(solved) + Number(pieces3d) < 2;
    $("viewSolved").setAttribute("aria-pressed", String(activeCubeView === "solved"));
    $("view3dTab").setAttribute("aria-pressed", String(activeCubeView === "pieces3d"));
    $("viewScrambled").setAttribute("aria-pressed", String(activeCubeView === "scrambled"));
    for (const [id, visible] of [["scrambledCube", scrambled], ["solvedCube", solved]]) {
      if (!visible) {
        if (typeof window.acjs_removeListeners[id] === "function") window.acjs_removeListeners[id]();
        $(id).innerHTML = "";
      }
    }
  }

  function showSelected() {
    const packing = packings[selected];
  
    if (!packing) {
      return;
    }
    $("sourceLine").value=packing.lineNumber;
  
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
      $("allSurfaceIdentities").checked || $("officialOnly").checked || !!selectedFamily() || !!$("familyBag").value || additionalFilters.some(id=>$(id).checked) || extraFilters.some(([id])=>$(id).value&&$(id).value!=="any");
    
    if (filtering) {
      const filteredPosition =
        choices.indexOf(selected) + 1;
    
      $("packingIndex").textContent =
        `${filteredPosition} of ${choices.length} matching ` +
        `(source line ${packing.lineNumber})`;
    } else {
      $("packingIndex").textContent =
        `${selected + 1} of ${packings.length} ` +
        `(source line ${packing.lineNumber})`;
    }
  
    $("packingCode").textContent = packing.code;
  
    if ($("showScrambled").checked) renderCube(
      "scrambledCube",
      facelets,
      `move=${solution.join("")}&initrevmove=#`
    );
  

    $("solvedPanel").hidden =
      !$("showSolved").checked;
    
    if ($("showSolved").checked) {
      renderCube(
        "solvedCube",
        facelets
      );
      $("solvedFacelets").textContent =
        facelets.toString();
    }
  const colorNames = { b: "blue", o: "orange", g: "green", r: "red", m: "purple", y: "yellow", d: "gray" };
  const transportedColors = $("positionalColors").checked ? positionalColoring(packing).colors : $("officialColors").checked ? officialColoring(packing) : null;
  const identities =
    packing.identities.map(
      (identity, i) => {
        const label = identity !== null ? identity : `${identifyTetromino(packing.masks[i])}?`;
        const color = transportedColors
          ? transportedColors[bits(packing.masks[i])[0]]
          : (identity === null ? UNKNOWN_PIECE_COLOR : IDENTITY_COLORS[identity]);
        return { label, color: colorNames[color] || color };
      }
    ).sort((a, b) => a.label.localeCompare(b.label) || a.color.localeCompare(b.color));
  
  $("pieceIdentities").textContent =
    `Pieces: ${identities.map(piece => `${piece.label} (${piece.color})`).join(" · ")}`;
  $("colorStatus").textContent = $("positionalColors").checked
    ? `Multicolor · ${positionalColoring(packing).exact?'opposite-face match':'closest placement'}`
    : $("officialColors").checked
    ? (officialColoring(packing)
      ? "Official colors"
      : "No official match · canonical colors")
    : "Canonical · colors by shape";

    $("previous").disabled =
      packings.length < 2;
  
    $("next").disabled =
      packings.length < 2;
  }
  function generateNewScramble() {
    scramble = randomScramble(25);
    solution = inverseMoves(scramble);
  }
  // ============================================================
  // LOAD PACKINGS
  // ============================================================
  async function fetchText(url) {
    const response =
      await fetch(url);
  
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ` +
        `${response.statusText}: ${url}`
      );
    }
  
    return response.text();
  }
  
  
  async function loadDatabase() {
    const [text,catalogText] = await Promise.all([fetchText(REFINED_FAMILIES_URL),fetchText(REFINED_FAMILIES_URL.replace("refined_families.txt","packings_with_metadata.txt"))]);
    initializeFamilies(text);
    const loaded = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line.trimStart().startsWith('line=')) continue;
      const match = line.match(/^\s+line=(\d+) identities=([JLSZTOj?]{6}) scores=(\d{6}) (.+)$/);
      if (!match) throw new Error('Malformed refined family member');
      const sourceLine = Number(match[1]), fields = match[4].split(/\s+/);
      if (fields.length !== 11 || !/^[0-7]$/.test(fields[7]) || fields[8] !== match[2] || fields[9] !== match[3]) {
        throw new Error(`Inconsistent refined metadata at source line ${sourceLine}`);
      }
      const packing = parsePackings(match[4])[0];
      const meta = parseMetadata(`${fields[7]} ${fields[8]}`)[0];
      Object.assign(packing, meta, { lineNumber: sourceLine, bag:[...fields[8]].sort().join('') });
      if (!hasBit(packing.extras, CORE) || !meta.surfaceOnly) throw new Error(`Non-surface packing at source line ${sourceLine}`);
      if (packingsByLine.has(sourceLine)) throw new Error(`Duplicate source line ${sourceLine}`);
      packingsByLine.set(sourceLine, packing);
      loaded.push(packing);
    }
    for (const family of families) {
      if (family.members.length !== family.count || new Set(family.members.map(m => m[1])).size !== family.bagCount) {
        throw new Error(`Refined family ${family.id} count mismatch`);
      }
      if (!family.members.every(([line]) => packingsByLine.has(line))) throw new Error(`Refined family ${family.id} has missing packing data`);
    }
    if (!loaded.length || loaded.length !== familyByLine.size) throw new Error('Refined family membership mismatch');
    const catalog=parsePackings(catalogText);
    const rows=catalogText.split(/\r?\n/).filter(line=>line.trim()).map(line=>line.trim().split(/\s+/));
    const metadata=parseMetadata(rows.map(fields=>fields[7]+' '+fields[8]).join('\n'));
    if(catalog.length!==metadata.length)throw new Error('Catalog metadata count mismatch');
    catalog.forEach((p,i)=>{
      Object.assign(p,metadata[i],{iTunnel:hasITunnel(p.extras),bag:[...rows[i][8]].sort().join(''),extraKinds:bits(p.extras).reduce((mask,cell)=>mask|(1<<orbit(cell)),0)});
      const member=packingsByLine.get(p.lineNumber);
      if(member&&(member.extras!==p.extras||member.masks.some((mask,k)=>mask!==p.masks[k])||member.bag!==p.bag))throw new Error('Catalog/family mismatch at source line '+p.lineNumber);
      packingsByLine.set(p.lineNumber,p);
    });
    const catalogLines=new Set(catalog.map(p=>p.lineNumber));
    if(loaded.some(p=>!catalogLines.has(p.lineNumber)))throw new Error('Missing catalog family member');
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
      $("status").textContent =
        "No surface-only packings found.";
      return;
    }
  
    // Avoid selecting the current packing again when possible.
    const alternatives =
      choices.filter((index) => index !== selected);
  
    const pool =
      alternatives.length > 0
        ? alternatives
        : choices;
  
    selected =
      pool[
        Math.floor(Math.random() * pool.length)
      ];
  
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
      position =
        (position - 1 + choices.length) %
        choices.length;
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
      position =
        (position + 1) %
        choices.length;
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
  function skipPackings(offset){
    const choices=selectablePackingIndices();if(!choices.length)return;
    const position=Math.max(0,choices.indexOf(selected));
    selected=choices[((position+offset)%choices.length+choices.length)%choices.length];
    $("jumpStatus").textContent="";generateNewScramble();showSelected();
  }
  for(const [id,offset] of [["back100",-100],["back10",-10],["forward10",10],["forward100",100]]){
    $(id).addEventListener('click',()=>skipPackings(offset));
  }
  $("sourceJump").addEventListener('submit',event=>{
    event.preventDefault();
    const line=Number($("sourceLine").value),target=packings.findIndex(p=>p.lineNumber===line);
    if(!Number.isSafeInteger(line)||line<1||target<0){$("jumpStatus").textContent="Source line not found.";return;}
    const excluded=!selectablePackingIndices().includes(target);
    if(excluded){
      for(const id of ["oneOfEach","surfaceOnly","allSurfaceIdentities","officialOnly"])$(id).checked=false;
      $("familySelect").value="";$("familyBag").value="";resetAdditionalFilters();refreshFamilyOptions();
    }
    selected=target;generateNewScramble();filterChanged();
    $("jumpStatus").textContent=excluded?"Filters cleared for this line.":"";
  });

  function viewChanged() {
    syncCubeViews();
    showSelected();
  }
  $("viewSolved").addEventListener("click", () => { activeCubeView = "solved"; viewChanged(); });
  $("view3dTab").addEventListener("click", () => { activeCubeView = "pieces3d"; viewChanged(); });
  $("viewScrambled").addEventListener("click", () => { activeCubeView = "scrambled"; viewChanged(); });
  $("showSolved").addEventListener("change", viewChanged);
  $("show3d").addEventListener("change", viewChanged);
  $("showScrambled").addEventListener("change", viewChanged);

  $("copyCode").addEventListener("click", copyPackingCode);

  function filterChanged() {
    if($("surfaceOnly").checked)$("nonSurfaceOnly").checked=false;
    if($("allSurfaceIdentities").checked||$("oneOfEach").checked){$("nonSurfaceOnly").checked=false;$("nonFaceboundSurface").checked=false;}
    refreshFamilyOptions();
    updateFamilySummary();
    const choices = selectablePackingIndices();
  
    if (choices.length === 0) {
      $("status").textContent =
        "No packings match the selected filters. The cube still shows the previous selection.";
      $("packingIndex").textContent = "Previous selection · no matches";
      for (const id of ["previous", "next", "random", "back100", "back10", "forward10", "forward100"]) $(id).disabled = true;
      return;
    }
  
    for (const id of ["previous", "next", "random", "back100", "back10", "forward10", "forward100"]) $(id).disabled = false;
    $("status").textContent = `${choices.length.toLocaleString()} packings match current filters.`;
    // Keep the current packing whenever it still
    // satisfies the new filter combination.
    if (choices.includes(selected)) {
      showSelected();
      return;
    }
  
    // Otherwise jump to a valid packing.
    selected =
      choices[
        Math.floor(Math.random() * choices.length)
      ];
  
    generateNewScramble();
    showSelected();
  }
  
  for(const id of additionalFilters)$(id).addEventListener('change',()=>{
    if($(id).checked){
      if(id==='nonSurfaceOnly'){ $("surfaceOnly").checked=false;$("nonFaceboundSurface").checked=false;$("allSurfaceIdentities").checked=false;$("oneOfEach").checked=false; }
      if(id==='nonFaceboundSurface'){ $("nonSurfaceOnly").checked=false;$("allSurfaceIdentities").checked=false;$("oneOfEach").checked=false; }
      if(id==='ungroupedOnly')$("familySelect").value='';
    }
    filterChanged();
  });
  for(const [id] of extraFilters)$(id).addEventListener('change',filterChanged);
  $("surfaceOnly").addEventListener(
    "change",
    filterChanged
  );
  
  $("oneOfEach").addEventListener(
    "change",
    filterChanged
  );
  
  $("allSurfaceIdentities").addEventListener(
    "change",
    filterChanged
  );

  $("officialOnly").addEventListener("change", filterChanged);
  for(const mode of ["canonicalColors","officialColors","positionalColors"]){
    $(mode).addEventListener("change",()=>{
      for(const other of ["canonicalColors","officialColors","positionalColors"])$(other).checked=other===mode;
      showSelected();
    });
  }

  // ============================================================
  // START
  // ============================================================

  async function init() {
    try {
      $("status").textContent =
        "Downloading packing database...";
  
      packings = await loadDatabase();
      initializeOfficial();

      $("status").textContent =
        "Building indices...";
  
      buildPackingIndices();
      refreshBagOptions();
      refreshFamilyOptions();
  
      selected = Math.max(0, packings.findIndex(p => p.lineNumber === 77451));
      
      generateNewScramble();
      showSelected();
  
      $("status").textContent =
        `Loaded ${packings.length.toLocaleString()} packings.`;
  
    } catch (error) {
      console.error(
        "Failed to load packing database:",
        error
      );
  
      $("status").textContent =
        `Failed to load packing database: ` +
        error.message;
    }
  }
  
  $("closeSettings").addEventListener("click", () => {
    $("settingsPanel").open = false;
    $("settingsPanel").querySelector("summary").focus();
  });
  $("settingsPanel").addEventListener("keydown", event => {
    if (event.key === "Escape") {
      $("settingsPanel").open = false;
      $("settingsPanel").querySelector("summary").focus();
    }
  });
  init();

})();
