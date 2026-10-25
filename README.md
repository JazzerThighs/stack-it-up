# Stack It Up — Rust + WebAssembly

Current feature baseline: `stack-it-up-codepen.html` version 24. Rust owns all game
rules; the browser owns input and presentation. The JavaScript edition stays separate.

## Run the included build

Install Node.js and run from this extracted project folder:

```powershell
node tools/serve.mjs
```

Open **http://127.0.0.1:4173**. The archive includes compiled `dist/`; Rust is only
needed to rebuild. Opening HTML through `file://` will not load Wasm correctly.

## Build and test

Requires Rust 1.91+, its Wasm target, and Node.js 22+. No Cargo/npm dependencies and
no `npm install` step are needed.

```powershell
rustup target add wasm32-unknown-unknown
node tools/build.mjs
npm test
cargo clippy --offline --all-targets -- -D warnings
```

`start.ps1` builds, opens the browser and starts the server. `npm test` runs native
rules tests, builds Wasm, checks parity against the pinned JavaScript reference,
and imports the actual browser modules with real Wasm and mock DOM/WebGL.

## Included features

- Real movable centers; face, slice and wide turns; ambiguous placement choice.
- Hold pocket, once per placement, with deterministic queue and full undo.
- Facebound, surfacebound, then internal gap-fill fallback before top-out.
- Gravity off, clear-only gravity, or randomized continuous gravity.
- White movable broken-piece fragments; multi-clear credits and relocking.
- Drag-to-turn, free camera rotation, optional arrows and classic controls.
- Combined/split cubes with aspect-aware animation and fixed HUD.
- Hover rings, optional move labels, source-cubie placement glow.
- Optional spherical active cubies and cel-style affected-cubie silhouettes.
- Normal camera depth by default; reorderable rendering categories.
- Independent grids and transparency; rear-face grids enabled by default.
- Grouped settings; ring labels, spheres and hover outlines default off.
- Native WebGL packing explorer with drag turns, solution playback and live 3D pieces.
- Side-by-side practice: chosen source lines or two random members of one family.
- Practice colors follow physical pieces; aligned targets, undo/reset and match detection.

## Code map

| Location | Responsibility |
| --- | --- |
| `src/engine/coordinates.rs` | Coordinates, face conventions, constants |
| `src/engine/tables.rs` | Moves, placements, inventories, ranked spawn masks |
| `src/engine/state.rs` | State, spawning, locking, queue, fragment identities |
| `src/engine/gravity.rs` | Connected groups, gravity and clearing cascades |
| `src/engine/game.rs` | Commands, hold, undo, choices, predictions |
| `src/abi.rs` | Wasm commands and serialized buffers |
| `src/mesh.rs` | Connected stack geometry |
| `web/engine/` | Wasm adapter, named snapshot fields, coordinate helpers |
| `web/input/` | Picking and drag gesture lifecycle |
| `web/render/` | Geometry, shaders, depth pipeline, scene decorations |
| `web/ui/` | Settings, move buttons and animation choreography |
| `web/app.js` | Application state, HUD, commands and view switching |
| `web/explorer/` | Existing packing browser and data |

See [architecture](docs/ARCHITECTURE.md) and [ABI contract](docs/ABI.md).

## Package or deploy

```powershell
python tools/package.py
```

Produces `stack-it-up-rust.zip`, containing source, tests, docs and the compiled
browser build, excluding Rust caches. Upload `dist/` to a static host with Wasm MIME
support. The game and packing explorer have no external runtime network dependencies.
The database and graphics modules are bundled locally.

Automated graphics checks use mock WebGL. Real-browser visual approval and GPU
profiling remain separate checks.

## Packing practice

Open **Packing**, then enable **Two-packing practice**. Enter any two database
source line numbers and choose **Load pair**, or choose **Random pair in same
family**. Random selection respects the current explorer filters and picks two
different members; broaden the filters if none qualify. You can also copy the
current browser selection into either line field.

Drag stickers on the start cube to turn slices; Alt-drag makes a wide turn.
Right-drag or drag outside the cube to orbit. The target is orbit-only. Turn
buttons, a move selector, undo and reset provide alternatives. Keyboard U/D/F/B/L/R,
M/E/S perform turns; Shift reverses, Home resets the camera. Target recognition
accepts all 24 whole-cube orientations.

