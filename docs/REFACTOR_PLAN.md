# Refactor master plan

## Authority and scope

The current dual game / packing-explorer application is the product baseline. Its current behavior, native rule tests, browser integration tests and documented contracts are authoritative; a historical HTML implementation is not an oracle.

This work began in `stack-it-up-refactor`, a full local copy of `stack-it-up-3d` without `.git` metadata. Original source commit at duplication: `afbbdd5732fbd8642dd3dcdef0559eb28822a8b4`. The original folder is unchanged. `.github` remains because it contains build/deployment configuration, not repository history. Generated assets and caches were copied to allow local verification without downloading the dataset again.

The objective is to make a small behavior change local, understandable and independently testable. This is an incremental migration, not a replacement of the working application.

## Findings that determine the design

- The old parity check required maintaining a second rules implementation. A correct current behavior could fail deployment when the historical implementation fell behind.
- Rust rules, mesh computation and browser exports shared one crate. The code already had useful internal modules; a crate boundary can isolate computation without rewriting algorithms.
- `web/app.js`, explorer controllers, large HTML settings trees and CSS carry several responsibilities. Moving these files wholesale into new directories would not solve that coupling.
- `web/engine/wasm.js` combines ABI marshalling with presentation identity/history tracking. Binary transport should not depend on visual settings.
- Snapshot fields and serialization versions cross several languages. Some fields are named, others remain numeric offsets. Hand-maintained parallel schemas make changes expensive.
- DOM/WebGL mocks are repeated across large integration tests. They are valuable for contracts but are not evidence of real GPU appearance or timing.
- Retained geometry, worker-based data access and bounded caches already exist. Preserve and measure them before introducing another renderer or moving more code to Rust.
- Legacy explorer renderers remain in the source/build tree. Remove them only after checking imports, lazy loading and packaging reachability.

## Responsibility boundaries

| Area | Owner | Boundary |
| --- | --- | --- |
| Game rules, RNG, transitions, undo, predictions | Rust puzzle core | Deterministic inputs and outputs; no browser dependencies |
| Piece catalog and geometric computations | Rust core and generated catalog | `data/pieces.json` is the source; generated Rust/JS files are not edited manually |
| Wasm exports and memory buffers | Browser engine adapter | Versioned transport; no product UI policy |
| Game/explorer commands and session lifecycle | Browser controllers | Own state, jobs and history boundaries; publish view state |
| Inputs, settings and accessibility | Browser UI | Request commands; do not implement puzzle rules |
| GPU buffers, cameras and animations | Rendering layer | Consume snapshots/events; dispose owned resources |
| Dataset decoding, filtering and graph search | Existing workers initially | Profile before moving hot loops into Rust |

Keep JavaScript for browser orchestration. Introduce types incrementally at module boundaries. Use Rust where computation or shared deterministic rules justify it; do not put DOM settings or UI state into Rust merely to reduce the JavaScript file count.

## Milestones and completion gates

### 0. Independent baseline — completed

- Full local duplicate; no `.git`, no changes to the original checkout.
- Preserve both applications, the packing data, current fixes and asset-versioned builds.
- Record known failures separately from migration regressions.

### 1. Computational core and current contracts — implemented

- Cargo workspace with `crates/puzzle-core` for rules, catalog and mesh computation.
- Root `cube-stack` crate remains the Wasm facade and re-exports the core modules, preserving existing Rust imports and `cube_stack.wasm` packaging.
- Remove the historical HTML reference and both old JS/Wasm parity scripts.
- Replace deployment parity checks with the production adapter contract suite: seeded commands, legal state invariants, preview purity, deterministic undo/redo and the original unique-fit regression.
- Add focused test suites, keeping the full suite available.
- Make conflict checking work without a Git checkout.

Gate: native workspace tests, catalog generation checks, production Wasm build and focused browser/engine/render suites. The new contract test is not a full oracle for every rule: native tests remain essential, and future behavioral changes need explicit expected-result tests.

### 2. Typed contracts and shared test infrastructure - completed

