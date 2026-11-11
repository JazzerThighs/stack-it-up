# Architecture

The current game and packing explorer are the reference application. There is no second JavaScript implementation of the game rules. See [the migration plan](REFACTOR_PLAN.md) for future changes; this page describes the current structure.

## Computation and transport

`crates/puzzle-core` is the deterministic Rust library. `engine/game.rs` owns commands, history and predictions; `engine/state.rs` owns state transitions; `engine/gravity.rs` owns clearing and settling. Tables and coordinate conventions are separate modules. `mesh.rs` supplies connected geometry. The library has no browser or filesystem dependencies.

The root `cube-stack` crate is the compatibility facade. `src/abi.rs` exports commands and buffers to Wasm. `src/lib.rs` re-exports the core modules so existing Rust clients and integration tests retain their imports. The browser artifact remains `cube_stack.wasm`.

`web/engine/transport.js` marshals commands and copies exported buffers before retaining them. It imports only the ABI constants and has no rendering or storage dependencies. Snapshot/event layouts originate in `data/engine-abi.json`. Run `node tools/generate-abi.mjs` after editing that schema; it generates `src/abi_layout.rs`, `web/engine/snapshot.js` and its TypeScript declarations. The generator rejects overlaps, gaps, invalid ranges and duplicate names. The ABI is documented in [ABI.md](ABI.md). `web/engine/presentation.js` decorates transport with shape provenance, solid orientations and visual undo history. `web/engine/wasm.js` remains the compatibility facade and supplies live appearance settings to mesh requests. Forecast workers use transport directly. Rule state, RNG, undo and forecasts remain in the computational layer; visual positions never update game rules.

`data/pieces.json` generates the Rust catalog and `web/engine/pieces.js` using `tools/generate-pieces.mjs`. Do not edit generated catalogs directly.

## Browser application

| Location | Current responsibility |
| --- | --- |
| `web/app.js` | Application wiring, HUD, spawn animation and view switching; still needs decomposition |
| `web/game/session.js` | Setup lifecycle, new-game engine configuration, shared-state codec/import and next-piece policy |
| `web/ui/game-setup.js`, `web/ui/session.js` | Collect setup controls and bind session dialogs; delegate state transitions to the model |
| `web/game/controller.js` | Command admission, transaction snapshots, async ownership and undo dispatch; no DOM/render imports |
| `web/ui/game-effects.js` | Command messages, animation sequencing, focus and renderer cleanup |
| `web/input/` | Picking and gesture lifecycle |
| `web/ui/` | Settings, controls and animation choreography |
| `web/render/` | Geometry, shaders, cameras, buffers and rendering passes |
| `web/engine/forecast-*` | Forecast/search worker orchestration |
| `web/explorer/data-*` | Catalog access, filtering and data worker |
| `web/explorer/model.js` | Permutations, coordinate transforms, family correspondence and matching |
| `web/explorer/spatial-explorer.js` | Spatial exploration model and session behavior |
| `web/explorer/*controller.js` | Explorer interaction and view orchestration |
| `web/explorer/family-session.js` | Encountered-packing ledger and bounded lookup/path caches |
| `web/workers/task.js` | Single-job worker ownership, cancellation and late-result isolation |
| `web/workers/rpc.js` | Persistent worker request routing, failure settlement and disposal |
| `web/workers/latest-request.js` | Latest-request tokens for stale UI-result exclusion |
| `web/explorer/retained-pieces.js` | Retained piece geometry and motion resources |
| `web/explorer/cube-view.js`, `views.js` | Explorer rendering integration and playback lifecycle |

The explorer reuses game rendering primitives but has a separate domain model. Physical-piece identities and family invariants must not be confused with presentation colors. Existing retained buffers, worker jobs and session caches are preserved by the first migration.

## Command ownership

`createGameController` receives engine/state getters, busy/setup/lock guards and presentation effects. It owns turns, holds, choices, band locks, core preview/placement, debug-piece changes, forecast steps and undo. Accepted async commands capture before/after state and events once, hold ownership until their effects finish, and release it even when an animation fails. The engine mutation is already committed; presentation failure does not silently roll it back. Forecast dispatch is restricted to its four supported action methods.

