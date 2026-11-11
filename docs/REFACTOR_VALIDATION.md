# Refactor validation — first milestone

## Passed

- Full copy has no `.git` metadata, including nested directories.
- Original `stack-it-up-3d` checkout remains clean.
- All 12 extracted engine/catalog/mesh source files are byte-identical to the original files.
- `node tools/check-conflicts.mjs` works without Git.
- `node tools/generate-pieces.mjs --check` confirms the generated catalog at its new path.
- `cargo test --workspace --offline`: all native unit, integration and doc tests passed.
- `node tools/build.mjs`: rebuilt production Wasm and both browser entry points, including local packing assets; asset version `76327e388000a1f7`.
- `node tools/test.mjs engine`: 4,488 engine snapshots, preview purity, deterministic undo/redo and the original mode=2 / seed=10 / step=49 unique-fit regression; forecast tests passed.
- `node tools/test.mjs game`: real Wasm with browser-module smoke coverage and local save/restore tests passed.
- `node tools/test.mjs explorer`: family/color locking, explorer interactions, settings and retained rendering smoke checks passed.
- `node tools/test.mjs render`: Gameboy relief/lighting, retained pieces and rendering resource checks passed.
- `node tests/version-build.mjs`: release asset isolation, GitHub Pages subpaths, legacy asset exclusion and dataset worker paths passed.

## Known baseline failures

`node tests/filter-counts.mjs` fails at line 27 in both the original and refactoring folders. The test assumes the preset always produces `JLOSTZ`; random results include other permitted combinations (`JLOSST` in the original run, `LLOTZZ` in the copy). This disagreement predates the extraction. The full suite still includes the test and will fail until the intended preset contract and assertions are reconciled. It has not been skipped or weakened.

`cargo clippy --workspace --offline --all-targets -- -D warnings` fails on eight lint diagnostics in the extracted, byte-identical core source: nonminimal booleans, unnecessary unwrap, collapsible conditionals and a manual range check. The source files are unchanged; these are recorded for a separate cleanup rather than mixed into the structural move.

The full `npm test` chain was not run end-to-end for this milestone. Focused suites and the native suite were run as listed above, and the known filter failure was reproduced directly in both folders. Node also emitted a local-storage configuration warning; the focused suites completed successfully.

## Limits

No deployment or Git initialization was performed. No real-browser visual comparison or hardware GPU profiling was performed. Mock-WebGL resource assertions are useful regression checks, but not measured user-visible performance. A clean machine build without the copied dataset cache remains a later release gate.

## Milestone 2, first increment: shared snapshot/event schema

Implemented `data/engine-abi.json` and `tools/generate-abi.mjs`. Generated Rust/JavaScript constants now drive production snapshot writes and event encoding/decoding; TypeScript literal declarations are generated alongside the JavaScript. ABI version 4, snapshot size 226 and event size 86 are unchanged. Build and core/engine test entry points check generated-file freshness.

Validation completed:

- Native workspace suite passed.
- Production build passed, asset version `4a1cfb5e5d180aa0`.
- Engine and game focused suites passed, including 4,488 engine snapshots, forecast replay, saved-state compatibility and browser module integration.
- One-time migration comparison against the original production Wasm passed 4,148 raw snapshot/event comparisons across all three gravity modes and twelve seeds. The original artifact is not required by the permanent test suite.
- Deliberately invalid schemas were rejected for overlaps, gaps, invalid ranges and duplicate names.
- Generated-file freshness and conflict-marker checks passed; original checkout remains clean.

Rule-setting schemas, saved-state layout generation, adapter/presentation separation and active TypeScript checking remain future increments. Previously recorded filter and strict Clippy failures were not changed or rerun in this increment. No real-browser GPU verification was performed.

## Milestone 2, second increment: transport and presentation separation

- `web/engine/transport.js` now owns Wasm loading, commands, validation and copied buffers; its only module dependency is the generated ABI layout.
- `web/engine/presentation.js` owns solid orientations, retained shape metadata and visual undo history.
- `web/engine/wasm.js` preserves `createEngine`, `adaptEngine` and the existing mesh settings behavior for browser callers.
- The actual forecast worker uses pure transport, avoiding visual-settings/storage initialization and presentation histories.
- Added `tests/engine-transport.mjs` to the full and engine suites. It runs the actual worker entry point with real Wasm, compares commands/logical state through raw and decorated engines, and checks snapshot buffer isolation. Existing retained-stack and solid-identity tests are now also included in the focused engine suite.