Completed first increment: `data/engine-abi.json` now owns ABI v4 snapshot/event offsets and sizes. `tools/generate-abi.mjs` validates complete, nonoverlapping layouts and generates Rust constants, JavaScript constants and TypeScript declarations. Rust serialization and browser decoding consume those constants; builds and focused core/engine tests reject stale outputs. Rule-setting and saved-state framing schemas were completed in the final increment; shared browser fixtures were completed in the fourth increment below.

Completed second increment: transport and presentation tracking now live in separate modules, with the existing `wasm.js` exports preserved. Forecast workers use the pure transport and no longer import visual settings or presentation tracking. A real-worker test checks that path; transport/presentation command consistency and existing identity/history tests protect the separation.

Completed third increment: strict TypeScript checking now covers the JavaScript transport, snapshot/event metadata, mesh parameters and command usage tests. Native export signatures are generated from Rust and checked for freshness. TypeScript is pinned as a development dependency; build and CI require the check. Presentation/controller boundary checking was completed in the final increment; shared fixtures were completed in the fourth increment below.

Completed fourth increment: the game and explorer smoke suites now share a browser fixture for DOM/WebGL/frame setup; their application assertions remain unchanged. Fixture isolation and cleanup have dedicated tests. Specialized mocks remain local; the real-browser smoke suite was subsequently implemented and passed.

#### Completion review

| Item | Status and evidence |
| --- | --- |
| Snapshot/event ABI and generated exports | Implemented; generation and transport checks pass |
| Transport/presentation separation | Implemented; engine/forecast-worker tests pass |
| Rule and state contracts | Generated flags/shifts/masks used by native rule consumers; schema generates counted/versioned state framing validation. Existing semantic validation stays native |
| Legacy compatibility | Explicit import, malformed-prefix rejection and re-export tests cover every state version 1–8; ABI v4 and share envelope v1 remain distinct |
| Boundary typing | Strict transport, presentation/provenance, game command and explorer mode-controller checks, including negative usage tests |
| Shared mocks | Shared fixture with isolation/cleanup tests; specialized renderer mocks intentionally remain local |
| Filter contract | Resolved: aggregate six versus exact facebound faceSix; deterministic tests pass |
| Real-browser smoke | Passed in the user's Windows terminal: HeadlessChrome 157.0.0.0; game/settings/explorer loading, tab reuse and WebGL context loss/recovery. Runner is also wired into CI |

The implementation and validation gate are complete at the intended boundary scope. The user supplied a successful `npm run test:browser` run, closing the browser validation gap in the agent environment. Future browser checks must not silently skip or substitute mocks. Wider application-wide TypeScript conversion and GPU performance certification are outside this milestone.

1. Define one machine-readable schema for snapshot fields, event layout, rule settings and transport versions. Generate Rust constants and JS/TypeScript declarations; preserve ABI v4 and old saved-state readers during the transition.
2. Split `wasm.js` into memory/command transport and a presentation identity tracker. Keep a compatibility export so callers migrate individually.
3. Add type checking at those boundaries first, then controllers. Avoid converting every file before useful changes can ship.
4. Extract reusable DOM/WebGL test fixtures. Keep real Wasm in integration tests and add a small real-browser smoke suite for loading, settings, both app modes and context cleanup.
5. Resolve the existing filter-contract disagreement explicitly: document the intended family preset, then update behavior or tests accordingly. Do not silently alter filtering as part of architecture work.

Gate: an ABI or rule-setting addition has one schema edit, generated bindings and a focused test; saved games still load; mocks have one shared implementation.

### 3. Controllers and session ownership - implemented