`createGameEffects` translates those transactions into messages, renderer operations and focus changes. It does not mutate the engine. Existing input/context entry points in `app.js` delegate to the controller. Drag gestures still provide external busy state. `web/game/session.js` owns setup/started state and applies a plain configuration object collected by `web/ui/game-setup.js`. It also serializes and validates the existing version-1 shared-state envelope, delegates native validation to the engine and retains import undo. Dialog movement, clipboard access, messages and spawn animation remain UI effects. Session mutations observe command busy ownership. Local autosave still uses its separate existing persistence envelope; game/application view switching lives in `web/ui/view-switching.js`, and explorer history is owned by `CubeSession`.

`tests/game-controller.mjs` exercises command ownership and failure recovery using real Wasm and simple injected effects, without a DOM or renderer. `tests/game-session.mjs` checks deterministic configuration, setup isolation, share compatibility, rejected loads and import undo. Browser smoke tests verify the UI integration.

## Explorer family sessions and path jobs

`family-session.js` owns the full encountered-record ledger, its latest-50 display window, up to 256 lookup promises and 32 completed paths. Lookup keys include family, sorted masks and current filters; path keys preserve direction. These caches keep their existing controller-session lifetime across navigation. They contain catalog records and move lists, not GPU/history buffers. UI rendering remains in the spatial family controller; generated-packing undo checkpoints are delegated to `CubeSession`.

`createWorkerTask` owns one path worker at a time. Replacement/cancellation rejects the old caller and terminates its worker; late messages cannot settle or terminate a newer job. Worker errors and postMessage failures release ownership. The no-Worker fallback is also logically cancellable, though JavaScript computation already running cannot be interrupted. Successful paths enter the session cache; cancelled/rejected jobs do not.

`tests/family-session.mjs` checks cache/ledger behavior, including the case where an evicted failed lookup finishes after a replacement has entered the cache. `tests/worker-task.mjs` checks cancellation races with controlled workers. Packing-data requests use `createWorkerRpc`: IDs route concurrent replies, send failures remove their pending entry, worker errors reject all requests and close the client, and explicit disposal terminates the worker. Initialization failure also disposes the worker. `createPackingClient` keeps its existing methods and adds `dispose`; normal tab switching deliberately preserves the live client.

Spatial filter queries use `createLatestRequest` and validate freshness after each data await, including locked-family record validation. Stale results cannot replace current counts/status. This is logical result invalidation, not interruption of work already queued in the shared database worker. Family and practice path workers share the task owner.

## Type checking

Run `npm ci` after obtaining the source, then `npm run typecheck`. TypeScript 5.9.3 is pinned in the npm lockfile (Apache-2.0); it is a development-only dependency. `tsconfig.engine.json` strictly checks the actual JavaScript transport with JSDoc and no emitted code. It also compiles `tests/types/engine.ts`, including intentionally invalid calls that must remain compile errors.

`web/engine/types.d.ts` defines snapshot metadata, events and explicit mesh options. The public transport type is inferred from its checked implementation. `tools/generate-wasm-types.mjs` derives numeric command signatures from the Rust exports into `wasm-exports.d.ts`; unsupported Rust signatures fail generation rather than silently becoming untyped. Run `npm run types:generate` after changing native signatures. Generated signature freshness is checked before compiling.

Presentation/provenance, game commands and explorer mode transitions are also included in this strict check. Type declarations describe the supported current engine, while existing runtime ABI and input validation remain active. A single cast at Wasm instantiation bridges JavaScript's generic exports object to the native interface; static types do not replace runtime compatibility tests.

## Tests and builds

Run `node tools/build.mjs` before focused browser suites. `node tools/test.mjs` reads the suite manifest in `tools/test-suites.json`; `all` is the full sequence. `npm run test:core`, `test:engine`, `test:game`, `test:explorer` and `test:render` are focused entry points.

