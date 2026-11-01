# 3D implementation progress

## Milestone 1: shared piece catalog

`data/pieces.json` is the authored source for nine stable piece IDs: 1 O, 2 T, 3 L, 4 J, 5 S, 6 Z, 7 B (branch), 8 D (right screw), 9 F (left screw). Zero remains the empty sentinel. Uppercase letters are identities; lowercase metadata describes placement, not a separate identity.

`node tools/generate-pieces.mjs` generates the committed Rust catalog (`src/pieces.rs`) and browser catalog (`web/engine/pieces.js`). `npm run catalog:check` detects stale generated files; builds and CI check this automatically. No network or dataset extraction is required to generate these definitions.

Each definition includes its seed geometry, default color, proper-rotation placement masks, non-core placements, distinct non-core center/edge/corner compositions, and the componentwise maximum inventory covering those compositions. Screw mirrors remain different types. J/L and S/Z share spatial geometry but retain their original planar seeds and separate facebound identities.

The existing rules now use catalog planar seeds and precomputed spatial reconstruction placements. Browser classic palette defaults and the spatial color defaults come from the catalog. Existing six-piece gameplay, save validation, WASM layout, and queue generation remain unchanged until the gameplay migration is complete. Existing rounded native mesh color constants are retained for visual compatibility.

The complete spatial placement lists include core-containing shapes for reconstruction and explorer use. `surfacePlacements` / `surface_placements` exclude the core. `surfaceInventory` is ordered centers, edges, corners: B=[2,3,1], D=[2,2,1], F=[2,2,1]. For planar pieces these catalog inventory values cover all non-core spatial placements; existing facebound spawn inventories still come from the legacy face tables. Do not substitute one for the other during migration.

## Milestone 2: playable spatial queue pieces (implemented)

Queue/hold/manual selection and the native placement/spawn tables now support IDs 7..9. Queue-pool checkboxes in new-game setup default to all nine, and allow classic-only or any custom nonempty pool. The selected pool applies on New Game; editing those checkboxes during a game does not mutate its live queue. The native engine's legacy default remains classic for old saves and consumers.

B uses two centers, three edges and one corner; D/F use two centers, two edges and one corner. Completion always uses four cubies. Extra inventory is cleared as before. Surface gaps can auto-place a four-cell piece when no unfinished full inventory fits; neither ordinary nor automatic queued B/D/F placement may occupy the core. Single completions lock immediately; ambiguous spatial completions use numbered isometric choices with hover/focus previews. No fake face is assigned to a spatial lock.

Queue and hold previews show fixed isometric shapes. All nine colors are configurable in both apps. The engine still supports existing planar automatic/core fallback behavior. Existing reconstruction constraints are preserved; adding spatial pieces does not automatically disable the player's facebound reconstruction rule.

Transport v5 appends the enabled-pool mask after the v4 rules/plane tail, permits piece IDs 1..9, and uses u32::MAX for legacy-rule mode. Legacy v1..v4 imports remain supported. Exports stay at their legacy version when the state contains only classic pieces and the classic pool. The fixed snapshot layout remains v4; added ABI exports are game_piece_pool, game_set_piece_pool, and game_choice_mask. Spatial choice IDs are 6..20, while face choice IDs remain 0..5. The browser checks for the new capability. Forecasting enumerates both kinds of choices and replays through the actual engine.

Tests cover every spatial placement and chirality, inventory counts, gap auto-placement versus core top-out, hold/undo/transport, custom pools, browser previews and choices, colors, and v5 forecast witnesses.

## Milestone 3: expanded packing explorer (implemented)

The default explorer collection now contains all 1,871,891 packings in 2,605 families from the repository-owned results.7z. Classic Collection remains selectable as a planar-only filter on the same database and source-line IDs. No packing data is fetched from another repository.

The build validates the archive, every piece mask, identity, metadata row and family membership before generating a compact filter index and independently compressed family chunks. Filtering runs in a Web Worker; full records are decoded on demand with a bounded family cache. Assets have checksums and travel with the versioned app build. The browser needs module workers and gzip DecompressionStream support; both collection views require these browser capabilities.

Expanded filters cover spatial piece composition, core occupancy/type, planar pieces crossing faces, identity bags, per-type counts and family membership. J/L and S/Z counts are combined because their unrestricted spatial geometry is equivalent. B, D and F remain separate. Lowercase spatial identities mean core occupancy. The target/scrambled views, arbitrary or random same-family practice, and interactive family exploration use the new dataset. Completed spatial pieces replace their identity solids and trigger indexed packing metadata lookup. Official-compatible coloring retains the classic official reference family.

Validation covers every binary member and index offset, filter partitions, proper rotations and chirality, practice compatibility, official-reference lookup, and the explorer controls with the real dataset and native mesh engine.

## Remaining validation

Real-device mobile and performance checks remain useful, particularly first-load latency and memory on older phones. The dataset is served in compressed family chunks rather than expanded text, but the filter index still occupies about 36 MiB in its worker.

## Unified collection data

The obsolete classic text datasets, family metadata and loader have been removed. All modes use the indexed tetracubes-v2 database. Classic Collection applies a no-spatial-pieces filter, retaining all planar compositions and core/face-spanning options. Switching collections does not reload the page. Every record has a family, so the obsolete No packing family filter is removed. Official-compatible colors retain only the six reference masks, not a second packing database. Historical classic source-line numbers are not mapped to the new IDs.

## Milestone 4: performance and regression hardening

Filtering compiles composition constraints per identity bag and uses numeric bit checks in its record scan. Unrestricted count controls skip composition work entirely. A single reusable 7.1 MiB typed buffer holds selected IDs; changes no longer allocate and copy an additional selection array. Random practice chooses a family and two member positions without collecting every matching record into JavaScript arrays. Completed-packing lookups build mask keys without decoding full metadata objects for each family member.

The generated database is moved into the immutable release namespace during packaging, so the published output contains one compressed copy instead of two. Both collection views and worker requests resolve within that namespace, including on GitHub Pages subpaths. The dataset still contributes to the release fingerprint.

On the development PC, a representative default-filter scan fell from about 3,419 ms to 21 ms; a branch count filter from 1,836 ms to 22 ms; and a core-type filter from 1,703 ms to 31 ms. Random-pair selection including a filter scan and family decode fell from about 3,458 ms to 214 ms. These are local Node measurements, not mobile-browser guarantees. `tests/packing-performance.mjs` records fresh timings without machine-dependent timing assertions, checks independent predicate results, verifies buffer reuse, and limits family loads.

Spatial rendering regression tests cover surface/core B/D/F meshes in all six styles, explorer colors, static mesh reuse and closed cached fragments. Existing suites cover transparency, animations, saved states, gameplay and forecasting. Browser-control tools were unavailable for this milestone; real-device mobile startup, memory and visual inspection remain pending.

## Official startup and shared navigation

Family Explorer starts from tetracubes-v2 line 50152, family 562 (the official JZLSOT packing), without replacing it with a random family member. Every explorer mode uses the same Previous / Random / Next toolbar and Choose packing panel for family filtering, skips and source-line jumps. In two-packing mode, Change cube selects whether those controls replace Start or Target. Pair loading, random same-family pairs and swapping are in that same panel. Mode switches retain the current family puzzle unless the selected source packing changes.