Completed first increment: extracted a renderer-independent game command controller and separate UI effects. Turns, hold, choices, core selection, band locks, debug changes, replay and undo now share command admission and async ownership. Tests cover overlapping actions, rejected commands, failure cleanup, undo and core navigation without a renderer. Completed second increment: new-game configuration, setup/started state, next-piece policy and the shared-state codec/import now live in a DOM-free game session model. UI adapters collect settings and manage dialogs/animation. Tests cover configuration order, setup isolation, unchanged share format, invalid-load isolation and undo after import. Completed third increment: family ledger and bounded lookup/path caches now have a DOM-free session owner. Path-worker ownership is isolated with cancellation, termination and stale-reply protection, backed by controlled race tests. Existing navigation cache lifetime and undo checkpoints are preserved. Completed fourth increment: packing-data requests now share a persistent-worker RPC owner with send-failure cleanup, worker-error settlement, init-failure disposal and an explicit dispose method. Spatial filter queries use latest-request tokens, including the previously missing check after locked-family record validation. Tests cover worker failures and out-of-order filter completions. Completed fifth increment: catalog selection and navigation policy now live in a DOM-free model, with tests for query anchoring, retained filter/inspection selection, explicit navigation, empty results and selection adoption without view navigation. Completed sixth increment: practice demonstrations and scrambles use a renderer-independent playback controller, and practice path workers share the existing cancellable task owner. Controlled tests cover overlapping admission and cancellation during preparation, search and animation, including late errors/progress from superseded runs. Completed final increment: `CubeSession` owns explorer cells, history, initial geometry, generated undo/reset floors and cached turn branches, including recoloring/rebasing. `PackingCube` delegates mutations and retains only rendering/animation effects. Explorer mode entry/exit and stale completion handling live in a testable view controller; game split animation and application tabs are separate UI adapters. Filter-control/schema consolidation belongs to milestone 4; interruption of queued database computation remains performance work.

- Extract game command dispatch, session/undo state, animation sequencing and view switching from `app.js` behind small interfaces.
- Extract explorer filter selection, navigation, family session, packing ledger and playback into separately testable models.
- Define a single lifecycle for worker jobs: generation token, cancellation, result validation and disposal. Stale results must never overwrite a newer session.
- Treat Generate as an undo boundary. Preserve turn caches and the encountered-packing ledger within a session; Random and +/-1/10/100 navigation reset the appropriate session state. Put these rules in model tests rather than scattered click handlers.
- Views subscribe to state changes; they do not own domain histories or duplicate catalog/filter state.

Gate implemented: cube session boundaries and branch-cache behavior have direct renderer-free tests, as do game commands/sessions, selection, playback and mode transitions. Browser integration verifies their adapters. Native game undo remains authoritative in Rust; no duplicate JavaScript game history was introduced. Full-release readiness still depends on the recorded baseline failures and real-browser/GPU checks.

### 4. Settings and reusable UI - implementation complete; browser verification pending

Follow-up: `web/ui/startup-defaults.js` now provides one hand-edited startup function covering preferences, palette, layer order, game rules and explorer filters. Saved preferences override defaults; preference resets use curated values. Both application settings entries open one modal with game/shared and explorer cube contexts. Explorer controls retain identity, listeners and scoped lookup when portaled into that modal. Focused tests cover defaults, reset precedence, repeat initialization and settings context switching; the real-browser test includes the new surface but remains blocked before navigation by the local CDP timeout.

Completed first increment: shared visual preferences now originate in `data/appearance-settings.json`. It defines defaults, labels, validation ranges, commit timing, persistence version and inline availability conditions. A generator emits the browser schema and repeated cubie/Jelly/Dither/ASCII/transparency controls in both HTML entry points; builds reject stale outputs. A DOM-free store accepts legacy preferences, writes versioned envelopes, validates values and preserves unknown future formats. Shared component CSS is loaded in the game, standalone explorer and mounted explorer. Focused migration/control tests and existing navigation tests protect this boundary.

Completed second increment: display/assembly choices, viewport size sliders and theme controls now originate in `data/display-settings.json` and are generated for both apps. Assembly option labels have one schema source. The shared store supports enum values, per-domain numeric validation and key-specific notifications. Legacy display aliases and their precedence remain intact; tests cover versioned reloads, invalid inputs, fractional API sizes, control binding and themes.

Completed third increment: shared control and orbit preferences now originate in separate schemas and use versioned stores with legacy loading. Boolean validation, the smooth-to-xyz mouse-action alias, fractional/clamped orbit inputs and atomic mode changes remain compatible. The generator owns repeated response/alignment sliders; pointer dispatch and derived orbit availability stay in the input domain. Identical camera-control CSS now has one shared owner. Focused input tests cover gesture behavior and migration.

