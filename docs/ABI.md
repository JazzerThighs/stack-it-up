# Wasm ABI v3

C ABI exports with linear-memory buffers; no wasm-bindgen or JS rules engine.
Call pointer exports before their length exports, then copy before another call can
allocate/grow memory.

Commands: `game_init(seed)`, `game_turn(0..29)`, `game_choose(0..5)`, `game_hold()`,
`game_undo()`, `game_set_gravity(0..2)`, `game_set_fragments(0|1)`.
Turn, choose, hold and undo return 1 when accepted, otherwise 0.

`state_ptr()` / `state_len()` expose 166 u32 words:

| Slots | Meaning |
| --- | --- |
| 0–26 | Stack colors: 0 empty; 1–6 O/T/L/J/S/Z |
| 27–53 | Original placement IDs |
| 54–55 | Active mask, current piece |
| 56–61 | Next six pieces |
| 62–68 | Pieces, clears, score, gravity face+1, top-out, winning moves, undo count |
| 69–79 | Last face/piece, cleared faces, revision, occupancy, ABI=3, auto fills/tiers, clear count, pending faces, last mask |
| 80–133 | Six outside-view face maps |
| 134–139 | Letter display masks |
| 140–151 | Edge/corner inventories |
| 152–157 | Pending masks by face |
| 158–165 | Gravity mode, floating mask, credits, perk enabled, float count, float overlaps, held piece, hold used |

`events_ptr()` / `events_len()` expose records of **86 words**: kind, mask, face+1,
board[27], ids[27], origins[27], floating mask, fragment credits. Kinds: 1 target lock,
2 clear, 3 gravity, 4 fragment lock, 5 fragment release.

`previews_ptr(move)` / `previews_len()` expose triples: destination mask, piece code,
source active mask. The browser adapter deduplicates destinations and unions sources.

`mesh_ptr()` / `mesh_len()` expose interleaved f32 position, normal, RGB: nine floats
per vertex. `test-api` fixture exports are excluded from the distributed release.

## ABI 4 additions

The snapshot now has 226 words. Offsets 0–165 and the 86-word animation event
format remain unchanged. `game_set_modes(bandaged, random_cubies, rebuild_mode)`
sets independent flags and reconstruction 0=off, 1=all, 2=random per cleared face.

| Offset | Meaning |
| --- | --- |
| 166 | White bandaging enabled |
| 167 | Random single-cubie release enabled |
| 168 | Reconstruction mode |
| 169 | Reconstruction cubie mask |
| 170 | Number of reconstruction groups not yet valid |
| 171 | Bitset of bandage-legal moves (30 bits) |
| 172–198 | Reconstruction color by cubie cell; zero otherwise |
| 199–225 | Connected white band id per cell; zero if unbandaged |

Bandage/reconstruction identities, RNG and flags live in State and are cloned by
undo/prediction. `engine/modes.rs` owns release ordering, connections, move legality
and reconstruction recognition. No JavaScript gameplay fallback was added.

## Early band locking extension

Snapshot layout remains ABI v4. New frontend builds also require `game_set_early_lock(enabled)`, `game_lock_band(cell)` (returns success), `band_mesh_ptr(mask)` and `band_mesh_len()`. The mesh is a connected white rounded surface, copied before another mesh call. Early locking preserves the current piece and defers clear resolution until normal placement. The option is enabled by default; the browser enables bandaging by default on game startup.

Slice clears: `game_set_slice_clears(1)` requires every cell (default); `2` requires surface cells only. `0` is retained for old-rule regression fixtures. `game_slice_clear_mode()` reports the current mode, including after Undo. Snapshot slot 71 and last-clear event ids now include internal X/Y/Z planes at bits/ids 6, 7, 8. Each distinct plane counts once; cell deletion uses their union.
