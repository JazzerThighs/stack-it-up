# Development workflow

## Pick the smallest meaningful check

Start with the behavior a player can observe, the view and input that trigger it, and how to tell it is fixed. On an orientation or slice-direction change, for example, name the expected front/up faces or moved cubies and verify through the input and rendering paths. Success in a coordinate helper alone cannot establish what the player sees.

| Change | First check | Broaden when |
| --- | --- | --- |
| Rules, identities or serialized state | `npm run test:core` | Rebuild and run `npm run test:engine` when the native/browser boundary changes. |
| Game or explorer behavior | Run the owner test listed below | Run `test:game` or `test:explorer` via npm for initialization, view switching and integration. |
| Defaults, menus or input | `npm run test:settings` or `npm run test:input` | Exercise game and explorer startup for shared controls, including saved preferences. |
| Mesh or worker changes | `npm run test:geometry-worker` or `npm run test:render` | Use the [browser benchmark](performance/BROWSER_BENCHMARK.md) for performance claims and an actual browser for appearance. |
| Release or cross-cutting changes | `npm test` builds artifacts and runs the full manifest | Run `npm run test:browser` against the finished build. Record hardware-dependent checks separately. |

Run commands from the repository root. See [README](../README.md) for setup. Focused suites do not build automatically. Run `npm run build` first for tests consuming release Wasm or `dist/`, including the wide-turn input test. A build replaces `dist/`, so let it finish before starting browser checks. Use the [suite manifest](../tools/test-suites.json) to find individual tests. Keep the task's reproduction, commands run, result and any unverified view or device together in the handoff.

## Workflow evaluation