Completed final increment: active game and explorer settings-navigation CSS has separate component sources, expanded into the original stylesheet positions to preserve cascade order. Shared tuning/camera components retain one owner. A temporary-project authoring test adds a new schema field without touching HTML or binders and verifies generated accessible controls in both apps, automatic binding, availability, validation, persistence/reload and stale-output rejection.

Completion review:

| Criterion | Evidence |
| --- | --- |
| Shared defaults, validation and versioned persistence | Four domain schemas; migration and future-format tests |
| A simple setting is added once | `tests/settings-authoring.mjs` exercises a new field end to end |
| Accessible controls and conditional visibility | Generated labels/outputs/help links; navigation and binding tests |
| Gameplay/filter separation | Rules and explorer filters retain existing owners; canonical colors and lock behavior remain covered by explorer tests |
| Component CSS and duplicate consolidation | Shared tuning/camera stylesheet; game/explorer navigation sources regenerate in place without reordering declarations |
| Custom UI remains explicit | Gesture-derived orbit availability, camera mappings, viewport toggles, gameplay controls and filter widgets retain their domain adapters |
| Browser validation | Must pass the real-browser gate; current agent attempts time out before app navigation |

The implementation gate is met. Final browser verification is still outstanding and must not be replaced with DOM/WebGL mocks. General removal of obsolete application CSS and unused assets remains milestone 7 work, not a prerequisite for the settings ownership boundary.

- Introduce a settings schema with defaults, validation, persistence version, availability conditions and labels.
- Generate repetitive setting controls from the schema while keeping custom controls explicit and accessible.
- Separate shared appearance settings from game rules and explorer filters. Canonical Colors stays the default; color locking is independent of family filtering.
- Consolidate duplicate CSS and group it by component. Preserve keyboard, pointer and touch behavior during each extraction.

Gate: a simple setting is added once, receives persistence and availability handling automatically, and has one behavioral integration test.

### 5. Performance work guided by measurements - in progress

Browser measurement harness implemented: `npm run bench:browser` serves a dedicated page using the production packing renderer, geometry worker and dataset worker. It measures deterministic small/large-family Jelly workloads, cold/warm preparation, setting bursts and 1/10/15 closed playback cycles. Reports retain raw draw-submission latency, GL buffer allocations/uploads, sampled page heap, long tasks and queue cancellation counters; destruction checks for remaining GL buffers. See [benchmark procedure and measurement limits](performance/BROWSER_BENCHMARK.md). This probe does not claim physical presentation timing, total-process memory or complete application coverage.

Runtime limit: the Jelly benchmark defaults to and is capped at 15 cycles, following the user's revised requirement. One- and ten-cycle options plus the stop/export control remain available. Short-run reports explicitly leave the 10-to-15-cycle resource gate unassessed.

15-cycle baseline completed: `performance/browser-15-cycle-baseline.json` records 90 turns in each of two small/large-family Jelly scenarios on Chrome 157 / RTX 2070 SUPER. Live GL buffer counts and allocated bytes agree at cycles 10 and 15; all buffers are deleted on renderer destruction. Both median and p95 latency are lower in the last five cycles than the first five in every scenario, with no runtime errors. Median command-to-draw is 414/429 ms for small/large Jelly, including 180 ms animation. This closes the 15-cycle retained-GL-buffer and observed-playback-degradation checks for this fixed whole-piece renderer workload. Total worker/process memory, other assembly modes, game integration and true presentation latency remain outside this evidence.

Earlier interactive verification: a one-cycle run completed both Jelly scenarios on Chrome 157 / NVIDIA RTX 2070 SUPER with no reported errors and zero tracked GL buffers after each renderer's destruction (`performance/browser-quick-check.json`). Median command-to-draw was 495/504 ms for small/large-family Jelly, including 180 ms animation. Six turns per scenario are insufficient for a dependable tail-latency claim. The automated browser smoke still times out at `Runtime.enable` before navigation in this environment; the interactive benchmarks do not close that separate gate.

