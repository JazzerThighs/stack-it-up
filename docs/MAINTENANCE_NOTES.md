# Maintenance notes from the November 6 plan

Use the [implementation plan](IMPLEMENTATION_PLAN.md) for active milestone status. The notes below retain product constraints and candidate investigations from the older plan. Choose a candidate when there is a reproducible problem or a product decision to make.

## Constraints worth testing

- The tetracubes-v2 dataset records 1,871,891 packings in 2,605 families. Family 562, line 50152 is the official start. Preserve identifiers, screw handedness and distinct mirror packings. Load the versioned dataset using relative URLs so a Pages subdirectory works.
- A piece has a physical owner from its source packing, a detected shape in the current position and a presentation color. Two pieces can share a canonical color. Resolve picks and group membership by identity. Keep physical colors, canonical colors and retained segment orientations distinct.
- Editing filters during family inspection preserves the working cube by default. Per-piece exclusions affect recognition. Whole-packing counts determine whether the min/max filters match. Explicit packing navigation loads the selected cube. Use the same shape and placement definitions for recognition and filter limits.
- Queued spatial pieces spawn under the game's non-core placement rules. Explorer and reconstruction recognition can include core-containing shapes where the rules permit. See [gameplay rules](GAMEPLAY_RULES.md).
- Assembly, size and hover presentation must preserve engine state, physical ownership and history. Capture retained cuts from the loaded Start packing, and hide internal caps when segments rejoin. See [retained geometry](RetainedShapes.md).
- Preserve unrelated saved preferences when adding settings. Use the shared schema for controls that span views. See [settings defaults](SETTINGS_DEFAULTS.md) and [setting IDs](SETTING_IDS.md).

## Candidate work and evidence for completion

| Area | Investigation or decision | Evidence |
| --- | --- | --- |
| Browser gestures | Reproduce wheel changes on focused inputs, held-key activation, native image/link drags, context menus, long presses, pinch zoom and overscroll. Decide event ownership per control, preserving editable fields and accessible navigation. | Record browser, control, gesture, expected result and observed result before changing handlers. |
| Device validation | Exercise both practice cubes, family inspection and split/combined play at size extremes on desktop, narrow Android and iOS Safari. Include pointer cancellation, simultaneous buttons, app resume, graphics reset, hover through gaps, duplicate colors and retained cuts across undo, scramble and source replacement. | Record device, browser, mode, packing or game state and result. Keep physical smartcube validation on the active milestone checklist. |
| Performance | Measure cold and warm startup, first query, family changes, first hover, Jelly turns and retained fragments. Track hidden-view frames, cache and GPU growth over repeated navigation. Geometry workers already cover connected explorer cubes. | Use the [browser benchmark](performance/BROWSER_BENCHMARK.md) and [rendering audit](performance/RENDERING_AUDIT.md). Compare the same fixture and hardware before and after a change. |
| Practice | Decide whether a demonstration targets physical membership or also retained orientation. Check current playback controls before proposing pause, step, speed or alignment aids. Bound any path simplification and keep a verified fallback. | Replay reaches the declared target and cancellation leaves a valid cube. A constructive path carries no shortest-path or original-edge guarantee. |
| Sharing and recovery | For a future explorer share format, identify dataset version, source and target, physical identities, history and filters. Decide whether to include appearance. Exercise storage failures, interrupted loads and stale imports. | A round trip reproduces the puzzle. A rejected import preserves the current source and working cube. |
| Accessibility | Check long assembly labels across the five view categories, readable/copyable output, focus, contrast, reduced motion and screen-reader names. Explore keyboard/touch inspection where hover conveys identity. | A player can reach each essential distinction without relying solely on color or a mouse. |
| Release confidence | Exercise cancellation, context loss, tab suspension, recovery and subdirectory asset loading. Run builds serially with tests reading the release tree. | Record automated, real-browser and physical-device results separately. |

The earlier plan deferred reflected deduplication or dataset renumbering, arbitrary cuboids, redesigning every setting, desktop/PWA distribution and new game rules or pieces. Revisit these through a separate design decision. The [3D migration notes](3d-implementation.md) describe historical work.