Practice assigns six distinct physical-piece colors and transports them to the
target using the exact family invariant (corner/edge counts and center locations).
Surface extras are white, the empty core gray. Canonical letter colors are not
used for practice, since a physical piece can change letters. Arbitrary pairs
outside this invariant remain viewable but are marked comparison-only. There is
no solver for arbitrary practice pairs; solution playback belongs to the normal
scrambled view.

`web/explorer/AnimCube3.js` and `web/explorer/legacy/` preserve the original
integration. Active facelet generation and its debug panel remain available.
These legacy renderers are not loaded by the new explorer.

## Combinable clear rewards

Settings → Gameplay has independent switches for broken-fragment release (the
existing default), white-fragment bandaging, and one random white cubie per cleared
face. Reconstruction offers Off, All intact pieces, or One random intact piece per
cleared face. The new options default off. All 24 combinations are supported.

Rewards apply after a placement's clear/gravity cascade. Whole pieces are selected
first, broken fragments second, individual cubies last, without duplicate selection.
Selections stop when eligible pieces/cubies run out. Random selections and mode
state are included in undo; new games retain your selected settings.

Bandaging connects adjacent white cubies of the same original piece. A slice/wide
turn may move an entire connected fragment or none of it; turns that split it are
rejected before animation and excluded from placement hints. White links show bonds.
Reconstruction groups are not bandaged. They retain their color and their original
four cubies/identity; no cubies are substituted or borrowed from another group.
They must all form valid planar tetrominoes before the current queued piece can
lock. Facebound recognition takes priority; interior planar forms remain valid for
pieces that have fallen inward. On lock their colors change to their detected
shapes, without extra piece/score credit. Freed cubies must avoid the fixed stack.
Switching off a release mode stops future rewards; existing releases finish their
current turn. The old multi-clear credit behavior remains for broken fragments.

## Wide face controls

Use the bottom **Regular turns / Wide turns** toggle, or hold **Shift** while dragging a face, to turn the outer two layers together. Alt remains supported. Inner slices stay single-layer. The width locks when the drag direction is selected; bandage legality is still enforced by the engine.

## Early locking of bandaged fragments

Bandaging and **Allow early locking** are enabled by default. Select **Lock white pieces**, then click any member of a connected white group to settle the entire group into the static stack. Choose **Resume turns** to return to slice dragging. Right-drag still orbits. Groups overlapping the stack cannot lock; colored active cubies may overlap temporarily and can move away afterward.

This action preserves the active piece, queue, score, fragment-turn allowance and other floating groups. Undo restores it. Face clears and reward processing wait for normal colored-piece placement, so early locking does not immediately free the group again. Groups you do not click still lock normally.

White bands use the same connected rounded surface as placed pieces, independent of the sphere preference. They breathe inward as a single surface. Other active cubies breathe below the cell boundary; overlap markers sit outside their maximum extent.

## Face and slice clearing

Gameplay clears outer faces and all three middle slices. **Full slice — interior required** is the default: a 3×3 middle slice needs all nine cells, including the core. **Surface ring — interior not required** needs eight surface cells. Both remove the entire slice, including any occupied interior cells. Completed planes are detected together, their union is removed once, and each plane grants 500 points and the usual clear rewards.

With clear-triggered gravity, an internal slice pulls separate fragments inward from both sides toward that plane. Gravity-off and always-on modes retain their behavior. Internal plane ids are 6/7/8 (X/Y/Z), after the six face ids. A simultaneous batch uses the last plane in deterministic clear order for clear-triggered gravity.

## Full-page packing explorer

The Packing tab mounts directly in the application page, without an iframe. Switching tabs preserves game and explorer state. Cubes fill the workspace; filters, packing details and practice setup open as overlays. Small screens use view tabs.

The **Target cube** is an orbitable reference. **Whole tetrominoes** follows either the scrambled cube (default) or target, including drag/turn frames, undo and reset. This third view always uses connected geometry, with adjustable transparency. Facelet generation and AnimCubeJS references are preserved.
