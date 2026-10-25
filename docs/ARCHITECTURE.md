# Architecture

Rust owns the board, piece identities, active inventory, fragments, queue, hold,
gravity, score, pending choices, history and RNG. The stack game does not simulate its rules in JavaScript.

`Game` manages commands and history; `State` implements deterministic transitions
against immutable precomputed `Tables`. Gravity and connected groups are isolated.
Undo clones the complete state, including pocket, credits, RNG and last placement.
Predictions use the same transition path on a copy; they return both destination
masks and original active masks for source-cubie glow, without consuming live RNG.

The Wasm adapter immediately copies exported buffers so memory growth cannot detach
retained views. Named `S` fields in `engine/snapshot.js` replace magic scalar offsets.
The application injects a live context through getters into presentation controllers.
Input requests commands. Animations consume events without writing display positions
back into the engine. Settings affecting rules go through Wasm commands.

The renderer owns buffers and camera orientation. Geometry, shaders, scene decorations
and depth/transparency orchestration live in separate modules. All scene geometry
shares camera depth normally. Custom layer order isolates depth only between explicitly
ordered categories. Within a group, opaque meshes write depth and translucent
primitives sort back-to-front. HTML arrow buttons remain accessible hit targets.

## Extending behavior

1. Implement the state transition in the relevant Rust module.
2. Keep prediction and command behavior on the same rules path.
3. Version ABI changes deliberately and update the adapter with them.
4. Add native invariants and JavaScript/Wasm differential fixtures.
5. Add presentation through input, UI or renderer modules rather than JS rules.

The historical HTML is pinned only under tests as an oracle; it is never copied to
the production build. The packing explorer is a separate bundled application.

## Verification

Differential tests compare every gameplay snapshot field except revision and ABI
metadata, plus complete animation event buffers, against the current JavaScript
edition. Native tests cover moves, real centers, optimal spawn separation, fallback
tiers, ambiguity, clear/fragment identity, hold and undo. Browser smoke tests import
actual ES modules and use real Wasm with mock DOM/WebGL; these do not establish visual
pixel correctness on a real GPU.

## Packing explorer

The explorer is separate from stack gameplay. `explorer/model.js` owns monochrome
cubie permutations, the measured explorer-to-renderer coordinate transform, exact
family correspondence, random pair selection, and orientation-independent matching.
`explorer/cube-view.js` specializes the game Renderer with packing state and an
injected gesture context. It reuses geometry, shaders, camera, input, GPU buffers,
and depth/transparency ordering without accessing the game's application state.
`explorer/views.js` owns normal/practice view lifecycle and playback; `script.js`
retains catalog parsing, filtering, official color arbitration and facelet output.

Family correspondence sorts no colors by letter: it matches distinct physical
piece descriptors under proper spatial rotations, including their exact centers.
Extras form a separate group. This is the same invariant documented by the surface
family refiner. Both endpoints retain all 27 cells; only surface cells are normally
visible. Mesh buffers are rebuilt for state/animation changes; orbit changes
uniforms. Idle views do not run continuous rendering loops.

Explorer tests verify all 13,606 documented family members against their family
representative, all move animation endpoints/inverses, the measured six-face
coordinate map, and startup/practice controls using the full bundled catalog.
