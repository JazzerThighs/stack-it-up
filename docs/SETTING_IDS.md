# Startup setting identification numbers

Use the end-of-line `SID` numbers in `web/ui/startup-defaults.js` when proposing a menu. For example: "Put SID 6001 under Controls > Turn animations." These are documentation identifiers, not storage keys, engine bits, DOM IDs, or array positions.

IDs stay attached to their full setting paths even if settings move or defaults change. Never renumber existing IDs or reuse retired IDs. Give new settings the next unused ID in their range, and update this index. A renamed setting keeps its ID if its meaning stays the same.

| Range | Scope |
| --- | --- |
| 1001-1999 | Per-view override profiles |
| 2001-2999 | Layer order |
| 3001-3999 | Palette colors |
| 4001-4999 | Shared appearance defaults |
| 5001-5999 | Display defaults |
| 6001-6999 | Controls, Bluetooth and animation |
| 7001-7999 | Orbit and mouse |
| 8001-8999 | Modern game defaults |
| 10001-19999 | Explorer defaults |
| 90001+ | Legacy-only / no modern behavior |

Each empty per-view object is an override profile, not a single widget. Refer to its SID plus a field path (for example, SID 1001 / extraCornerColor). Its fields inherit shared defaults until overridden. The layer-order list is one ordered setting; its strings are layer identifiers, not individually numbered settings.

Hidden does not mean unused. Shared appearance, model/effect, assembly, palette and opacity defaults still seed/reset modern view profiles. Explorer filters and compatibility controls that still affect behavior retain ordinary IDs. Saved preferences may override any live startup default.

Legacy IDs identify defaults with no effect on modern configured gameplay, or an obsolete rendering toggle. They may still matter to legacy imported saves or compatibility paths; they have not been removed. `web/game/session.js` applies the modern rules after legacy setters, and `crates/puzzle-core/src/engine/rules.rs` overrides or bypasses the old behavior. `gravity.rs` routes configured clears away from legacy sliceClearMode; modern release selection substitutes freedomMethod. `familySolidIdentities` only triggers a redraw in spatial-family-controller.js; the renderer does not read its value.