Production build passed (asset version `8c5240a582479fda`). Engine, game, retained-stack history rollover, solid identities, rendering resource and release-version checks passed. Native algorithms and ABI layout were unchanged, so the native suite was not rerun for this JavaScript extraction. Previously recorded filter/Clippy failures remain outside this increment. Browser checks use mock DOM/WebGL; real GPU profiling remains outstanding.
The complete focused explorer suite also passed: family/color locking, explorer interactions, settings navigation and GPU recovery contracts.

## Milestone 2, third increment: checked transport interfaces

Added TypeScript 5.9.3 as a pinned, Apache-2.0 development dependency with an npm lockfile. The registry was inaccessible from this session; installation used the existing npm cache copied into a writable temporary cache. A subsequent offline `npm ci` succeeded against the lockfile.

`npm run typecheck` strictly checks the production JavaScript transport with JSDoc, without emitting or converting browser code. Snapshot metadata, event records and mesh options have explicit interfaces; the transport API is inferred from its checked implementation. The generator derives 47 production Wasm signatures from `src/abi.rs`, rejects unsupported signature types and verifies generated declarations are current. Generic WebAssembly exports are cast once at instantiation; existing runtime validation is preserved.

Compile-time usage tests verify valid calls and require errors for wrong command types/arity, incomplete mesh options, invalid preview lists and attempts to read presentation metadata from raw transport. Build and full/engine test entry points enforce the check. CI installs the locked development tool first. Packaging excludes node_modules and dataset caches.

Passed: lockfile reinstall, strict type checks, generated signature checks, production build (`872f45d848f4af80`), engine suite including 4,488 snapshots and forecast/identity/undo tests, game suite including save/restore, versioned asset tests and conflict scan. Original checkout remains clean. The only runtime implementation adjustment groups existing snapshot metadata assignments with Object.assign; the properties and values are unchanged.

Strict checking currently covers transport and its usage tests, not presentation, workers or controllers. The broader full suite and real-browser GPU checks were not run for this increment. Existing filter/Clippy failures remain unchanged.

## Milestone 2, fourth increment: shared browser fixtures

Extracted common DOM elements, WebGL buffer stubs, global setup and bounded animation-frame flushing into `tests/fixtures/browser.mjs`. Both main smoke tests now use it, retaining their different default values, uniform-location behavior and asset fetching. All 208 game and 293 explorer application assertions remain; only the duplicate missing-ID assertion moved into the fixture.

Added `tests/browser-fixture.mjs` to full/game/explorer suites. It verifies independent elements/GPU bindings/frame queues, bounded rescheduling, missing-control failures and restoration of previous global property descriptors. Smoke tests still run as separate processes; the fixture does not claim to emulate a standards-complete browser or dispose application timers.

Fixture tests, game suite and conflict scan passed. Production application files and build outputs were unchanged, so no rebuild or native tests were needed. Existing filter/Clippy failures were not changed. Specialized renderer mocks and real-browser validation remain future work.
The complete explorer suite also passed, including family/color locking, live-history preservation, settings navigation and rendering recovery. The original checkout remains clean.

## Milestone 3, first increment: game command controller

Extracted `web/game/controller.js` from application command handlers. It owns admission guards, pre/post snapshots, event capture and async command ownership for turns, hold, choices, band locking, core selection, debug changes, forecast actions and undo. `web/ui/game-effects.js` owns messages, renderer operations, animation sequencing and focus, with no engine mutations. Application/context handlers delegate through the controller.

Added renderer-free tests using real Wasm plus injected effects for concurrent command rejection, undo, setup/lock/hold/pending guards, core navigation and presentation failure. A failed animation leaves the already-committed engine state intact but releases command ownership so undo/retry remains available. Forecast replay accepts only its supported engine actions. The full and game suites include these tests.

Production build passed (`377027ae53151cdc`), including strict transport typing and generated contract checks. Controller tests, browser fixture tests, browser game smoke coverage, local save/restore, release-version checks and conflict scan passed. Original checkout remains clean. Native engine algorithms, ABI and explorer were unchanged; native and full explorer suites were not rerun. Known filter/Clippy failures remain unchanged.