Native tests cover rules and geometry. `tests/engine-contract.mjs` uses the shipping browser adapter with real Wasm to check state invariants, preview purity, deterministic undo/redo, and the original unique-fit seed regression. The main game/explorer smoke tests share `tests/fixtures/browser.mjs` for DOM elements, WebGL buffers, frame queues and global installation. Options preserve app-specific input defaults, uniform locations and fetch behavior. The fixture offers `restore()` for isolated tests; application smoke runs remain separate processes because application modules retain global references and timers. It is intentionally a minimal contract mock, not a standards-complete DOM. `tests/browser-fixture.mjs` checks isolation, missing-control failures, bounded frame flushing and restoration. Specialized renderer tests retain their purpose-built mocks. Browser integration tests import actual modules with mock DOM/WebGL. They do not establish pixel correctness or GPU timing.

`tools/build.mjs` verifies the catalog, compiles Wasm, copies browser sources, builds local dataset assets and versions the distribution. `dist/` is generated. `tools/check-conflicts.mjs` scans source without requiring a Git repository.

## Making a change

1. Locate the owner above; read the relevant module and focused tests rather than loading every app file.
2. Change rules in the core, transport in the adapter, and presentation in the browser. Keep predictions and actual commands on the same rule path.
3. Version ABI or saved-state changes deliberately and preserve supported old state readers.
4. Run the relevant focused suite after rebuilding changed Wasm. Run the full suite before release and report failures explicitly.
5. Update this map when responsibility moves. Future architecture proposals belong in the plan, not in descriptions of shipped behavior.

## Packing selection policy

`web/explorer/packing-selection.js` owns the current catalog record, matching position/counts, query anchoring and the decision to retain or replace a selection. Filter refreshes retain the selected record when it still matches; family inspection also retains it when excluded. Explicit navigation can request a new cube even for the same source line. An `apply: false` adoption updates catalog selection without navigating the live view. Empty results retain the previous record.

`spatial-explorer.js` rejects stale results before passing them to this model and translates its decisions into DOM updates and view navigation. Live cube/history ownership belongs to `CubeSession`; the selection model does not mutate it. `tests/packing-selection.mjs` covers these policies without DOM or workers.

## Practice playback ownership

`web/explorer/playback-controller.js` owns admission, search/animation sequencing and cancellation for practice demonstrations and scrambles. It admits a run synchronously before view selection awaits, rejects overlapping runs, and checks ownership after preparation, search and each animated move. Cancelled runs cannot publish progress, errors or completion effects into a newer session.

`views.js` supplies plan, animation and UI callbacks. It still resets the cube generation and interaction flags on cancellation; the controller does not own renderer state. Practice path search uses the same `web/workers/task.js` owner as family path search. Worker cancellation terminates the owned worker; fallback cancellation invalidates results but does not interrupt synchronous path computation. `tests/playback-controller.mjs` tests lifecycle races without DOM or rendering.

## Cube history and view switching

`web/explorer/cube-session.js` owns cells, history, initial retained-shape geometry, undo/reset checkpoints and weakly held turn branches. Load and Generate establish boundaries; undo/reset reuse cached arrays, and recoloring maps the reachable graph once while preserving shared references and non-enumerable orientation/origin metadata. `PackingCube` exposes compatibility getters and delegates mutations; it owns animation generation, input guards, GPU state and change notifications. Shape locking rebases initial geometry through the session API. Native game undo remains in Rust.

`web/explorer/view-controller.js` owns catalog/family/practice entry and exit policy. Its effects adapter in `views.js` manages DOM visibility and renderer callbacks. Superseded asynchronous entry cannot perform final refresh effects. Application tabs and game split animation live in `web/ui/view-switching.js`, preserving live sessions and keyboard navigation.

Tests: `cube-session.mjs` covers history/cache/checkpoint/recolor invariants without rendering; `view-controller.mjs` covers superseded mode entry; `view-switching.mjs` covers animated/reduced-motion splits, face-map exit and tab reuse.

## Rule and state metadata contract

`data/game-contract.json` defines rule-control bit assignments and separate native-state/share-envelope version metadata. `tools/generate-game-contract.mjs` rejects overlapping bit fields and emits browser constants plus `crates/puzzle-core/src/game_contract.rs`. Builds and core/engine tests reject stale outputs. The game controls consume generated bit assignments; native rule configuration consumes generated flags/shifts; native imports use generated magic/version bounds; the JS share codec uses generated format/version/dimensions. The state schema now generates structural validation for fixed/counted/versioned sections; semantic decoding and export feature selection remain native code. Native rule consumers use generated flags/shifts. No wire layout was changed.

