# Project guide

This is the independent refactoring copy of Tetris Cube Explorer. Work only in this folder unless the user requests changes to the original.

Read `docs/ARCHITECTURE.md` for the current code map and `docs/REFACTOR_PLAN.md` for staged changes. The current dual game/explorer is authoritative; do not reintroduce a historical HTML rules oracle.

- Rules and deterministic computation: `crates/puzzle-core/src/`.
- ABI layout source: `data/engine-abi.json`; regenerate with `node tools/generate-abi.mjs`. Never edit generated ABI constants directly.
- Engine type checks: `npm ci` once, then `npm run typecheck`. Native signature changes require `npm run types:generate`. Strict checking covers transport, presentation/provenance, game commands and explorer mode transitions.
- Wasm transport: `src/abi.rs` and `web/engine/transport.js`.
- Engine presentation/history: `web/engine/presentation.js`; browser compatibility facade: `web/engine/wasm.js`.
- Game command ownership: `web/game/controller.js`; UI effects: `web/ui/game-effects.js`. Keep engine mutations out of effects. Test controller changes with `node tests/game-controller.mjs`.
- Game session setup/sharing: `web/game/session.js`; setup control reader: `web/ui/game-setup.js`; dialog bindings: `web/ui/session.js`. Test with `node tests/game-session.mjs`.
- Game UI: `web/app.js`, `web/ui/`, `web/input/`.
- Persistent worker RPC: `web/workers/rpc.js`; stale UI result guards: `web/workers/latest-request.js`. Test with `tests/worker-rpc.mjs`.
- Explorer: `web/explorer/`. Family ledger/caches: `family-session.js`; path-worker lifecycle: `web/workers/task.js`. Test with `tests/family-session.mjs` and `tests/worker-task.mjs`.
- Rendering: `web/render/` and explorer retained geometry.
- Piece catalog source: `data/pieces.json`; regenerate with `node tools/generate-pieces.mjs`.
- Browser smoke setup: `tests/fixtures/browser.mjs`; use its options instead of copying DOM/WebGL/frame mocks. Keep browser application smoke runs in separate processes.
- Focused tests: `npm run test:core`, `test:engine`, `test:game`, `test:explorer`, `test:render`. Build Wasm/browser assets first with `node tools/build.mjs` where required.

Keep extractions separate from gameplay changes. Preserve saved-state formats, coordinate conventions and physical-piece identities. Do not hand-edit generated catalogs or `dist/`. Read only the relevant owner modules and tests before expanding an investigation. Mock-WebGL tests are not visual or performance certification.

- Explorer catalog selection/navigation policy: `web/explorer/packing-selection.js`; DOM adapter: `spatial-explorer.js`. Test with `node tests/packing-selection.mjs`. Reject stale query results before applying them to the model.

- Practice playback sequencing/cancellation: `web/explorer/playback-controller.js`; UI callbacks: `web/explorer/views.js`. Test with `node tests/playback-controller.mjs`; worker lifecycle remains in `web/workers/task.js`.

- Explorer turn history and generated undo floors: `web/explorer/cube-session.js`. Do not mutate history in views. Test with `tests/cube-session.mjs`.
- Explorer mode lifecycle: `web/explorer/view-controller.js`; game/application DOM switches: `web/ui/view-switching.js`. Tests: `view-controller.mjs`, `view-switching.mjs`.

- Rule/control bits and state/share version metadata: `data/game-contract.json`; regenerate with `node tools/generate-game-contract.mjs`. Counted/versioned state framing is schema-generated; semantic state validation remains in native sharing.rs. Never conflate ABI, native-state and share-envelope versions.

- Real-browser gate: `npm run test:browser` after building. Uses installed Chrome/Edge or `BROWSER_PATH`, an isolated temporary profile and actual WebGL. Never silently skip a missing/crashing browser.

- Extruded text cubies: `web/render/text-mesh.js` (initial [] glyphs). Tests: `node tests/text-style.mjs`; shared game/explorer model dispatch belongs in piece-mesh.js and explorer geometry adapters.

- Shared appearance schema: `data/appearance-settings.json`; regenerate with `npm run settings:generate`. Generated control blocks/browser schema are not edited manually. Preference storage: `web/ui/settings-store.js`; availability: `web/ui/style-tuning.js`; shared tuning styles: `web/ui/settings-components.css`. Run `npm run test:settings`. Preserve legacy preferences; keep settings versions separate from engine saves/ABI.
- Shared display schema: `data/display-settings.json`; the same settings generator owns assembly/size/theme controls and reusable assembly labels. Preserve legacy alias precedence, display range rejection and key-specific notifications. Test with `tests/display-settings.mjs`.
- Input preference schemas: `data/controls-settings.json`, `data/orbit-settings.json`. Generate with the shared settings tool. Keep gesture routing and derived orbit availability in `web/input/`; mode flags must publish atomically. Run `npm run test:input` after input preference changes.
- Settings navigation CSS sources: `web/ui/game-settings.css`, `web/ui/explorer-settings.css`. The settings generator expands marked stylesheet blocks in place to preserve cascade order. Do not hand-edit those generated blocks. `tests/settings-authoring.mjs` verifies schema-only additions and stale-output detection in a temporary project.
- Startup default policy: `web/ui/startup-defaults.js`, documented in `docs/SETTINGS_DEFAULTS.md`. Defaults precede saved preferences; never reapply on menu open or tab changes. Shared menu/portal ownership: `web/ui/shared-settings.js`; preserve scoped explorer lookups and real control nodes. Run `npm run test:settings`, then build and game/explorer smoke tests after changing initialization.
- Geometry preparation workers: `web/workers/geometry-preparation.js`, `geometry-worker.js`, `geometry-client.js`; explorer adapter: `web/explorer/worker-geometry.js`. Run `npm run test:geometry-worker` after changes. Keep transfer copies/coverage explicit, preserve cache ownership, reject stale revisions, and terminate workers before destroying renderer resources. The current rollout covers connected explorer cubes; game/hover integration is separate.