This starts milestone 3; it does not complete all session ownership work. New-game settings and import/sharing, explorer session models and unified worker cancellation remain outstanding. Controller typing and real-browser GPU validation also remain future work.

## Milestone 3, second increment: game session setup and sharing

Added `web/game/session.js` to own setup/started state, deterministic new-game configuration, next-piece admission, version-1 shared-state encoding/decoding and native import validation. `web/ui/game-setup.js` collects a plain configuration object. The application retains spawn animation and renderer cleanup; `web/ui/session.js` retains dialog/clipboard behavior and delegates session transitions. Session guards observe active command ownership. Local autosave keeps its existing envelope.

Renderer-free tests compare new-game configuration with the prior native call sequence, verify setup leaves the puzzle unchanged, exercise share roundtrips and native validation, reject malformed/oversized/wrong-dimension payloads without mutation, and verify a successful import is undoable. The full/game suites include these tests.

Passed: session/controller/fixture tests, full focused game suite (including setup, sharing, saved games and core choices), generated contracts, strict transport typing, production build (`52bb8f8f27c851bb`), release asset checks and conflict scan. Original checkout remains clean. Native rules, ABI and explorer code were unchanged; native/full explorer suites and real-GPU checks were not rerun. Existing filter/Clippy failures remain unchanged.

Milestone 3 continues with explorer session ownership and worker cancellation; it is not yet complete.

## Milestone 3, third increment: family sessions and owned path jobs

Extracted `web/explorer/family-session.js` for the encountered-packing ledger (latest 50 shown), bounded lookup cache (256) and completed path cache (32). Existing keys, session lifetime across navigation and view-owned undo checkpoints are preserved. The UI controller only renders ledger results and orchestrates views.

Added `web/workers/task.js` and integrated it with family path construction. Cancellation/replacement rejects the old promise, terminates its worker and detaches handlers. Replies/errors are tied to the job that created them, fixing a race where a stale handler could terminate a newer worker. Logical cancellation covers the no-Worker fallback, without claiming it can interrupt synchronous JavaScript already executing. Failed/cancelled paths are not cached. Failed evicted lookups no longer delete newer cache entries for the same key.

Controlled tests cover stale messages, worker errors, postMessage failure, fallback cancellation, ledger deduplication, family/filter key separation, bounded caches and retries. Tests are included in full/explorer suites. Build passed (`ffc2bf0aa4f517b2`), including generated contracts and transport typing; direct worker/session tests, release asset checks and conflict scan passed. Original checkout remains clean.

Packing-data RPC, filter/navigation state and other worker controllers have not yet migrated. No native rules changed, and no real-browser performance claim is made. Existing filter/Clippy failures remain unchanged.
The complete focused explorer suite passed, including family/color locking, replay, GPU recovery, retained history across filter changes and settings navigation (mock DOM/WebGL).

## Milestone 3, fourth increment: packing-worker RPC and query freshness

Added `web/workers/rpc.js` for persistent request routing, progress callbacks and lifecycle ownership. Packing-client calls retain their API; `dispose()` is added for explicit teardown. Send failures remove their own pending request. Worker/decode failures reject all pending requests, terminate the worker and reject future calls immediately. Failed client initialization also disposes the worker. Normal app switching keeps the live client.

Extracted latest-query tokens into `web/workers/latest-request.js`. Spatial filtering retains its existing stale-response checks and adds the missing check after awaiting a locked-family record. This prevents superseded validation from continuing into UI changes or another query. It does not cancel computation already queued in the shared database worker.

Controlled tests cover out-of-order RPC responses, progress, unknown IDs, send failure, request/decode errors, pending-request settlement, initialization failure and explicit client disposal. Added an explorer integration regression that completes two filter requests out of order and checks newest counts/status plus live cube/history preservation.

Build passed (`5563069cc911ceed`), including generated contracts and transport typing. Direct worker RPC tests, release-asset checks and conflict scan passed; original checkout remains clean. Native rules, ABI and data-worker computations were unchanged. Existing filter/Clippy failures and real-browser GPU profiling remain outstanding.
The complete focused explorer suite passed, including the new out-of-order filter integration regression, family/color locking, retained history and settings navigation (mock DOM/WebGL).

## Milestone 3, fifth increment: packing selection policy