| SID | Setting path | Status / notes |
| --- | --- | --- |
| 1001 | `viewAppearance.active` | Live override profile |
| 1002 | `viewAppearance.stack` | Live override profile |
| 1003 | `viewAppearance.family` | Live override profile |
| 1004 | `viewAppearance.start` | Live override profile |
| 1005 | `viewAppearance.target` | Live override profile |
| 2001 | `layerOrder` | Live default |
| 3001 | `palette.O` | Live default |
| 3002 | `palette.T` | Live default |
| 3003 | `palette.L` | Live default |
| 3004 | `palette.J` | Live default |
| 3005 | `palette.S` | Live default |
| 3006 | `palette.Z` | Live default |
| 3007 | `palette.B` | Live default |
| 3008 | `palette.D` | Live default |
| 3009 | `palette.F` | Live default |
| 4001 | `appearance.extraCornerColor` | Live default |
| 4002 | `appearance.extraEdgeColor` | Live default |
| 4003 | `appearance.extraCenterColor` | Live default |
| 4004 | `appearance.extraCoreColor` | Live default |
| 4005 | `appearance.solidUniform` | Live default |
| 4006 | `appearance.solidColor` | Live default |
| 4007 | `appearance.solidFixed` | Live default |
| 4008 | `appearance.solidGray` | Live default |
| 4009 | `appearance.ditherTransparency` | Live default |
| 4010 | `appearance.lightAzimuth` | Live default |
| 4011 | `appearance.lightElevation` | Live default |
| 4012 | `appearance.lightIntensity` | Live default |
| 4013 | `appearance.lightAmbient` | Live default |
| 4014 | `appearance.ditherLevels` | Live default |
| 4015 | `appearance.ditherSize` | Live default |
| 4016 | `appearance.ditherContrast` | Live default |
| 4017 | `appearance.ditherMidpoint` | Live default |
| 4018 | `appearance.asciiSize` | Live default |
| 4019 | `appearance.asciiExposure` | Live default |
| 4020 | `appearance.asciiDensity` | Live default |
| 4021 | `appearance.asciiCoverage` | Live default |
| 4022 | `appearance.asciiBlend` | Live default |
| 4023 | `appearance.lightPieces` | Live default |
| 4024 | `appearance.lightCubies` | Live default |
| 4025 | `appearance.lightSolids` | Live default |
| 4026 | `appearance.lightOther` | Live default |
| 4027 | `appearance.jellyCornerO` | Live default |
| 4028 | `appearance.jellyBevel` | Live default |
| 4029 | `appearance.jellyProfile` | Live default |
| 4030 | `appearance.jellyElbows` | Live default |
| 4031 | `appearance.jellyOpening` | Live default |
| 4032 | `appearance.cubieScale` | Live default |
| 4033 | `appearance.transparencyGrain` | Live default |
| 4034 | `appearance.transparencyResponse` | Live default |
| 5001 | `display.familyPieces` | Live default |
| 5002 | `display.practiceStartPieces` | Live default |
| 5003 | `display.practiceTargetPieces` | Live default |
| 5004 | `display.activePieces` | Live default |
| 5005 | `display.stackPieces` | Live default |
| 5006 | `display.gameActiveSize` | Live default |
| 5007 | `display.gameStackSize` | Live default |
| 5008 | `display.familySize` | Live default |
| 5009 | `display.faceMapSize` | Live default |
| 5010 | `display.practiceStartSize` | Live default |
| 5011 | `display.practiceTargetSize` | Live default |
| 5012 | `display.uiTheme` | Live default |
| 5013 | `display.overlapThickness` | Live default |
| 6001 | `controls.turnAnimationSpeed` | Live default |
| 6002 | `controls.bluetoothSliceWindow` | Live default |
| 6003 | `controls.bluetoothGyroSmoothing` | Live default |
| 6004 | `controls.bluetoothGyroResponse` | Live default |
| 6005 | `controls.bluetoothGyroSpeed` | Live default |
| 6006 | `controls.bluetoothGyroAcceleration` | Live default |
| 6007 | `controls.bluetoothNeutralCutoff` | Live default |
| 6008 | `controls.bluetoothNeutralDelay` | Live default |
| 6009 | `controls.bluetoothNeutralSpeed` | Live default |
| 6010 | `controls.bluetoothNeutralTolerance` | Live default |
| 6011 | `controls.bluetoothWideWindow` | Live default |
| 6012 | `controls.hoverRings` | Live default |
| 6013 | `controls.ringLabels` | Live default |
| 6014 | `controls.hoverOutline` | Live default |
| 6015 | `controls.hoverIdentities` | Live default |
| 6016 | `controls.showArrows` | Live default |
| 6017 | `controls.arrowGuides` | Live default |
| 6018 | `controls.classicControls` | Live default |
| 6019 | `controls.freeOrbit` | Live default |
| 6020 | `controls.perspectiveCamera` | Live default |
| 6021 | `controls.wideTurns` | Live default |
| 6022 | `controls.bluetoothPackingNeutral` | Live default |
| 6023 | `controls.bluetoothGestureTightness` | Live default |
| 6024 | `controls.bluetoothGestureTolerance` | Live default |
| 6025 | `controls.bluetoothGyroTightness` | Live default |
| 6026 | `controls.bluetoothWideSensitivity` | Live default |
| 7001 | `orbit.mouseLeft` | Live default |
| 7002 | `orbit.mouseRight` | Live default |
| 7003 | `orbit.mouseBoth` | Live default |
| 7004 | `orbit.mouseBothEnabled` | Live default |
| 7005 | `orbit.orbitSettling` | Live default |
| 7006 | `orbit.orbitConfined` | Live default |
| 7007 | `orbit.orbitSnap` | Live default |
| 7008 | `orbit.orbitDiagonalRoll` | Live default |
| 7009 | `orbit.orbitAxisLock` | Live default |
| 7010 | `orbit.orbitDebug` | Live default |
| 7011 | `orbit.orbitDebugOverlay` | Live default |
| 7012 | `orbit.orbitCubeUD` | Live default |
| 7013 | `orbit.orbitCubeLR` | Live default |
| 7014 | `orbit.orbitCubeFB` | Live default |
| 7015 | `orbit.orbitDragGuide` | Live default |
| 7016 | `orbit.orbitDeadZone` | Live default |
| 7017 | `orbit.orbitSensitivity` | Live default |
| 7018 | `orbit.orbitSmoothing` | Live default |
| 7019 | `orbit.orbitSettleTime` | Live default |
| 7020 | `orbit.orbitSettleDelay` | Live default |
| 7021 | `orbit.orbitHorizontal` | Live default |
| 7022 | `orbit.orbitVertical` | Live default |
| 7023 | `orbit.orbitRoll` | Live default |
| 8001 | `game.combined` | Live default |
| 8002 | `game.poolPiece1` | Live default |
| 8003 | `game.poolPiece2` | Live default |
| 8004 | `game.poolPiece4` | Live default |
| 8005 | `game.poolPiece3` | Live default |
| 8006 | `game.poolPiece5` | Live default |
| 8007 | `game.poolPiece6` | Live default |
| 8008 | `game.poolPiece7` | Live default |
| 8009 | `game.poolPiece8` | Live default |
| 8010 | `game.poolPiece9` | Live default |
| 8011 | `game.poolPiece10` | Live default |
| 8012 | `game.poolPiece11` | Live default |
| 8013 | `game.scienceMode` | Live default |
| 8014 | `game.chooseNext` | Live default |
| 8015 | `game.clearFullFace` | Live default |
| 8016 | `game.clearRingFace` | Live default |
| 8017 | `game.clearFullSlice` | Live default |
| 8018 | `game.clearRingSlice` | Live default |
| 8019 | `game.gravityEnabled` | Live default |
| 8020 | `game.planeGravity` | Live default |
| 8021 | `game.sliceGravity` | Live default |
| 8022 | `game.gravityDirection0` | Live default |
| 8023 | `game.gravityDirection1` | Live default |
| 8024 | `game.gravityDirection2` | Live default |
| 8025 | `game.gravityDirection3` | Live default |
| 8026 | `game.gravityOccurrence0` | Live default |
| 8027 | `game.gravityOccurrence1` | Live default |
| 8028 | `game.fallOneCell` | Live default |
| 8029 | `game.freedomEnabled` | Live default |
| 8030 | `game.freeSize4` | Live default |
| 8031 | `game.freeSize3` | Live default |
| 8032 | `game.freeSize2` | Live default |
| 8033 | `game.freeSize1` | Live default |
| 8034 | `game.fragmentsConnected` | Live default |
| 8035 | `game.rebuildQueueShapes` | Live default |
| 8036 | `game.rebuildOriginalShape` | Live default |
| 8037 | `game.freedomEvent0` | Live default |
| 8038 | `game.freedomEvent1` | Live default |
| 8039 | `game.freedomEvent2` | Live default |
| 8040 | `game.freedomMethod0` | Live default |
| 8041 | `game.freedomMethod1` | Live default |
| 8042 | `game.freedomMethod2` | Live default |
| 8043 | `game.freedomMethod3` | Live default |
| 8044 | `game.placementGlow` | Live default |
| 8045 | `game.queueForecast` | Live default |
| 8046 | `game.modelShape` | Live default |
| 8047 | `game.pieceAppearance` | Live default |
| 8048 | `game.animations` | Live default |
| 8049 | `game.activeSpheres` | Live default |
| 8050 | `game.rebuildSolidIdentities` | Live default |
| 8051 | `game.activeTransparency` | Live default |
| 8052 | `game.centerTransparency` | Live default |
| 8053 | `game.stackTransparency` | Live default |
| 8054 | `game.controlGrid` | Live default |
| 8055 | `game.stackGrid` | Live default |
| 8056 | `game.xray` | Live default |
| 8057 | `game.combinedGrid` | Live default |
| 8058 | `game.rearGridOnly` | Live default |
| 8059 | `game.activeOutlines` | Live default |
| 8060 | `game.customLayers` | Live default |
| 8061 | `game.topOutNewGame` | Live default |
| 8062 | `game.stageFaceMap` | Live default |
| 10001 | `explorer.familySelect` | Live default |
| 10002 | `explorer.navigationTarget` | Live default |
| 10003 | `explorer.countMinO` | Live default |
| 10004 | `explorer.countMaxO` | Live default |
| 10005 | `explorer.countMinT` | Live default |
| 10006 | `explorer.countMaxT` | Live default |
| 10007 | `explorer.countMinJ` | Live default |
| 10008 | `explorer.countMaxJ` | Live default |
| 10009 | `explorer.countMinL` | Live default |
| 10010 | `explorer.countMaxL` | Live default |
| 10011 | `explorer.countMinS` | Live default |
| 10012 | `explorer.countMaxS` | Live default |
| 10013 | `explorer.countMinZ` | Live default |
| 10014 | `explorer.countMaxZ` | Live default |
| 10015 | `explorer.countMinJL` | Live default |
| 10016 | `explorer.countMaxJL` | Live default |
| 10017 | `explorer.countMinSZ` | Live default |
| 10018 | `explorer.countMaxSZ` | Live default |
| 10019 | `explorer.countMinB` | Live default |
| 10020 | `explorer.countMaxB` | Live default |
| 10021 | `explorer.countMinF` | Live default |
| 10022 | `explorer.countMaxF` | Live default |
| 10023 | `explorer.countMinD` | Live default |
| 10024 | `explorer.countMaxD` | Live default |
| 10025 | `explorer.countMinExtraSingle` | Live default |
| 10026 | `explorer.countMaxExtraSingle` | Live default |
| 10027 | `explorer.countMinExtraDomino` | Live default |
| 10028 | `explorer.countMaxExtraDomino` | Live default |
| 10029 | `explorer.countMinExtraV` | Live default |
| 10030 | `explorer.countMaxExtraV` | Live default |
| 10031 | `explorer.countMinExtraBar` | Live default |
| 10032 | `explorer.countMaxExtraBar` | Live default |
| 10033 | `explorer.countMinExtraCore` | Live default |
| 10034 | `explorer.countMaxExtraCore` | Live default |
| 10035 | `explorer.countMinExtraCenters` | Live default |
| 10036 | `explorer.countMaxExtraCenters` | Live default |
| 10037 | `explorer.countMinExtraEdges` | Live default |
| 10038 | `explorer.countMaxExtraEdges` | Live default |
| 10039 | `explorer.countMinExtraCorners` | Live default |
| 10040 | `explorer.countMaxExtraCorners` | Live default |
| 10041 | `explorer.countMinFacebound` | Live default |
| 10042 | `explorer.countMaxFacebound` | Live default |
| 10043 | `explorer.countMinSurfaceNonface` | Live default |
| 10044 | `explorer.countMaxSurfaceNonface` | Live default |
| 10045 | `explorer.countMinCorePieces` | Live default |
| 10046 | `explorer.countMaxCorePieces` | Live default |
| 10047 | `explorer.datasetSelect` | Live default |
| 10048 | `explorer.familyBag` | Live default |
| 10049 | `explorer.spatialComposition` | Live default |
| 10050 | `explorer.planarSpanning` | Live default |
| 10051 | `explorer.corePieceType` | Live default |
| 10052 | `explorer.oneOfEach` | Live default |
| 10053 | `explorer.allSurfaceIdentities` | Live default |
| 10054 | `explorer.officialOnly` | Live default |
| 10055 | `explorer.surfaceOnly` | Live default |
| 10056 | `explorer.nonSurfaceOnly` | Live default |
| 10057 | `explorer.nonFaceboundSurface` | Live default |
| 10058 | `explorer.iTunnelOnly` | Live default |
| 10059 | `explorer.somaVOnly` | Live default |
| 10060 | `explorer.somaSetOnly` | Live default |
| 10061 | `explorer.dominoGapOnly` | Live default |
| 10062 | `explorer.extraEdges` | Live default |
| 10063 | `explorer.extraCorners` | Live default |
| 10064 | `explorer.extraCenters` | Live default |
| 10065 | `explorer.familyInspectFilters` | Live default |
| 10066 | `explorer.familyExploreMode` | Live default |
| 10067 | `explorer.practiceMode` | Live default |
| 10068 | `explorer.canonicalColors` | Live default |
| 10069 | `explorer.positionalColors` | Live default |
| 10070 | `explorer.showSolved` | Live default |
| 10071 | `explorer.showScrambled` | Live default |
| 10072 | `explorer.targetTransparency` | Live default |
| 10073 | `explorer.modelShape` | Live default |
| 10074 | `explorer.pieceAppearance` | Live default |
| 10075 | `explorer.targetComposite` | Live default |
| 90001 | `game.sliceClearMode` | Legacy: Legacy rule only; use game.clearFullSlice / game.clearRingSlice. |
| 90002 | `game.gravityMode` | Legacy: Overridden by modern gravityEnabled / gravityOccurrence rules. |
| 90003 | `game.gravityOneStep` | Legacy: Overridden by game.fallOneCell. |
| 90004 | `game.fragmentPerk` | Legacy: Legacy release mode; modern freedom rules govern release. |
| 90005 | `game.bandagedFragments` | Legacy: Legacy bandaging; modern fragmentsConnected governs groups. |
| 90006 | `game.randomCubies` | Legacy: Legacy release mode; use modern freeSize / freedom rules. |
| 90007 | `game.rebuildMode` | Legacy: Legacy reconstruction; use modern freedom / rebuild shape rules. |
| 90008 | `game.releaseTrigger` | Legacy: Legacy release trigger; use modern freedomEvent rules. |
| 90009 | `game.releaseBandaged` | Legacy: Legacy bandaging; modern fragmentsConnected governs groups. |
| 90010 | `game.earlyLock` | Legacy: Disabled by modern configure_rules; no modern equivalent. |
| 90011 | `game.releaseSelection` | Legacy: Legacy selection; modern freedomMethod overrides it during selection. |
| 90012 | `game.releaseScattered` | Legacy: Disabled by modern configure_rules; use modern reconstruction rules. |
| 90013 | `explorer.familySolidIdentities` | Legacy: Unused rendering toggle; handler only redraws. Use per-view composition / solid settings. |