Strict checks now include the explorer mode controller and tests rejecting unsupported modes or incomplete lifecycle effects. Presentation/provenance and game command control are now checked too; unrelated UI modules remain outside strict checking.

Filter contract: `six` requires O, T, two aggregate J/L and two aggregate S/Z pieces; it permits repeated handedness and lowercase non-facebound equivalents. `faceSix` requires all six facebound identities JLOSTZ. Presets compose with current restrictions and preserve the selected family unless explicitly changing it. Since there are six pieces, minimum counts that sum to six imply exact totals; redundant upper/exclusion ranges need not be hardcoded.

## Milestone 2 boundary completion

The game contract generator now emits native allowed-rule masks, flags/shifts and a structural saved-state validator from ordered schema sections (fixed fields, bounded counted lists and version-conditioned tails). Native imports invoke it before semantic validation. Versions 1–8 remain supported; a dedicated test imports each version and rejects all truncated prefixes plus trailing words without changing the game. Export policy still selects the oldest adequate version; domain validation and migration semantics intentionally remain native code.

Strict checking now includes the presentation decorator, stack-shape provenance, game command controller and explorer mode controller. Dependency declarations describe the coordinate/transform math boundary. The presentation wrapper's single callable cast handles heterogeneous commands while forwarding arguments unchanged; the public API retains transport signatures, tested with invalid-call examples. Transport snapshots do not expose solid rotations; presentation snapshots do.

`tests/real-browser.mjs` starts an installed Chrome/Edge with an isolated profile, serves the built distribution on a loopback ephemeral port, uses the browser's DevTools protocol and exercises startup, settings, application switching and WebGL loss/recovery. It closes its own browser/server and removes only its temporary profile. There are no browser downloads or external pages. Software WebGL is used for portability; this is not GPU timing or visual certification. Run `npm run test:browser`; optionally set `BROWSER_PATH`. CI includes the same gate. The user verified this gate successfully in a normal Windows terminal with HeadlessChrome 157.0.0.0. The agent environment's browser process failures are recorded separately in the validation log.

## Extruded text cubies

`web/render/text-mesh.js` builds cached pixel-font extrusions with front/back faces and exposed contour walls only. Initial glyphs are `[` and `]`; the selected `text` model renders `[]` as two open solids with no backing cube. Geometry uses the existing vertex format, piece colors, lighting/effects and consistent bounds (0.465 half-size for assembled and ordinary loose cubies; caller-supplied sizes for active animations). Text faces local Z and rotates with the existing geometry/retained-piece system. `textMesh` is the reusable glyph engine; `bracketCell` and `bracketPiece` select the current style.

Both model-shape selectors expose Extruded text []. Shared composite/loose geometry routes through piece-mesh.js; explorer loose cubies and hover silhouettes use the same bracket geometry. Sphere/identity-solid overrides retain their existing priority. The glyph cache is bounded to 32 entries. Tests cover outward winding, normals, open center, bounds, colors and cache reuse; smoke suites exercise the style with all existing effects.

## Cubie sizing and inline style tuning

`web/render/cubie-size.js` owns the shared 40–100% cubie scale. Discrete text, Gameboy, sphere and identity-solid geometry shrinks about each cell center. Connected geometry is sized before tessellation: Tengen builds thinner beveled run volumes; native Jelly meshes thinner run occupancy fields with a bounded elbow blend. O rings scale tube thickness around their centerlines. Normals come from the sized surfaces. Size changes invalidate colored, native and retained geometry. Post-triangulation cell-local warping is intentionally avoided: it caused Tengen cracks and Jelly elbow fins. Camera framing remains a separate preference.

`web/ui/style-tuning.js` owns conditional visibility inside the model/effect selector boxes in both applications. Shape settings stay inline through settings navigation: bevel and O-ring controls apply to Tengen/Jelly; profile and elbow smoothing apply only to Jelly; opening applies only with O rings. Dither and ASCII tuning follow the effect selector. Transparency grain and opacity response are shared shader uniforms, visible while pixel transparency is enabled or forced by Dither. Slider preferences persist through the existing visual settings store; geometry sliders rebuild on release.