Extracted catalog selection, query anchoring, filter/inspection retention and view-navigation decisions into `web/explorer/packing-selection.js`. The spatial UI retains control reading, stale-result validation, display updates and view calls. Live undo/history and session cache ownership are unchanged.

Direct model tests pass for anchored offset/filter queries, action overrides, same-record retention, excluded/empty inspection results, explicit navigation, adoption without view navigation and empty-result retention. Added the tests to the full and focused explorer manifests.

Build passed (`314e5ebf26139aaa`), including generated contracts and transport typing. Release-asset checks and conflict scan passed; the original checkout remains clean. The initial integration invocation overlapped the build and found missing generated assets; it was restarted after the build completed. Existing full-suite filter-count/Clippy issues and real-browser GPU profiling remain outstanding.

The complete focused explorer suite passed after the build, including filter/inspection history retention, out-of-order query results, family/color locking, playback and settings navigation (mock DOM/WebGL).

## Milestone 3, sixth increment: practice playback and worker ownership

Moved practice playback admission, asynchronous sequencing and cancellation into `web/explorer/playback-controller.js`. The view supplies UI and animation effects. Practice path workers now use the shared task owner rather than view-local mutable worker references. Cancellation suppresses stale completion/progress after a pending animation and stale search errors. Admission happens before awaiting view selection, preventing overlapping preparation from starting two demonstrations.

New direct tests pass for complete sequencing, overlapping admission, cancellation during preparation/search/animation, replacement isolation and failures in preparation, planning and playback. Build passed (`878d56ae47b91061`), including transport types and generated contracts. Release-asset and conflict checks passed. Original checkout remains clean.

Milestone 3 remains in progress: domain histories and broader view switching are not fully extracted. The existing full-suite filter-contract/Clippy failures are unchanged. Mock rendering does not certify real GPU performance; cancelled fallback computation can still consume CPU until it returns.

The complete focused explorer suite passed, including practice demonstration/scramble/return-path integration, family locking, live history retention, out-of-order filtering and settings navigation (mock DOM/WebGL).

## Milestone 3 completion: cube history and view switching

Extracted explorer cell state, history, initial geometry, generated checkpoints, inverse/forward caches and graph-preserving recoloring into `CubeSession`. `PackingCube` delegates all history mutations, and family shape locking uses a rebase method. Extracted explorer mode lifecycle into a DOM-free controller with superseded-entry guards; moved game split animation and application tabs into a dedicated UI adapter. Native game history remains in Rust.

New direct tests pass for undo/reset floors, cache reuse, recoloring and rebasing; mode cancellation/entry/refresh ordering; split animation admission, reduced motion, face-map exit and application keyboard/tab reuse. Build passed (`af89c1e2b7d47763`), including generated contracts and transport types. Focused game suite, face-map tests, release asset checks and conflict scan passed.

The ownership gate is implemented; filter-control/schema work is milestone 4. Previously documented full-suite filter-contract and Clippy failures are not resolved by this change. Browser integration uses mock DOM/WebGL; real GPU performance and visual certification remain outstanding.

Complete focused explorer suite passed, including generated undo boundaries, family locks, recoloring, practice playback, filter/inspection history retention, stale queries and settings navigation. Original checkout remains clean.

## Milestone 2 status audit - November 8, 2026

Changed the stale Next designation to In progress (gate not yet met). Verified generated contracts and transport typing by running the complete focused engine suite: all passed, including 4,488 engine snapshots, forecast workers, versioned state replay and retained identity/history checks. Re-ran `node tests/filter-counts.mjs`: it fails at line 27 because the current six preset accepts JJOSTZ while the assertion expects JLOSTZ. The test selects a random record, so a passing draw would not establish the contract; deterministic counterexamples are needed. Later explicit-range and family-reset assertions also disagree with current preset source.

Source audit confirms rule bits are handwritten on both sides, saved-state/share versions are not generated by engine-abi.json, strict typing covers transport only, and common smoke tests use mocks rather than a real-browser runner. No production behavior or tests were changed. The plan now lists exact open tasks and distinguishes the separate protocol versions. Milestone 4 was not started because the user conditioned it on Milestone 2 having nothing left to do.

## Milestone 2 continuation: clarified filters and generated metadata

