# Retained cut shapes

## Family Explorer

**Lock shapes** is available when the live cube matches a packing admitted by the current filters. It captures that visible packing, including its orientation, as the starter. Slice turns carry the starter's cut surfaces with their cubies.

While locked, Choose Packing, Random, arrows, and line navigation remain within that family. Filter resets do not release the family lock. Each new destination resets to the starter, maps physical piece identities, constructs and verifies a legal quarter-turn path, and animates it. These paths are constructive, not necessarily shortest paths or precomputed family graph edges. Destination colors follow the selected color scheme; original surfaces remain fixed. Unlock shapes can cancel playback. Leaving Family Explorer releases the lock.

The family assembly preference is temporarily overridden while locked; unlocking restores it. Recognition and metadata still follow the filters. The lock is session-only.

## Independent Lock colors

**Lock colors** captures the visible colors of the current matched packing. Shapes
are rebuilt from the current detected tetracubes after each turn, using the current
filters. Incomplete or excluded groups appear as individual cubies. Starting color
assignments stay attached to physical piece IDs even if their tetracube letters change.

Like Lock shapes, this pins the family and replays each new destination from the
captured starter. Both locks can be enabled together. Unlocking one preserves the other; only releasing the last lock unpins the family and restores the assembly preference. Adding Lock colors preserves the existing shape starter and captures the visible piece colors. Adding Lock shapes captures the current matched packing as the new shape starter while preserving any color lock. Color-mode
changes are deferred while colors are locked, and apply when unlocked. Custom palette
edits still change the palette itself. Leaving Family Explorer releases the lock.

## Game stack

Piece assembly → Stack → **Placed Shapes - Keep Cut Pieces** preserves the surfaces captured at placement. Clearing removes segments; gravity translates the survivors without remeshing their shape. Released stack cells carry their original surface and orientation invisibly while active, and restore those surfaces when they lock again. Active Pieces keeps its own assembly preference. Colors follow the current game state.

The renderer reuses cached closed fragments and exposes cut caps only where original neighbors no longer meet. Undo restores the corresponding shape history, including when the engine's 100-entry undo history rolls over. Visual settings can be changed without changing the puzzle rules.

Shape history is cosmetic runtime state, not part of the native shared-state bitmask format. Loading/reloading a saved game begins a new shape baseline from its available stack and freed groups; past cuts cannot be recovered from those bitmasks alone.

## Checks

- `node tests/retained-pieces.mjs`
- `node tests/retained-stack.mjs`
- `node tests/retained-stack-engine.mjs` (requires built Wasm)
- `node tests/frontend-smoke.mjs` (requires current build; mock WebGL)
- PowerShell: `$env:FAMILY_LOCK_ONLY='1'; node tests/explorer-smoke.mjs` (requires current build; real packing data, mock DOM/WebGL)
