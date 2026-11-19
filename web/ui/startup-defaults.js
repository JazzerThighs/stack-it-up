/** Edit this function to cultivate the application's startup defaults.
 * Runs once per page, before preferences or game state are restored.
 * Shared groups apply to every cube. Game/explorer contain their own controls.
 * Saved preferences win; reset buttons restore these curated defaults.
 * Use booleans for game/input checkboxes; appearance switches use 0/1.
 * Selects use option values (not labels). Numeric sliders accept numbers.
 * Schemas still own labels, limits and validation; no regeneration is needed here.
 */
export function createStartupDefaults() {
  return {
    // Independent view overrides. Empty entries inherit the shared defaults below.
    // Keys: active, stack, family, start, target. Each accepts appearance fields,
    // palette (10 hex colors, including slot 0), size (50–160), opacity (0–100),
    // modelShape (angular/jelly/gameboy/text), effect (jelly/dither/matte/cel/ascii).
    // whole/fragments/extras each accept whole, cubies, or solids.
    viewAppearance: {active: {}, stack: {}, family: {}, start: {}, target: {}},
    // Reorder these layer IDs; every listed ID must appear exactly once.
    // Used when game.customLayers is true; see ui/settings.js for layer labels.
    "layerOrder": [
      "arrows",
      "arrowGuides",
      "labels",
      "dragArrows",
      "hoverOutline",
      "slices",
      "hints",
      "choice",
      "recent",
      "overlaps",
      "outlines",
      "grid",
      "centers",
      "floating",
      "active",
      "stack",
      "empty"
    ],
    // Standard Tetris. Edit these defaults freely; saved colors still take precedence.
    "palette": {
      "O": "#ffd35c",
      "T": "#bd8cff",
      "L": "#ffab5c",
      "J": "#649aff",
      "S": "#62d9ad",
      "Z": "#ff718d",
      "B": "#996633",
      "D": "#505050",
      "F": "#c8c8c8"
    },
    "appearance": {
      "solidUniform": 1,
      // Any six-digit RGB hex color: "#RRGGBB" (no alpha), e.g. "#c8c8c8".
      "solidColor": "#c8c8c8",
      "solidFixed": 0,
      "solidGray": 1,
      "ditherTransparency": 1,
      "lightAzimuth": -20,
      "lightElevation": 25,
      "lightIntensity": 1,
      "lightAmbient": 0.35,
      "ditherLevels": 5,
      "ditherSize": 2,
      "ditherContrast": 2.5,
      "ditherMidpoint": 0.6,
      "asciiSize": 1,
      "asciiExposure": 1,
      "asciiDensity": 1,
      "asciiCoverage": 0.16,
      "asciiBlend": 1,
      "lightPieces": 0,
      "lightCubies": 1,
      "lightSolids": 1,
      "lightOther": 1,
      "jellyCornerO": 0,
      "jellyBevel": 15,
      "jellyProfile": 2,
      "jellyElbows": 100,
      "jellyOpening": 24,
      "cubieScale": 100,
      "transparencyGrain": 1,
      "transparencyResponse": 1
    },
    "display": {
      // Available values:
      // "cubies" = Individual Cubies Only.
      // "whole" = Whole Tetracubes + Individual Cubie Fragments.
      // "solids" = Balls & Platonic Solids + Cubie Extras.
      // "wholeSolids" = Whole Tetracubes + Balls & Platonic Solid Fragments + Cubie Extras.
      // "cubiesSolids" = Individual Cubie Tetracubes + Balls & Platonic Solid Fragments + Cubie Extras.
      "familyPieces": "wholeSolids",
      // Available values:
      // "cubies" = Individual Cubies Only.
      // "whole" = Whole Tetracubes + Individual Cubie Fragments.
      // "solids" = Balls & Platonic Solids + Cubie Extras.
      // "wholeSolids" = Whole Tetracubes + Balls & Platonic Solid Fragments + Cubie Extras.
      // "cubiesSolids" = Individual Cubie Tetracubes + Balls & Platonic Solid Fragments + Cubie Extras.
      // "retained" = Whole Tetracubes - Keep Cut Pieces.
      "practiceStartPieces": "retained",
      // Available values:
      // "cubies" = Individual Cubies Only.
      // "whole" = Whole Tetracubes + Individual Cubie Fragments.
      // "solids" = Balls & Platonic Solids + Cubie Extras.
      // "wholeSolids" = Whole Tetracubes + Balls & Platonic Solid Fragments + Cubie Extras.
      // "cubiesSolids" = Individual Cubie Tetracubes + Balls & Platonic Solid Fragments + Cubie Extras.
      "practiceTargetPieces": "whole",
      // Available values:
      // "cubies" = Individual Cubies Only.
      // "whole" = Whole Tetracubes + Individual Cubie Fragments.
      // "solids" = Balls & Platonic Solids + Cubie Extras.
      // "wholeSolids" = Whole Tetracubes + Balls & Platonic Solid Fragments + Cubie Extras.
      // "cubiesSolids" = Individual Cubie Tetracubes + Balls & Platonic Solid Fragments + Cubie Extras.
      "activePieces": "solids",
      // Available values:
      // "cubies" = Individual Cubies Only.
      // "whole" = Whole Tetracubes + Individual Cubie Fragments.
      // "solids" = Balls & Platonic Solids + Cubie Extras.
      // "wholeSolids" = Whole Tetracubes + Balls & Platonic Solid Fragments + Cubie Extras.
      // "cubiesSolids" = Individual Cubie Tetracubes + Balls & Platonic Solid Fragments + Cubie Extras.
      // "retained" = Placed Shapes - Keep Cut Pieces.
      "stackPieces": "retained",
      "gameActiveSize": 100,
      "gameStackSize": 100,
      "familySize": 100,
      // Width and height of each face/slice grid, in pixels (64 through 200).
      "faceMapSize": 104,
      "practiceStartSize": 100,
      "practiceTargetSize": 100,
      // Available values:
      // "teal" = Teal.
      // "slate" = Slate blue.
      // "violet" = Violet.
      // "amber" = Amber.
      "uiTheme": "violet"
    },
    "controls": {
      "hoverRings": true,
      "ringLabels": false,
      "hoverOutline": false,
      "hoverIdentities": false,
      "showArrows": false,
      "arrowGuides": false,
      "classicControls": false,
      "freeOrbit": true,
      "perspectiveCamera": false,
      "wideTurns": false
    },
    "orbit": {
      // Available values:
      // "turn" = Cube turns / free drag outside.
      // "free" = Free drag.
      // "xyz" = XYZ Orbit.
      // "off" = Disabled.
      "mouseLeft": "turn",
      // Available values:
      // "turn" = Cube turns / free drag outside.
      // "free" = Free drag.
      // "xyz" = XYZ Orbit.
      // "off" = Disabled.
      "mouseRight": "free",
      // Available values:
      // "free" = Free drag.
      // "xyz" = XYZ Orbit.
      "mouseBoth": "xyz",
      "mouseBothEnabled": true,
      "orbitSettling": true,
      "orbitConfined": true,
      "orbitSnap": true,
      "orbitDiagonalRoll": true,
      "orbitAxisLock": true,
      "orbitDebug": false,
      "orbitDebugOverlay": false,
      "orbitCubeUD": true,
      "orbitCubeLR": true,
      "orbitCubeFB": true,
      "orbitDragGuide": true,
      "orbitDeadZone": 24,
      "orbitSensitivity": 1,
      "orbitSmoothing": 70,
      "orbitSettleTime": 150,
      "orbitSettleDelay": 20,
      "orbitHorizontal": -35,
      "orbitVertical": -20,
      "orbitRoll": -15
    },
    "game": {
      "combined": true,
      "poolPiece1": true,
      "poolPiece2": true,
      "poolPiece4": true,
      "poolPiece3": true,
      "poolPiece5": true,
      "poolPiece6": true,
      "poolPiece7": true,
      "poolPiece8": true,
      "poolPiece9": true,
      "poolPiece10": false,
      "poolPiece11": false,
      "scienceMode": false,
      "chooseNext": false,
      "clearFullFace": true,
      "clearRingFace": false,
      "clearFullSlice": true,
      "clearRingSlice": true,
      "gravityEnabled": true,
      "planeGravity": true,
      "sliceGravity": false,
      "gravityDirection0": true,
      "gravityDirection1": false,
      "gravityDirection2": false,
      "gravityDirection3": false,
      "gravityOccurrence0": true,
      "gravityOccurrence1": false,
      "fallOneCell": true,
      "freedomEnabled": true,
      "freeSize4": true,
      "freeSize3": true,
      "freeSize2": true,
      "freeSize1": true,
      "fragmentsConnected": true,
      "rebuildQueueShapes": true,
      "rebuildOriginalShape": false,
      "freedomEvent0": true,
      "freedomEvent1": false,
      "freedomEvent2": false,
      "freedomMethod0": true,
      "freedomMethod1": false,
      "freedomMethod2": false,
      "freedomMethod3": false,
      // Available values:
      // "1" = Full slice — interior required (default).
      // "2" = Surface ring — interior not required.
      "sliceClearMode": "1",
      // Available values:
      // "0" = Clears only (default).
      // "1" = Off completely.
      // "2" = Always on · random changes each move.
      "gravityMode": "0",
      "gravityOneStep": true,
      "fragmentPerk": false,
      "bandagedFragments": true,
      "randomCubies": false,
      // Available values:
      // "0" = Off.
      // "1" = Free all still-whole pieces.
      // "2" = Free one random whole piece per cleared plane.
      "rebuildMode": "2",
      // Available values:
      // "0" = Off.
      // "1" = Once per cleared plane.
      // "2" = At the start of each new piece turn.
      "releaseTrigger": "0",
      "releaseBandaged": true,
      "earlyLock": true,
      // Available values:
      // "0" = Equal chances per eligible piece.
      // "1" = Weight by occupied cubies.
      // "2" = Try one random cell (empty cells miss).
      // "3" = Prefer more connected segments.
      // "4" = Prefer fewer connected segments.
      "releaseSelection": "0",
      "releaseScattered": false,
      "placementGlow": true,
      "queueForecast": false,
      // Available values:
      // "angular" = Angular (Tengen).
      // "jelly" = Jelly.
      // "gameboy" = Gameboy Tetronimos.
      // "text" = Extruded text [].
      "modelShape": "angular",
      // Available values:
      // "jelly" = None.
      // "dither" = Dithered.
      // "matte" = Matte.
      // "cel" = Cel shaded.
      // "ascii" = ASCII.
      "pieceAppearance": "jelly",
      "animations": true,
      "activeSpheres": false,
      "rebuildSolidIdentities": true,
      // Whole-number percentage "0" through "100": 0 = opaque, 100 = invisible.
      "activeTransparency": "0",
      // Whole-number percentage "0" through "100": 0 = opaque, 100 = invisible.
      "centerTransparency": "0",
      // Whole-number percentage "0" through "100": 0 = opaque, 100 = invisible.
      "stackTransparency": "0",
      "controlGrid": true,
      "stackGrid": true,
      "xray": true,
      "combinedGrid": true,
      "rearGridOnly": true,
      "activeOutlines": false,
      "customLayers": false,
      "topOutNewGame": true,
      "stageFaceMap": false
    },
    "explorer": {
      // Use "" for all families, or a family ID as a decimal string from the loaded catalog.
      "familySelect": "",
      // Available values:
      // "start" = Start.
      // "target" = Target.
      "navigationTarget": "start",
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMinO": "0",
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMaxO": "6",
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMinT": "0",
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMaxT": "6",
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMinJ": "0",
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMaxJ": "6",
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMinL": "0",
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMaxL": "6",
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMinS": "0",
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMaxS": "6",
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMinZ": "0",
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMaxZ": "6",
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMinJL": "0",
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMaxJL": "6",
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMinSZ": "0",
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMaxSZ": "6",
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMinB": "0",
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMaxB": "6",
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMinF": "0",
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMaxF": "6",
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMinD": "0",
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMaxD": "6",
      // Whole-number count "0" through "3"; keep the matching minimum <= maximum.
      "countMinExtraSingle": "0",
      // Whole-number count "0" through "3"; keep the matching minimum <= maximum.
      "countMaxExtraSingle": "3",
      // Whole-number count "0" through "1"; keep the matching minimum <= maximum.
      "countMinExtraDomino": "0",
      // Whole-number count "0" through "1"; keep the matching minimum <= maximum.
      "countMaxExtraDomino": "1",
      // Whole-number count "0" through "1"; keep the matching minimum <= maximum.
      "countMinExtraV": "0",
      // Whole-number count "0" through "1"; keep the matching minimum <= maximum.
      "countMaxExtraV": "1",
      // Whole-number count "0" through "1"; keep the matching minimum <= maximum.
      "countMinExtraBar": "0",
      // Whole-number count "0" through "1"; keep the matching minimum <= maximum.
      "countMaxExtraBar": "1",
      // Whole-number count "0" through "1"; keep the matching minimum <= maximum.
      "countMinExtraCore": "0",
      // Whole-number count "0" through "1"; keep the matching minimum <= maximum.
      "countMaxExtraCore": "1",
      // Whole-number count "0" through "3"; keep the matching minimum <= maximum.
      "countMinExtraCenters": "0",
      // Whole-number count "0" through "3"; keep the matching minimum <= maximum.
      "countMaxExtraCenters": "3",
      // Whole-number count "0" through "3"; keep the matching minimum <= maximum.
      "countMinExtraEdges": "0",
      // Whole-number count "0" through "3"; keep the matching minimum <= maximum.
      "countMaxExtraEdges": "3",
      // Whole-number count "0" through "3"; keep the matching minimum <= maximum.
      "countMinExtraCorners": "0",
      // Whole-number count "0" through "3"; keep the matching minimum <= maximum.
      "countMaxExtraCorners": "3",
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMinFacebound": "0",
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMaxFacebound": "6",
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMinSurfaceNonface": "0",
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMaxSurfaceNonface": "6",
      // Whole-number count "0" through "1"; keep the matching minimum <= maximum.
      "countMinCorePieces": "0",
      // Whole-number count "0" through "1"; keep the matching minimum <= maximum.
      "countMaxCorePieces": "1",
      // Available values:
      // "spatial" = All tetracubes (v2).
      // "classic" = Classic (planar only).
      "datasetSelect": "spatial",
      // Use "" for all piece mixes, or an exact bag string offered by the catalog (e.g. "JLOSTZ").
      "familyBag": "",
      // Available values:
      // "" = Any.
      // "none" = Planar only.
      // "mixed" = Mixed planar and spatial.
      // "only" = Spatial only.
      "spatialComposition": "",
      // Available values:
      // "" = Any.
      // "none" = None.
      // "any" = At least one.
      // "surface" = At least one without core.
      // "core" = At least one through core.
      "planarSpanning": "",
      // Available values:
      // "" = Any type.
      // "O" = O.
      // "T" = T.
      // "JL" = JL.
      // "SZ" = SZ.
      // "B" = B.
      // "D" = D.
      // "F" = F.
      "corePieceType": "",
      "oneOfEach": false,
      "allSurfaceIdentities": false,
      "officialOnly": false,
      "surfaceOnly": false,
      "nonSurfaceOnly": false,
      "nonFaceboundSurface": false,
      "iTunnelOnly": false,
      "somaVOnly": false,
      "somaSetOnly": false,
      "dominoGapOnly": false,
      // Available values:
      // "any" = Any.
      // "yes" = Contains.
      // "no" = No extra edges.
      "extraEdges": "any",
      // Available values:
      // "any" = Any.
      // "yes" = Contains.
      // "no" = No extra corners.
      "extraCorners": "any",
      // Available values:
      // "any" = Any.
      // "yes" = Contains.
      // "no" = No extra centers.
      "extraCenters": "any",
      "familyInspectFilters": true,
      "familyExploreMode": true,
      "practiceMode": false,
      "canonicalColors": true,
      "positionalColors": false,
      "showSolved": true,
      "showScrambled": true,
      "familySolidIdentities": true,
      // Whole-number percentage "0" through "100": 0 = opaque, 100 = invisible.
      "targetTransparency": "0",
      // Available values:
      // "angular" = Angular (Tengen).
      // "jelly" = Jelly.
      // "gameboy" = Gameboy Tetronimos.
      // "text" = Extruded text [].
      "modelShape": "angular",
      // Available values:
      // "jelly" = None.
      // "dither" = Dithered.
      // "matte" = Matte.
      // "cel" = Cel shaded.
      // "ascii" = ASCII.
      "pieceAppearance": "jelly",
      "targetComposite": true
    }
  };
}

export const startupDefaults = createStartupDefaults();

// Only initialization calls this; opening Settings never resets live choices.
const initialized = new WeakMap();
export function applyStartupDefaults(root, scope) {
  const surface=root.getElementById('modelShape')||root;
  const scopes=initialized.get(surface)||new Set();
  if(scopes.has(scope))return;
  scopes.add(scope);initialized.set(surface,scopes);
  for (const [id, value] of Object.entries(startupDefaults[scope])) {
    const control = root.getElementById(id);
    if (!control) continue;
    if (scope==='explorer' && ['familySelect','familyBag'].includes(id) && value && control.options && ![...control.options].some(option=>option.value===String(value))) {
      const option=control.ownerDocument.createElement('option');option.value=String(value);option.textContent=String(value);control.append(option);
    }
    if (typeof value === 'boolean') control.checked = value;
    else control.value = String(value);
  }
}