## Shared appearance settings (milestone 4, first increment)

`data/appearance-settings.json` is the authoring source for shared visual preferences: defaults, bounds, labels, update timing, persistence version, control groups and visibility rules. `npm run settings:generate` emits `web/ui/appearance-schema.js` and marked control blocks in both HTML files. Do not edit generated blocks or the browser schema manually. Add a range or checkbox to an existing group in the schema to receive controls in both apps, binding, validation and persistence; a new conditional wrapper also declares its visibility rule there. Custom select/color controls remain explicitly authored for this increment.

`web/ui/settings-store.js` owns the DOM-free validation and versioned persistence mechanism. `web/render/visual-settings.js` preserves the public appearance API and rendering helpers. Existing unversioned `stack-it-up.visual` preferences load without loss; accepted updates write `{version:1, values:...}` to the same key. Unsupported future envelopes are never overwritten. Storage denial does not stop in-memory preferences. Settings schema/persistence versions are independent of engine ABI and game save versions.

`web/ui/visual-controls.js` binds controls using schema commit timing. Geometry sliders update their output during dragging and commit on release; effect sliders remain live. `web/ui/style-tuning.js` evaluates schema availability rules. `web/ui/settings-components.css` owns shared tuning rows and selector boxes and is loaded by both entry points and the explorer shadow mount. Run `npm run test:settings` for schema freshness, migration, controls, navigation and appearance tests. Display/assembly, input preferences, gameplay rules and explorer filter owners remain separate pending later increments.

## Shared display settings (milestone 4, second increment)

`data/display-settings.json` owns assembly options, per-view assembly defaults, viewport sizes and the theme selector. The settings generator expands reusable option sets and emits `web/ui/display-schema.js` plus marked blocks in both HTML entry points. `web/render/assembly.js` reuses the generated option set; rendering policy remains in that module. `web/ui/display-settings.js` retains theme application and its public API while delegating persistence and validation to the shared store.

Display preferences use a separate version-1 envelope under the existing `stack-it-up.display` key. Schema-declared legacy aliases preserve `gameCombinedSize`, `startSize`, `targetSize` and `gamePieces`, including their prior precedence. Versioned preferences do not reapply legacy aliases. Display numeric values retain rejection of out-of-range inputs and acceptance of fractional API values; appearance settings retain clamping/step normalization. Notifications still identify the changed display key so assembly changes rebuild the right geometry. Run `node tests/display-settings.mjs` or `npm run test:settings` for the migration and binding checks.

## Shared input preferences (milestone 4, third increment)

`data/controls-settings.json` and `data/orbit-settings.json` own defaults and validation metadata for shared controls and camera preferences. Their existing keys (`stack-it-up.controls`, `stack-it-up.settling-orbit`) now hold independent version-1 preference envelopes and still accept unversioned objects. Persisted booleans remain strict; the control command API retains boolean coercion. Orbit numeric inputs clamp without step rounding, and `smooth` mouse actions still normalize to `xyz`. Mode switches publish both flags atomically.

`control-settings.js` and `orbit-settings.js` retain their public APIs and DOM adapters. Simple ring/arrow dependencies are schema declarations; action-dependent orbit availability, mouse/touch routing, debug feedback and viewport toggles remain explicit input policy. Generated response/alignment sliders preserve nested camera labels and release-time commits. Shared camera range/disabled/diagnostic CSS lives in `web/ui/settings-components.css`. `npm run test:input` covers persistence and the existing mouse, touch, wide-drag, settling, cancellation and synchronization behavior. Settings generation validates the game/explorer-specific IDs of custom controls without trying to turn the viewport toggle into a generic setting widget.

## Settings CSS ownership and authoring gate

`web/ui/game-settings.css` and `web/ui/explorer-settings.css` own active navigation/page styles. The settings generator expands them into marked blocks in the original app stylesheets, preserving selector/declaration order and cascade position. Edit the component sources, not the generated blocks. The extraction checked that the full stylesheet token sequence (excluding comments/whitespace) was unchanged. Shared tuning and camera rules remain in `settings-components.css`, loaded in all app modes. Older general dialog/application shell rules stay with their app until the later reachability/cleanup milestone.