User confirmed that six allows aggregate J/L and S/Z counts while faceSix requires facebound JLOSTZ. Updated the old filter standard accordingly, with deterministic acceptance/rejection examples and preserved family/composable-range assertions. Filtering implementation is unchanged apart from its explanatory comment. Filter-count tests pass.

Added a rule/version schema and generator with overlap validation and build freshness enforcement. Wired browser rule controls, selected native configuration expressions, native magic/version acceptance and JS share metadata to generated constants. Saved-state layouts/readers remain intact; full native rule-literal and variable-layout schema consolidation is still outstanding. Added strict explorer mode-controller typing and compile-time misuse checks. Real-browser smoke and broader presentation/controller typing remain open.

Build passed (`6fb157713a930b0b`). Initial compilation caught an import placed above a Rust module doc comment; corrected the import location before the successful build.

Passed after integration: complete offline native workspace tests, focused engine and game suites, clarified filter-count suite, mode-controller tests, strict typing, versioned release checks and conflict scan. The original checkout remains unchanged. Milestone 2 remains in progress; detailed saved-state schema generation, wider native-rule consumption, broader type coverage and real-browser smoke tests remain.

## Milestone 2 final implementation and validation limit

Implemented schema-driven rule flags/shifts/masks across native rule consumers, ordered fixed/counted/versioned state framing validation, and explicit compatibility/rejection tests for all state versions 1–8. Existing serializers and semantic validators retain their wire layouts and domain checks. Strict checking now covers presentation/provenance, game commands and explorer mode transitions as well as transport, with compile-time misuse tests.

Production build passed (3bb3bf4dc36c44d1). Native workspace tests passed; the new all-version sharing test passed separately after addition. Engine/game integration passed before the final controller typing adjustment and is being revalidated. No original checkout changes.

Real-browser runner and CI gate were added. Local Chrome starts DevTools but its GPU subprocess exits with Windows status -1073741790 (0xC0000022/access denied), followed by a fatal unusable-GPU error. With in-process software GPU, Runtime.enable times out. Installed Edge reports Target crashed before application startup can be validated. Browser sandbox flags were not disabled and no host permissions were changed. These failures are not evidence that app browser checks passed. Final sign-off remains blocked on a successful `npm run test:browser` outside the failing browser process environment.

Final revalidation passed: complete focused engine and game suites, filter contract tests, saved-state versions 1–8, strict boundary/misuse checks, release-asset checks and conflict scan. Native workspace tests passed with the schema validator. Real-browser execution remains the sole unverified Milestone 2 gate; original checkout unchanged.

## Milestone 2 sign-off: user-verified real browser

The user supplied successful output from `npm run test:browser` in their Windows terminal. Passed: browser startup, game startup, context loss, context restoration, explorer startup, settings, application tab reuse and WebGL recovery. Browser: HeadlessChrome/157.0.0.0 on Windows NT 10.0 Win64 x64. This evidence is user-reported execution, not an agent rerun or a CI run.

This closes the remaining real-browser gate. Milestone 2 is complete within its stated scope. Earlier agent-environment failures remain historical diagnostics; they do not invalidate the successful user run. This is smoke coverage, not GPU performance or pixel-level visual certification.

## Extruded text [] rendering mode

Added a bounded, cached pixel-glyph extrusion engine and an Extruded text [] model option in both game and explorer. Brackets are actual open geometry, not decals or relief on a backing tile. Shared mesh dispatch covers composite pieces, active/loose cubies, retained fragments and explorer hover geometry. Existing explicit spheres/identity-solid settings keep their priority.

Geometry tests passed for scale, outward winding, normalized normals, open center, palette preservation, cache reuse and native-mesh-independent dispatch. Production build passed (d5e3b105e32d687d), as did release-asset and conflict checks. Game and explorer smoke loops now include text across existing rendering effects. This change has not been visually verified in a real GPU browser session.

Complete focused render, game and explorer suites passed, including the text model/effect combinations and preservation of puzzle/history state. Original repository unchanged.

## Cubie sizing and contextual tuning (2026-11-09)

Added shared 40–100% cubie sizing, connected Tengen/Jelly seam preservation, inline shape/effect tuning, and independent transparency grain/opacity-response controls. Checks passed: build (including strict type boundary checks), game suite, explorer suite, render suite, settings availability and both settings navigation tests. Extended frontend smoke verifies real-Wasm Jelly sizing/cache restoration and unchanged puzzle state; transparency tuning preserves mesh buffers. Geometry tests cover discrete styles and connected Tengen dimensions/seam continuity.