| Finding | Action and rationale |
| --- | --- |
| Root agent instructions mixed project rules with per-module history and commands. | Keep the root entry short. Consult only the relevant owner notes below and the [architecture](ARCHITECTURE.md) before widening the search. This follows OpenAI's repository-map approach. [Harness engineering](https://openai.com/index/harness-engineering/) |
| An older root backlog mixed shipped behavior, possible bugs and design questions with an active milestone plan. | Track milestones in the [implementation plan](IMPLEMENTATION_PLAN.md). Consult [maintenance notes](MAINTENANCE_NOTES.md) for invariants and decision criteria. Describe the actual symptom and acceptance condition when selecting work, as recommended in [GitHub's Copilot guidance](https://docs.github.com/en/copilot/tutorials/optimize-ai-usage). |
| The aggregate suite consumed a release Wasm artifact before building and ran display settings twice. | Build first in the aggregate manifest. Keep focused commands available for fast iteration. |
| The conflict scan read the entire ignored packing-clue export into memory and failed once it exceeded 2 GiB. | Skip the root enumerator output while continuing to check source files, including untracked work. |
| The [Pages workflow](../.github/workflows/pages.yml) maintains a separate selection of test commands and runs on main pushes or manual dispatch. | Next improvement: define a named release suite in the existing manifest and call it from CI. Compare its command coverage with today's workflow before switching. A pull-request check could then reuse it without granting deployment permissions. |
| Browser mocks, actual WebGL and physical smartcubes provide different evidence. | Report which one was exercised. Promote repeated compatibility failures into owner-level tests, and keep device-dependent acceptance in the milestone plan. |

## Owner modules and compatibility rules

Paths below are relative to the repository root.

### Rules, contracts and engine

- Rules and deterministic computation: `crates/puzzle-core/src/`.
- ABI layout source: `data/engine-abi.json`; regenerate with `node tools/generate-abi.mjs`. Never edit generated ABI constants directly.
- Engine type checks: `npm ci` once, then `npm run typecheck`. Native signature changes require `npm run types:generate`. Strict checking covers transport, presentation/provenance, game commands and explorer mode transitions.
- Wasm transport: `src/abi.rs` and `web/engine/transport.js`.
- Engine presentation/history: `web/engine/presentation.js`; browser compatibility facade: `web/engine/wasm.js`.
- Piece catalog source: `data/pieces.json`; regenerate with `node tools/generate-pieces.mjs`.
- Rule/control bits and state/share version metadata: `data/game-contract.json`; regenerate with `node tools/generate-game-contract.mjs`. Counted/versioned state framing is schema-generated; semantic state validation remains in native sharing.rs. Never conflate ABI, native-state and share-envelope versions.

### Game and explorer

- Game command ownership: `web/game/controller.js`; UI effects: `web/ui/game-effects.js`. Keep engine mutations out of effects. Test controller changes with `node tests/game-controller.mjs`.
- Game session setup/sharing: `web/game/session.js`; setup control reader: `web/ui/game-setup.js`; dialog bindings: `web/ui/session.js`. Test with `node tests/game-session.mjs`.
- Game UI: `web/app.js`, `web/ui/`, `web/input/`.
- Explorer: `web/explorer/`. Family ledger/caches: `family-session.js`; path-worker lifecycle: `web/workers/task.js`. Test with `tests/family-session.mjs` and `tests/worker-task.mjs`.
- Explorer catalog selection/navigation policy: `web/explorer/packing-selection.js`; DOM adapter: `spatial-explorer.js`. Test with `node tests/packing-selection.mjs`. Reject stale query results before applying them to the model.
- Practice playback sequencing/cancellation: `web/explorer/playback-controller.js`; UI callbacks: `web/explorer/views.js`. Test with `node tests/playback-controller.mjs`; worker lifecycle remains in `web/workers/task.js`.
- Explorer turn history and generated undo floors: `web/explorer/cube-session.js`. Do not mutate history in views. Test with `tests/cube-session.mjs`.
- Explorer mode lifecycle: `web/explorer/view-controller.js`; game/application DOM switches: `web/ui/view-switching.js`. Tests: `view-controller.mjs`, `view-switching.mjs`.

### Workers and rendering

- Persistent worker RPC: `web/workers/rpc.js`; stale UI result guards: `web/workers/latest-request.js`. Test with `tests/worker-rpc.mjs`.
- Rendering: `web/render/` and explorer retained geometry.
- Extruded text cubies: `web/render/text-mesh.js` (initial [] glyphs). Tests: `node tests/text-style.mjs`; shared game/explorer model dispatch belongs in piece-mesh.js and explorer geometry adapters.
- Geometry preparation workers: `web/workers/geometry-preparation.js`, `geometry-worker.js`, `geometry-client.js`; explorer adapter: `web/explorer/worker-geometry.js`. Run `npm run test:geometry-worker` after changes. Keep transfer copies/coverage explicit, preserve cache ownership, reject stale revisions, and terminate workers before destroying renderer resources. The current rollout covers connected explorer cubes; game/hover integration is separate.

### Settings and input

- Shared appearance schema: `data/appearance-settings.json`; regenerate with `npm run settings:generate`. Generated control blocks/browser schema are not edited manually. Preference storage: `web/ui/settings-store.js`; availability: `web/ui/style-tuning.js`; shared tuning styles: `web/ui/settings-components.css`. Run `npm run test:settings`. Preserve legacy preferences; keep settings versions separate from engine saves/ABI.
- Shared display schema: `data/display-settings.json`; the same settings generator owns assembly/size/theme controls and reusable assembly labels. Preserve legacy alias precedence, display range rejection and key-specific notifications. Test with `tests/display-settings.mjs`.
- Input preference schemas: `data/controls-settings.json`, `data/orbit-settings.json`. Generate with the shared settings tool. Keep gesture routing and derived orbit availability in `web/input/`; mode flags must publish atomically. Run `npm run test:input` after input preference changes.
- Settings navigation CSS sources: `web/ui/game-settings.css`, `web/ui/explorer-settings.css`. The settings generator expands marked stylesheet blocks in place to preserve cascade order. Do not hand-edit those generated blocks. `tests/settings-authoring.mjs` verifies schema-only additions and stale-output detection in a temporary project.
- Startup default policy: `web/ui/startup-defaults.js`, documented in `docs/SETTINGS_DEFAULTS.md`. Defaults precede saved preferences; never reapply on menu open or tab changes. Shared menu/portal ownership: `web/ui/shared-settings.js`; preserve scoped explorer lookups and real control nodes. Run `npm run test:settings`, then build and game/explorer smoke tests after changing initialization.
- Tests must not pin curated startup preferences to literal values. Startup/reset tests use the current authored defaults; behavior scenarios import `tests/fixtures/behavior-defaults.mjs` before application modules (and configure built module instances explicitly). Keep invalid-value, persistence and behavior assertions. `tests/defaults-customization.mjs` checks alternate preferences without editing the author's file.

### Browser checks

- Browser smoke setup: `tests/fixtures/browser.mjs`; use its options instead of copying DOM/WebGL/frame mocks. Keep browser application smoke runs in separate processes.
- Real-browser gate: `npm run test:browser` after building. Uses installed Chrome/Edge or `BROWSER_PATH`, an isolated temporary profile and actual WebGL. Never silently skip a missing/crashing browser.