`tests/settings-authoring.mjs` uses a disposable project fixture and makes one schema edit. It verifies generated labels/help/output associations and controls in both HTML entry points, then exercises the actual visual binder/store for visibility, numeric validation, persistence and reload. It also verifies that stale generated controls and CSS fail checking. The generator's `--root` option lets the test use the fixture without modifying the working project. `npm run test:settings` includes this completion gate.

## Curated startup settings

`web/ui/startup-defaults.js` is the hand-edited startup policy for shared preferences, palette, layer order and game/explorer controls. Preferences load over these values; shared store resets restore the curated defaults. DOM initialization is idempotent per control surface, including replacement root facades. See [SETTINGS_DEFAULTS.md](SETTINGS_DEFAULTS.md).

`web/ui/shared-settings.js` owns the single application settings dialog and explorer portal. `web/explorer/mount.js` supplies a scoped lookup facade before controller binding, then moves the existing settings subtree into a shadow root within the dialog. This preserves listeners, IDs, styles and live state without restarting exploration. Standalone explorer keeps its single local surface.

## Geometry worker rollout (milestone 5)

Closed cell fragments share `web/render/slice-mesh.js` across worker and synchronous paths. The clipper classifies untouched/discarded triangles before allocating intersection vertices and writes geometry plus transparency ownership into paired typed buffers. Cap topology and ownership interpolation remain the same; `tests/slice-mesh.mjs` checks analytical closed-volume and ownership contracts.

Connected packing, family and practice cubes use one lazy geometry worker per live cube when module Workers are available. The game placement/clear renderer and optional hover/guide geometry remain on their existing paths in this first rollout. Environments without Worker retain the synchronous compatibility implementation; worker errors in supported environments show a retry action instead of silently running the heavy job on the UI thread.

- `web/workers/geometry-preparation.js`: serial CPU owner for piece generation, retained reconstruction, closed cell fragments, motion partitions. It retains one current state and one motion partition, alongside the existing bounded mesh caches.
- `web/workers/geometry-worker.js`: geometry-only Wasm instance and transferable reply transport. It never shares the live game engine's mutable memory.
- `web/workers/geometry-client.js`: one running request plus one replaceable queued request. Superseded results resolve without upload. Disposal terminates the worker and settles pending callers. Already-running synchronous computation finishes unless the worker is terminated.
- `web/explorer/worker-geometry.js`: renderer adapter, revision checks, readiness, uploads, error/retry status and lifecycle. Its key includes retained initial geometry. Revisions protect A-to-B-to-A changes as well as ordinary stale replies.
- `web/explorer/cube-view.js`: keeps the previous prepared scene visible; turns await the required motion partition, and playback awaits the final prepared state. Background camera orbit stays available while turns are gated during preparation. Destruction terminates the worker before releasing GPU resources.

Cell origin and solid-rotation metadata are materialized before structured cloning because session provenance is non-enumerable; retained Lock Shapes reconstruction requires both fields. Mesh coverage is serialized explicitly because custom typed-array properties do not survive structured cloning. Transferable output uses copies, preserving worker cache ownership and avoiding detached cached arrays. Existing buffer objects are reused and retain worker ownership across WebGL recovery.

Each accepted result exposes `geometry.timings`: worker mesh/fragment/assembly stages, job duration, transferred bytes, main-thread upload duration and total request duration. These are preparation diagnostics, not input-to-present or GPU timings. `npm run test:geometry-worker` exercises real Node module workers and release Wasm, plus a mocked-WebGL renderer integration. The browser gate also waits for an actual worker-prepared family cube.

The geometry client also exposes a copied `diagnostics` snapshot with job, queue replacement, stale reply and failure counters. The interactive `tools/benchmark-browser.mjs` server runs `tools/browser-probe.mjs` against built, versioned production modules. GL instrumentation is scoped to benchmark-created contexts and lives in `tools/performance-metrics.mjs`; it adds no shipping renderer overhead. See `performance/BROWSER_BENCHMARK.md` for reproducibility and the distinction between draw submission, presentation and resource measurements.