The real-browser gate was attempted. Chrome started but DevTools `Runtime.enable` timed out before page navigation, with Windows encryption/registry errors in the browser log. This run provides no real-browser visual verification; mocked WebGL smoke results are not a substitute.

## Sized geometry correction (2026-11-09)

User screenshots exposed Tengen cracks and Jelly elbow fins in the previous post-triangulation sizing warp. Removed that warp. Angular CSG now sizes run volumes before clipping/triangulation; native Jelly has an additive sized-mesh export, generating thinner run fields with bounded elbow blending. O-ring tube thickness scales around its centerline. Existing native mesh exports retain full-size behavior.

Regression checks cover Tengen planar triangles at 40/65/100% (including O rings), connected thin Jelly arms and empty inner corners at both elbow extremes. All nine native mesh tests, render/game/engine/explorer suites and the build passed. Full-size restoration compares geometry, permitting eviction from the bounded mesh cache. Real-browser verification was attempted but timed out at DevTools Runtime.enable before app navigation; no visual certification claimed.

## Milestone 4: shared appearance schema, first increment (2026-11-09)

Introduced `data/appearance-settings.json`, generated browser metadata and repeated tuning controls, a versioned preference store with legacy import, schema-driven inline availability/commit timing, and shared tuning CSS loaded in all app modes. Existing custom controls, game rules, display/assembly preferences and explorer filters retain their owners. The plan is marked in progress with the remaining scope explicit.

Passed: settings generation/freshness, storage migration/validation/future-format protection, schema-control integration, both navigation suites, appearance tests, game and explorer suites, versioned packaging and build/type checks. CI now runs the focused settings suite. Real-browser smoke started Chrome but timed out at DevTools Runtime.enable before app navigation, with Windows encryption/registry errors; no real-browser UI verification claimed.

## Milestone 4: display/assembly schema, second increment (2026-11-09)

Migrated assembly choices, viewport-size controls and theme selection to `data/display-settings.json`. Both apps' controls and the shared assembly option list now derive from that schema. The existing display API delegates to the shared versioned store, retaining per-key notifications, numeric rejection/fractional values, legacy alias precedence and protection of future envelopes. Appearance settings remain in their separate storage domain; game rules and explorer filters are unchanged.

Passed: settings schema/migration/binding/navigation tests, game and explorer suites, and build/type checks. Tests include legacy aliases with default, explicit and falsy destination values, versioned reloads, invalid enum/range inputs and live theme/assembly/size controls. Real-browser gate again timed out at DevTools Runtime.enable before app navigation. Milestone 4 remains in progress; input preferences and wider CSS consolidation remain.

## Milestone 4: shared input preferences, third increment (2026-11-09)

Migrated control/orbit defaults and persistence to separate settings schemas and generated the repeated drag-response/alignment sliders. Preserved strict saved booleans, command coercion, smooth-to-xyz aliases, fractional/clamped orbit values, atomic mode updates, custom camera mappings and gesture policy. Identical camera range, disabled and diagnostics styles now have one shared owner.

Passed: input preference migration, control/orbit synchronization, mouse bindings, settling-orbit and wide-drag tests; focused settings suite; game and explorer suites; build/type checks; versioned packaging. Added `npm run test:input`. The attempted real-browser gate again timed out at Runtime.enable before navigation. Wider settings/CSS review remains before milestone completion.

## Milestone 4: completion review (2026-11-09)

Grouped active game/explorer settings navigation CSS into dedicated component sources. Generator expansion preserves the original cascade positions; extraction verified identical stylesheet tokens excluding comments/whitespace. Added the missing authoring gate: a temporary project receives one new schema field, then the real generator/binder/store produces accessible controls for both apps with conditional visibility, numeric validation and versioned persistence/reload. Stale control and CSS outputs are rejected.

Passed: settings-authoring gate, focused settings/input suites, game/explorer suites, build/type checks and versioned packaging. The real-browser gate started Chrome but timed out at Runtime.enable before navigation, with Windows encryption/registry errors. Implementation is complete at the planned ownership boundary; final browser verification remains outstanding. The milestone review explicitly records remaining custom adapters and leaves obsolete app-wide CSS removal to milestone 7.