Initial geometry investigation: [rendering audit](performance/RENDERING_AUDIT.md) and reproducible `npm run bench:geometry` CPU baseline. Clipping/capping dominates the sampled connected Jelly piece. Fixed a one-part join that discarded cached mesh identity and caused redundant fragment preparation. Browser latency, resource plateaus and playback-cycle gates below remain outstanding.

First worker rollout implemented: connected packing/family/practice cubes prepare meshes, closed fragments and motion partitions in dedicated workers. Latest-only queues, revision guards, explicit coverage transfers, readiness-gated turns, retry and disposal are tested with real workers/Wasm and mocked WebGL. Game placement/clear rendering and hover/guide geometry remain follow-up integrations; browser latency and resource-plateau gates are still outstanding.

Before porting algorithms, record timings and retained resources for representative small and large families, cold/warm caches, and 1/10/15 repeated path-playback cycles. Capture p50/p95 command-to-frame latency, peak memory, live GPU buffer counts, uploads per frame and worker cancellation behavior on a named device/browser.

Fragment allocation optimization implemented: triangle classification plus paired typed output buffers reduced sampled cold Jelly fragment preparation from 345/597/372 ms to 36/26/40 ms (full size/small size/profile 6). Pre-change geometry and coverage matched byte-for-byte in 390 differential comparisons. See `performance/RENDERING_AUDIT.md` and the separate before/after reports. This improves CPU preparation; it does not close the browser or resource-plateau gates.

- Make caches session-owned, bounded and observable. Cache keys must include every geometry/identity/style input; evictions dispose GPU resources.
- Reuse retained buffers during turns. Keep mesh creation and database scans off animation frames.
- Profile search loops crossing Wasm repeatedly. If crossing overhead or JS computation dominates, move the complete hot loop into a Rust search module rather than adding more fine-grained exports.
- Benchmark dataset decode/filter work before moving it out of the existing worker. Preserve source IDs and exact family invariants.

Gate: repeat playback reaches a stable resource plateau and does not progressively degrade; compare measurements against the recorded baseline. No claim of improved frame rate is justified by mock-WebGL tests alone.

### 6. Dependency and build simplification

Dependencies are allowed when they remove demonstrated maintenance work. Choose one at a time with a small integration and locked versions. Candidates, not commitments:

- Rust serialization support for versioned state transport; retain readers for existing state formats.
- Generated Wasm bindings if they simplify command/record transport without compromising hot buffer access.
- A vector/math library if it reduces geometry duplication while preserving coordinate conventions.
- TypeScript and a standard browser test runner for contracts and real-browser verification.
- A small UI component library only if settings/component boilerplate remains after schema extraction.

Do not simultaneously replace the renderer, state model, transport and build system. Preserve local bundled assets and static deployment. The current offline build remains usable; when external crates are selected, make fetching a documented setup step and offline operation a supported mode, not an obstacle to using dependencies.

Gate: a dependency has a measured maintenance benefit, license review, pinned lockfile, supported update path and a working packaged/offline app after setup.

### 7. Cleanup and release readiness

- Audit import/build reachability, then remove unused legacy renderers, obsolete assets and stale docs.
- Keep generated artifacts and caches out of any future repository; initialize Git only when requested.
- Ensure CI and local full-suite coverage agree; verify a clean build without copied caches using the documented dataset acquisition path.
- Verify native tests, ABI/saved-state compatibility, both browser modes, keyboard/touch flows and real GPU appearance before retiring compatibility modules.

## Working rules for the migration

Each change should name the responsibility being moved, its stable interface and the behavior tests protecting it. Move code first, change behavior separately. Avoid broad formatting changes during extractions. Prefer focused checks while developing and complete the full gate before a release. Do not edit generated `dist/`, generated piece catalogs or dataset artifacts to fix source behavior.

The first milestone adds no external library requirement. The dependency decision is open deliberately: it should follow a concrete proof of reduced boilerplate, not a blanket dependency-free rule or a wholesale framework rewrite.
