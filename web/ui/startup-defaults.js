/** Edit this function to cultivate the application's startup defaults.
 * Runs once per page, before preferences or game state are restored.
 * Shared groups apply to every cube. Game/explorer contain their own controls.
 * Saved preferences win; reset buttons restore these curated defaults.
 * Use booleans for game/input checkboxes; appearance switches use 0/1.
 * Selects use option values (not labels). Numeric sliders accept numbers.
 * Schemas still own labels, limits and validation; no regeneration is needed here.
 * SID numbers identify settings for menu designs; keep them stable when reordering.
 * 90000+ identifies legacy-only/no-modern-effect settings, not hidden live defaults.
 * Never reuse or renumber an assigned SID. See docs/SETTING_IDS.md for the index.
 * Empty per-view objects have profile IDs; layerOrder has one ID for the whole list.
 */
export function createStartupDefaults() {
  return {
    // Independent view overrides. Empty entries inherit the shared defaults below.
    // Keys: active, stack, family, start, target. Each accepts appearance fields,
    // palette (10 hex colors, including slot 0), size (50–160), opacity (0–100),
    // modelShape (angular/jelly/gameboy/text), effect (jelly/dither/matte/cel/ascii).
    // whole/fragments/extras each accept whole, cubies, or solids.
    viewAppearance: {
      active: {}, // SID 1001: viewAppearance.active
      stack: {}, // SID 1002: viewAppearance.stack
      family: {}, // SID 1003: viewAppearance.family
      start: {}, // SID 1004: viewAppearance.start
      target: {}, // SID 1005: viewAppearance.target
    },
    // Reorder these layer IDs; every listed ID must appear exactly once.
    // Used when game.customLayers is true; see ui/settings.js for layer labels.
    "layerOrder": [ // SID 2001: layerOrder
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
      "O": "#ffd35c", // SID 3001: palette.O
      "T": "#bd8cff", // SID 3002: palette.T
      "L": "#ffab5c", // SID 3003: palette.L
      "J": "#649aff", // SID 3004: palette.J
      "S": "#62d9ad", // SID 3005: palette.S
      "Z": "#ff718d", // SID 3006: palette.Z
      "B": "#996633", // SID 3007: palette.B
      "D": "#505050", // SID 3008: palette.D
      "F": "#c8c8c8" // SID 3009: palette.F
    },
    "appearance": {
      "extraCornerColor": "#ffffff", // SID 4001: appearance.extraCornerColor
      "extraEdgeColor": "#ffffff", // SID 4002: appearance.extraEdgeColor
      "extraCenterColor": "#000000", // SID 4003: appearance.extraCenterColor
      "extraCoreColor": "#808080", // SID 4004: appearance.extraCoreColor
      "solidUniform": 1, // SID 4005: appearance.solidUniform
      // Any six-digit RGB hex color: "#RRGGBB" (no alpha), e.g. "#c8c8c8".
      "solidColor": "#c8c8c8", // SID 4006: appearance.solidColor
      "solidFixed": 0, // SID 4007: appearance.solidFixed
      "solidGray": 1, // SID 4008: appearance.solidGray
      "ditherTransparency": 1, // SID 4009: appearance.ditherTransparency
      "lightAzimuth": -20, // SID 4010: appearance.lightAzimuth
      "lightElevation": 25, // SID 4011: appearance.lightElevation
      "lightIntensity": 1, // SID 4012: appearance.lightIntensity
      "lightAmbient": 0.35, // SID 4013: appearance.lightAmbient
      "ditherLevels": 5, // SID 4014: appearance.ditherLevels
      "ditherSize": 2, // SID 4015: appearance.ditherSize
      "ditherContrast": 2.5, // SID 4016: appearance.ditherContrast
      "ditherMidpoint": 0.6, // SID 4017: appearance.ditherMidpoint
      "asciiSize": 1, // SID 4018: appearance.asciiSize
      "asciiExposure": 1, // SID 4019: appearance.asciiExposure
      "asciiDensity": 1, // SID 4020: appearance.asciiDensity
      "asciiCoverage": 0.16, // SID 4021: appearance.asciiCoverage
      "asciiBlend": 1, // SID 4022: appearance.asciiBlend
      "lightPieces": 0, // SID 4023: appearance.lightPieces
      "lightCubies": 1, // SID 4024: appearance.lightCubies
      "lightSolids": 1, // SID 4025: appearance.lightSolids
      "lightOther": 1, // SID 4026: appearance.lightOther
      "jellyCornerO": 0, // SID 4027: appearance.jellyCornerO
      "jellyBevel": 15, // SID 4028: appearance.jellyBevel
      "jellyProfile": 2, // SID 4029: appearance.jellyProfile
      "jellyElbows": 100, // SID 4030: appearance.jellyElbows
      "jellyOpening": 24, // SID 4031: appearance.jellyOpening
      "cubieScale": 100, // SID 4032: appearance.cubieScale
      "transparencyGrain": 1, // SID 4033: appearance.transparencyGrain
      "transparencyResponse": 1 // SID 4034: appearance.transparencyResponse
    },
    "display": {
      // Available values:
      // "cubies" = Individual Cubies Only.
      // "whole" = Whole Tetracubes + Individual Cubie Fragments.
      // "solids" = Balls & Platonic Solids + Cubie Extras.
      // "wholeSolids" = Whole Tetracubes + Balls & Platonic Solid Fragments + Cubie Extras.
      // "cubiesSolids" = Individual Cubie Tetracubes + Balls & Platonic Solid Fragments + Cubie Extras.
      "familyPieces": "wholeSolids", // SID 5001: display.familyPieces
      // Available values:
      // "cubies" = Individual Cubies Only.
      // "whole" = Whole Tetracubes + Individual Cubie Fragments.
      // "solids" = Balls & Platonic Solids + Cubie Extras.
      // "wholeSolids" = Whole Tetracubes + Balls & Platonic Solid Fragments + Cubie Extras.
      // "cubiesSolids" = Individual Cubie Tetracubes + Balls & Platonic Solid Fragments + Cubie Extras.
      // "retained" = Whole Tetracubes - Keep Cut Pieces.
      "practiceStartPieces": "retained", // SID 5002: display.practiceStartPieces
      // Available values:
      // "cubies" = Individual Cubies Only.
      // "whole" = Whole Tetracubes + Individual Cubie Fragments.
      // "solids" = Balls & Platonic Solids + Cubie Extras.
      // "wholeSolids" = Whole Tetracubes + Balls & Platonic Solid Fragments + Cubie Extras.
      // "cubiesSolids" = Individual Cubie Tetracubes + Balls & Platonic Solid Fragments + Cubie Extras.
      "practiceTargetPieces": "whole", // SID 5003: display.practiceTargetPieces
      // Available values:
      // "cubies" = Individual Cubies Only.
      // "whole" = Whole Tetracubes + Individual Cubie Fragments.
      // "solids" = Balls & Platonic Solids + Cubie Extras.
      // "wholeSolids" = Whole Tetracubes + Balls & Platonic Solid Fragments + Cubie Extras.
      // "cubiesSolids" = Individual Cubie Tetracubes + Balls & Platonic Solid Fragments + Cubie Extras.
      "activePieces": "solids", // SID 5004: display.activePieces
      // Available values:
      // "cubies" = Individual Cubies Only.
      // "whole" = Whole Tetracubes + Individual Cubie Fragments.
      // "solids" = Balls & Platonic Solids + Cubie Extras.
      // "wholeSolids" = Whole Tetracubes + Balls & Platonic Solid Fragments + Cubie Extras.
      // "cubiesSolids" = Individual Cubie Tetracubes + Balls & Platonic Solid Fragments + Cubie Extras.
      // "retained" = Placed Shapes - Keep Cut Pieces.
      "stackPieces": "retained", // SID 5005: display.stackPieces
      "gameActiveSize": 100, // SID 5006: display.gameActiveSize
      "gameStackSize": 100, // SID 5007: display.gameStackSize
      "familySize": 100, // SID 5008: display.familySize
      // Width and height of each face/slice grid, in pixels (64 through 200).
      "faceMapSize": 104, // SID 5009: display.faceMapSize
      "practiceStartSize": 100, // SID 5010: display.practiceStartSize
      "practiceTargetSize": 100, // SID 5011: display.practiceTargetSize
      // Available values:
      // "teal" = Teal.
      // "slate" = Slate blue.
      // "violet" = Violet.
      // "amber" = Amber.
      "uiTheme": "violet" // SID 5012: display.uiTheme
    },
    "controls": {
      "turnAnimationSpeed": 1, // SID 6001: controls.turnAnimationSpeed
      "bluetoothSliceWindow": 40, // SID 6002: controls.bluetoothSliceWindow
      "bluetoothPackingNeutral": false, // SID 6022: controls.bluetoothPackingNeutral
      "bluetoothGyroSmoothing": true, // SID 6003: controls.bluetoothGyroSmoothing
      "bluetoothGyroResponse": 180, // SID 6004: controls.bluetoothGyroResponse
      "bluetoothGyroSpeed": 180, // SID 6005: controls.bluetoothGyroSpeed
      "bluetoothGyroAcceleration": 1200, // SID 6006: controls.bluetoothGyroAcceleration
      "bluetoothNeutralCutoff": 6, // SID 6007: controls.bluetoothNeutralCutoff
      "bluetoothNeutralDelay": 125, // SID 6008: controls.bluetoothNeutralDelay
      "bluetoothNeutralSpeed": 2.5, // SID 6009: controls.bluetoothNeutralSpeed
      "bluetoothNeutralTolerance": 10, // SID 6010: controls.bluetoothNeutralTolerance
      "bluetoothWideWindow": 150, // SID 6011: controls.bluetoothWideWindow
      "hoverRings": true, // SID 6012: controls.hoverRings
      "ringLabels": false, // SID 6013: controls.ringLabels
      "hoverOutline": false, // SID 6014: controls.hoverOutline
      "hoverIdentities": false, // SID 6015: controls.hoverIdentities
      "showArrows": false, // SID 6016: controls.showArrows
      "arrowGuides": false, // SID 6017: controls.arrowGuides
      "classicControls": false, // SID 6018: controls.classicControls
      "freeOrbit": true, // SID 6019: controls.freeOrbit
      "perspectiveCamera": false, // SID 6020: controls.perspectiveCamera
      "wideTurns": false // SID 6021: controls.wideTurns
    },
    "orbit": {
      // Available values:
      // "turn" = Cube turns / free drag outside.
      // "free" = Free drag.
      // "xyz" = XYZ Orbit.
      // "off" = Disabled.
      "mouseLeft": "turn", // SID 7001: orbit.mouseLeft
      // Available values:
      // "turn" = Cube turns / free drag outside.
      // "free" = Free drag.
      // "xyz" = XYZ Orbit.
      // "off" = Disabled.
      "mouseRight": "free", // SID 7002: orbit.mouseRight
      // Available values:
      // "free" = Free drag.
      // "xyz" = XYZ Orbit.
      "mouseBoth": "xyz", // SID 7003: orbit.mouseBoth
      "mouseBothEnabled": true, // SID 7004: orbit.mouseBothEnabled
      "orbitSettling": true, // SID 7005: orbit.orbitSettling
      "orbitConfined": true, // SID 7006: orbit.orbitConfined
      "orbitSnap": true, // SID 7007: orbit.orbitSnap
      "orbitDiagonalRoll": true, // SID 7008: orbit.orbitDiagonalRoll
      "orbitAxisLock": true, // SID 7009: orbit.orbitAxisLock
      "orbitDebug": false, // SID 7010: orbit.orbitDebug
      "orbitDebugOverlay": false, // SID 7011: orbit.orbitDebugOverlay
      "orbitCubeUD": true, // SID 7012: orbit.orbitCubeUD
      "orbitCubeLR": true, // SID 7013: orbit.orbitCubeLR
      "orbitCubeFB": true, // SID 7014: orbit.orbitCubeFB
      "orbitDragGuide": true, // SID 7015: orbit.orbitDragGuide
      "orbitDeadZone": 24, // SID 7016: orbit.orbitDeadZone
      "orbitSensitivity": 1, // SID 7017: orbit.orbitSensitivity
      "orbitSmoothing": 70, // SID 7018: orbit.orbitSmoothing
      "orbitSettleTime": 150, // SID 7019: orbit.orbitSettleTime
      "orbitSettleDelay": 20, // SID 7020: orbit.orbitSettleDelay
      "orbitHorizontal": -35, // SID 7021: orbit.orbitHorizontal
      "orbitVertical": -20, // SID 7022: orbit.orbitVertical
      "orbitRoll": -15 // SID 7023: orbit.orbitRoll
    },
    "game": {
      "combined": true, // SID 8001: game.combined
      "poolPiece1": true, // SID 8002: game.poolPiece1
      "poolPiece2": true, // SID 8003: game.poolPiece2
      "poolPiece4": true, // SID 8004: game.poolPiece4
      "poolPiece3": true, // SID 8005: game.poolPiece3
      "poolPiece5": true, // SID 8006: game.poolPiece5
      "poolPiece6": true, // SID 8007: game.poolPiece6
      "poolPiece7": true, // SID 8008: game.poolPiece7
      "poolPiece8": true, // SID 8009: game.poolPiece8
      "poolPiece9": true, // SID 8010: game.poolPiece9
      "poolPiece10": false, // SID 8011: game.poolPiece10
      "poolPiece11": false, // SID 8012: game.poolPiece11
      "scienceMode": false, // SID 8013: game.scienceMode
      "chooseNext": false, // SID 8014: game.chooseNext
      "clearFullFace": true, // SID 8015: game.clearFullFace
      "clearRingFace": false, // SID 8016: game.clearRingFace
      "clearFullSlice": true, // SID 8017: game.clearFullSlice
      "clearRingSlice": true, // SID 8018: game.clearRingSlice
      "gravityEnabled": true, // SID 8019: game.gravityEnabled
      "planeGravity": true, // SID 8020: game.planeGravity
      "sliceGravity": false, // SID 8021: game.sliceGravity
      "gravityDirection0": true, // SID 8022: game.gravityDirection0
      "gravityDirection1": false, // SID 8023: game.gravityDirection1
      "gravityDirection2": false, // SID 8024: game.gravityDirection2
      "gravityDirection3": false, // SID 8025: game.gravityDirection3
      "gravityOccurrence0": true, // SID 8026: game.gravityOccurrence0
      "gravityOccurrence1": false, // SID 8027: game.gravityOccurrence1
      "fallOneCell": true, // SID 8028: game.fallOneCell
      "freedomEnabled": true, // SID 8029: game.freedomEnabled
      "freeSize4": true, // SID 8030: game.freeSize4
      "freeSize3": true, // SID 8031: game.freeSize3
      "freeSize2": true, // SID 8032: game.freeSize2
      "freeSize1": true, // SID 8033: game.freeSize1
      "fragmentsConnected": true, // SID 8034: game.fragmentsConnected
      "rebuildQueueShapes": true, // SID 8035: game.rebuildQueueShapes
      "rebuildOriginalShape": false, // SID 8036: game.rebuildOriginalShape
      "freedomEvent0": true, // SID 8037: game.freedomEvent0
      "freedomEvent1": false, // SID 8038: game.freedomEvent1
      "freedomEvent2": false, // SID 8039: game.freedomEvent2
      "freedomMethod0": true, // SID 8040: game.freedomMethod0
      "freedomMethod1": false, // SID 8041: game.freedomMethod1
      "freedomMethod2": false, // SID 8042: game.freedomMethod2
      "freedomMethod3": false, // SID 8043: game.freedomMethod3
      // Available values:
      // "1" = Full slice — interior required (default).
      // "2" = Surface ring — interior not required.
      "sliceClearMode": "1", // SID 90001: game.sliceClearMode | LEGACY - Legacy rule only; use game.clearFullSlice / game.clearRingSlice.
      // Available values:
      // "0" = Clears only (default).
      // "1" = Off completely.
      // "2" = Always on · random changes each move.
      "gravityMode": "0", // SID 90002: game.gravityMode | LEGACY - Overridden by modern gravityEnabled / gravityOccurrence rules.
      "gravityOneStep": true, // SID 90003: game.gravityOneStep | LEGACY - Overridden by game.fallOneCell.
      "fragmentPerk": false, // SID 90004: game.fragmentPerk | LEGACY - Legacy release mode; modern freedom rules govern release.
      "bandagedFragments": true, // SID 90005: game.bandagedFragments | LEGACY - Legacy bandaging; modern fragmentsConnected governs groups.
      "randomCubies": false, // SID 90006: game.randomCubies | LEGACY - Legacy release mode; use modern freeSize / freedom rules.
      // Available values:
      // "0" = Off.
      // "1" = Free all still-whole pieces.
      // "2" = Free one random whole piece per cleared plane.
      "rebuildMode": "2", // SID 90007: game.rebuildMode | LEGACY - Legacy reconstruction; use modern freedom / rebuild shape rules.
      // Available values:
      // "0" = Off.
      // "1" = Once per cleared plane.
      // "2" = At the start of each new piece turn.
      "releaseTrigger": "0", // SID 90008: game.releaseTrigger | LEGACY - Legacy release trigger; use modern freedomEvent rules.
      "releaseBandaged": true, // SID 90009: game.releaseBandaged | LEGACY - Legacy bandaging; modern fragmentsConnected governs groups.
      "earlyLock": true, // SID 90010: game.earlyLock | LEGACY - Disabled by modern configure_rules; no modern equivalent.
      // Available values:
      // "0" = Equal chances per eligible piece.
      // "1" = Weight by occupied cubies.
      // "2" = Try one random cell (empty cells miss).
      // "3" = Prefer more connected segments.
      // "4" = Prefer fewer connected segments.
      "releaseSelection": "0", // SID 90011: game.releaseSelection | LEGACY - Legacy selection; modern freedomMethod overrides it during selection.
      "releaseScattered": false, // SID 90012: game.releaseScattered | LEGACY - Disabled by modern configure_rules; use modern reconstruction rules.
      "placementGlow": true, // SID 8044: game.placementGlow
      "queueForecast": false, // SID 8045: game.queueForecast
      // Available values:
      // "angular" = Angular (Tengen).
      // "jelly" = Jelly.
      // "gameboy" = Gameboy Tetronimos.
      // "text" = Extruded text [].
      "modelShape": "angular", // SID 8046: game.modelShape
      // Available values:
      // "jelly" = None.
      // "dither" = Dithered.
      // "matte" = Matte.
      // "cel" = Cel shaded.
      // "ascii" = ASCII.
      "pieceAppearance": "jelly", // SID 8047: game.pieceAppearance
      "animations": true, // SID 8048: game.animations
      "activeSpheres": false, // SID 8049: game.activeSpheres
      "rebuildSolidIdentities": true, // SID 8050: game.rebuildSolidIdentities
      // Whole-number percentage "0" through "100": 0 = opaque, 100 = invisible.
      "activeTransparency": "0", // SID 8051: game.activeTransparency
      // Whole-number percentage "0" through "100": 0 = opaque, 100 = invisible.
      "centerTransparency": "0", // SID 8052: game.centerTransparency
      // Whole-number percentage "0" through "100": 0 = opaque, 100 = invisible.
      "stackTransparency": "0", // SID 8053: game.stackTransparency
      "controlGrid": true, // SID 8054: game.controlGrid
      "stackGrid": true, // SID 8055: game.stackGrid
      "xray": true, // SID 8056: game.xray
      "combinedGrid": true, // SID 8057: game.combinedGrid
      "rearGridOnly": true, // SID 8058: game.rearGridOnly
      "activeOutlines": false, // SID 8059: game.activeOutlines
      "customLayers": false, // SID 8060: game.customLayers
      "topOutNewGame": true, // SID 8061: game.topOutNewGame
      "stageFaceMap": false // SID 8062: game.stageFaceMap
    },
    "explorer": {
      // Use "" for all families, or a family ID as a decimal string from the loaded catalog.
      "familySelect": "", // SID 10001: explorer.familySelect
      // Available values:
      // "start" = Start.
      // "target" = Target.
      "navigationTarget": "start", // SID 10002: explorer.navigationTarget
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMinO": "0", // SID 10003: explorer.countMinO
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMaxO": "6", // SID 10004: explorer.countMaxO
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMinT": "0", // SID 10005: explorer.countMinT
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMaxT": "6", // SID 10006: explorer.countMaxT
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMinJ": "0", // SID 10007: explorer.countMinJ
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMaxJ": "6", // SID 10008: explorer.countMaxJ
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMinL": "0", // SID 10009: explorer.countMinL
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMaxL": "6", // SID 10010: explorer.countMaxL
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMinS": "0", // SID 10011: explorer.countMinS
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMaxS": "6", // SID 10012: explorer.countMaxS
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMinZ": "0", // SID 10013: explorer.countMinZ
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMaxZ": "6", // SID 10014: explorer.countMaxZ
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMinJL": "0", // SID 10015: explorer.countMinJL
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMaxJL": "6", // SID 10016: explorer.countMaxJL
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMinSZ": "0", // SID 10017: explorer.countMinSZ
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMaxSZ": "6", // SID 10018: explorer.countMaxSZ
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMinB": "0", // SID 10019: explorer.countMinB
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMaxB": "6", // SID 10020: explorer.countMaxB
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMinF": "0", // SID 10021: explorer.countMinF
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMaxF": "6", // SID 10022: explorer.countMaxF
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMinD": "0", // SID 10023: explorer.countMinD
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMaxD": "6", // SID 10024: explorer.countMaxD
      // Whole-number count "0" through "3"; keep the matching minimum <= maximum.
      "countMinExtraSingle": "0", // SID 10025: explorer.countMinExtraSingle
      // Whole-number count "0" through "3"; keep the matching minimum <= maximum.
      "countMaxExtraSingle": "3", // SID 10026: explorer.countMaxExtraSingle
      // Whole-number count "0" through "1"; keep the matching minimum <= maximum.
      "countMinExtraDomino": "0", // SID 10027: explorer.countMinExtraDomino
      // Whole-number count "0" through "1"; keep the matching minimum <= maximum.
      "countMaxExtraDomino": "1", // SID 10028: explorer.countMaxExtraDomino
      // Whole-number count "0" through "1"; keep the matching minimum <= maximum.
      "countMinExtraV": "0", // SID 10029: explorer.countMinExtraV
      // Whole-number count "0" through "1"; keep the matching minimum <= maximum.
      "countMaxExtraV": "1", // SID 10030: explorer.countMaxExtraV
      // Whole-number count "0" through "1"; keep the matching minimum <= maximum.
      "countMinExtraBar": "0", // SID 10031: explorer.countMinExtraBar
      // Whole-number count "0" through "1"; keep the matching minimum <= maximum.
      "countMaxExtraBar": "1", // SID 10032: explorer.countMaxExtraBar
      // Whole-number count "0" through "1"; keep the matching minimum <= maximum.
      "countMinExtraCore": "0", // SID 10033: explorer.countMinExtraCore
      // Whole-number count "0" through "1"; keep the matching minimum <= maximum.
      "countMaxExtraCore": "1", // SID 10034: explorer.countMaxExtraCore
      // Whole-number count "0" through "3"; keep the matching minimum <= maximum.
      "countMinExtraCenters": "0", // SID 10035: explorer.countMinExtraCenters
      // Whole-number count "0" through "3"; keep the matching minimum <= maximum.
      "countMaxExtraCenters": "3", // SID 10036: explorer.countMaxExtraCenters
      // Whole-number count "0" through "3"; keep the matching minimum <= maximum.
      "countMinExtraEdges": "0", // SID 10037: explorer.countMinExtraEdges
      // Whole-number count "0" through "3"; keep the matching minimum <= maximum.
      "countMaxExtraEdges": "3", // SID 10038: explorer.countMaxExtraEdges
      // Whole-number count "0" through "3"; keep the matching minimum <= maximum.
      "countMinExtraCorners": "0", // SID 10039: explorer.countMinExtraCorners
      // Whole-number count "0" through "3"; keep the matching minimum <= maximum.
      "countMaxExtraCorners": "3", // SID 10040: explorer.countMaxExtraCorners
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMinFacebound": "0", // SID 10041: explorer.countMinFacebound
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMaxFacebound": "6", // SID 10042: explorer.countMaxFacebound
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMinSurfaceNonface": "0", // SID 10043: explorer.countMinSurfaceNonface
      // Whole-number count "0" through "6"; keep the matching minimum <= maximum.
      "countMaxSurfaceNonface": "6", // SID 10044: explorer.countMaxSurfaceNonface
      // Whole-number count "0" through "1"; keep the matching minimum <= maximum.
      "countMinCorePieces": "0", // SID 10045: explorer.countMinCorePieces
      // Whole-number count "0" through "1"; keep the matching minimum <= maximum.
      "countMaxCorePieces": "1", // SID 10046: explorer.countMaxCorePieces
      // Available values:
      // "spatial" = All tetracubes (v2).
      // "classic" = Classic (planar only).
      "datasetSelect": "spatial", // SID 10047: explorer.datasetSelect
      // Use "" for all piece mixes, or an exact bag string offered by the catalog (e.g. "JLOSTZ").
      "familyBag": "", // SID 10048: explorer.familyBag
      // Available values:
      // "" = Any.
      // "none" = Planar only.
      // "mixed" = Mixed planar and spatial.
      // "only" = Spatial only.
      "spatialComposition": "", // SID 10049: explorer.spatialComposition
      // Available values:
      // "" = Any.
      // "none" = None.
      // "any" = At least one.
      // "surface" = At least one without core.
      // "core" = At least one through core.
      "planarSpanning": "", // SID 10050: explorer.planarSpanning
      // Available values:
      // "" = Any type.
      // "O" = O.
      // "T" = T.
      // "JL" = JL.
      // "SZ" = SZ.
      // "B" = B.
      // "D" = D.
      // "F" = F.
      "corePieceType": "", // SID 10051: explorer.corePieceType
      "oneOfEach": false, // SID 10052: explorer.oneOfEach
      "allSurfaceIdentities": false, // SID 10053: explorer.allSurfaceIdentities
      "officialOnly": false, // SID 10054: explorer.officialOnly
      "surfaceOnly": false, // SID 10055: explorer.surfaceOnly
      "nonSurfaceOnly": false, // SID 10056: explorer.nonSurfaceOnly
      "nonFaceboundSurface": false, // SID 10057: explorer.nonFaceboundSurface
      "iTunnelOnly": false, // SID 10058: explorer.iTunnelOnly
      "somaVOnly": false, // SID 10059: explorer.somaVOnly
      "somaSetOnly": false, // SID 10060: explorer.somaSetOnly
      "dominoGapOnly": false, // SID 10061: explorer.dominoGapOnly
      // Available values:
      // "any" = Any.
      // "yes" = Contains.
      // "no" = No extra edges.
      "extraEdges": "any", // SID 10062: explorer.extraEdges
      // Available values:
      // "any" = Any.
      // "yes" = Contains.
      // "no" = No extra corners.
      "extraCorners": "any", // SID 10063: explorer.extraCorners
      // Available values:
      // "any" = Any.
      // "yes" = Contains.
      // "no" = No extra centers.
      "extraCenters": "any", // SID 10064: explorer.extraCenters
      "familyInspectFilters": true, // SID 10065: explorer.familyInspectFilters
      "familyExploreMode": true, // SID 10066: explorer.familyExploreMode
      "practiceMode": false, // SID 10067: explorer.practiceMode
      "canonicalColors": true, // SID 10068: explorer.canonicalColors
      "positionalColors": false, // SID 10069: explorer.positionalColors
      "showSolved": true, // SID 10070: explorer.showSolved
      "showScrambled": true, // SID 10071: explorer.showScrambled
      "familySolidIdentities": true, // SID 90013: explorer.familySolidIdentities | LEGACY - Unused rendering toggle; handler only redraws. Use per-view composition / solid settings.
      // Whole-number percentage "0" through "100": 0 = opaque, 100 = invisible.
      "targetTransparency": "0", // SID 10072: explorer.targetTransparency
      // Available values:
      // "angular" = Angular (Tengen).
      // "jelly" = Jelly.
      // "gameboy" = Gameboy Tetronimos.
      // "text" = Extruded text [].
      "modelShape": "angular", // SID 10073: explorer.modelShape
      // Available values:
      // "jelly" = None.
      // "dither" = Dithered.
      // "matte" = Matte.
      // "cel" = Cel shaded.
      // "ascii" = ASCII.
      "pieceAppearance": "jelly", // SID 10074: explorer.pieceAppearance
      "targetComposite": true // SID 10075: explorer.targetComposite
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
