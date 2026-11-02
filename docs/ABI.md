# Wasm ABI v4

C ABI exports with linear-memory buffers; no wasm-bindgen or JS rules engine.
Call pointer exports before their length exports, then copy before another call can
allocate/grow memory.

Commands: `game_init(seed)`, `game_turn(0..29)`, `game_choose(0..5)`, `game_hold()`,
`game_undo()`, `game_set_gravity(0..2)`, `game_set_fragments(0|1)`.
Turn, choose, hold and undo return 1 when accepted, otherwise 0.

`state_ptr()` / `state_len()` expose 226 u32 words:

| Slots | Meaning |
| --- | --- |
| 0–26 | Stack colors: 0 empty; 1–6 O/T/L/J/S/Z |
| 27–53 | Original placement IDs |
| 54–55 | Active mask, current piece |
| 56–61 | Next six pieces |
| 62–68 | Pieces, clears, score, gravity face+1, top-out, winning moves, undo count |
| 69–79 | Last face/piece, cleared faces, revision, occupancy, ABI=4, auto fills/tiers, clear count, pending faces, last mask |
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

Additional ABI-v4 snapshot ranges: 166 bandaging; 167 random singles; 168 rebuild
mode; 169 rebuilding mask; 170 pending rebuild count; 171 allowed moves; 172-198
rebuild colors by cell; 199-225 white band IDs by cell.

`rebuild_id_at(cell)` returns the physical placement ID for a freed whole-piece
cubie, or zero. This presentation-only accessor does not alter the snapshot size
or saved-state transport. The JS adapter attaches its 27 values as `rebuildIds`
on each snapshot; animation copies and turns explicitly preserve that metadata.


Random release rules retain the 226-word ABI-v4 snapshot. `game_set_release_rules(trigger, bandaged, scattered, selection)` accepts triggers 0=off, 1=per cleared plane, 2=per placement turn; selection 0=uniform eligible group, 1=occupied-cubie weighted, 2=one uniform cell among all 27 (no retry), 3=largest connected group, 4=smallest. `game_release_rules()` returns trigger in bits 0-1, bandaging in bit 2, scattered locking in bit 3, and selection in bits 4-6. Offset 170 includes random groups awaiting reconnection. Offset 199 remains authoritative for actual band membership, independent of the legacy bandage option at 166.

State transport v3 appends random-release options, the last placement-turn counter that received the perk (u32::MAX means none), and the released-group masks after the v2 gravity flags. Default legacy configurations continue to export v2. Imports accept v1/v2/v3. Group masks rotate with floating cubies, survive undo and sharing, and disappear on locking. The forecast uses this same transport and native transitions; the once-per-turn marker is part of its search key.


## Spatial piece extension

The scalar snapshot remains 226 words, version 4. Piece IDs now also include 7=B, 8=D, 9=F. A new browser checks for `game_set_piece_pool` before use.

- `game_piece_pool()`: enabled queue types as a nine-bit mask (bit zero is O).
- `game_set_piece_pool(mask, redeal)`: validates a nonempty subset of 511; redeal is permitted only before any placed pieces. Without redeal, keeps current and held pieces and replaces the future queue. Participates in undo.
- `game_choice_mask(choice)`: returns the candidate mask or zero. Spatial choices use IDs 6..20; legacy faces use 0..5. Snapshot word 78 is now a choice bitset. The six masks at 152..157 remain face-only.
- `game_choose(choice)`: accepts either kind of pending choice. Spatial locks leave LAST_FACE zero and carry LAST_MASK as normal.

State transport v5 preserves existing header/variable sections, writes the v3 release extension and v4 rules/plane tail, and then appends `piece_pool`. In v5, rules `0xffffffff` means legacy mode. Classic states with the default classic pool retain legacy transport versions. Import validates v5 IDs, pool, and non-core spatial active inventory. Readers supporting only v1..v4 must reject v5 rather than reinterpret it.

## Reconstruction shape rules

State transport v6 uses the v5 payload layout, including the queue pool. Rules
bit 23 marks the new reconstruction semantics; bit 21 restricts four-cubie
reconstructions to queue-enabled shapes, and bit 22 requires their original
shape. Both restrictions apply when both are set. Bit 14 still requires
face-to-face connectivity. When it is off, the shape restrictions are ignored.
With connectivity on, groups smaller than four need only reconnect within their
own group; four-cubie groups must form a catalog tetracube. Bit 15 no longer
restricts modern reconstructions to one outer face. Original shape is captured
from the released geometry, with its prior shape ID preferred where applicable.
Legacy transports retain their previous reconstruction rules. Older readers
must reject v6 rather than reinterpret it.

`active_group_at(cell)` provides presentation identity for all freed cubies.
Partial groups use the high bit plus their group index; whole groups retain
their physical placement IDs. The browser uses these values in `rebuildIds`
to assign distinct solids to freed groups, including partial fragments.

## Free queue choices and plane gravity

Queue/hold IDs 10 and 11 represent J/L and S/Z choices. They are queue options,
not new geometric catalog entries. Queue pools now accept bits 0–10. Placement
uses the union of both choices, retaining the planar automatic fallback tiers.
Board and fragment color IDs remain 1–9. The selected face determines the placed
shape/color. An ID-to-choice map preserves the original free choice through
release, reconstruction, gravity, undo and state sharing. Reconstruction queue
constraints accept either constituent when the corresponding free option is enabled.

Rules bit 24 selects plane gravity (enabled in new-game UI defaults). A nonempty
layer perpendicular to gravity moves only into a completely empty adjacent layer;
its occupied cells keep their offsets, colors and IDs. The existing one-cell
limit applies independently to each moving layer. With this bit off, legacy
fragment gravity remains available.

Transport v7 retains the v6 layout and appends a count followed by (placement ID,
original queue choice) pairs for surviving free-origin pieces. It supports an
11-bit pool and queue/hold values up to 11, while stack/floating colors stay bounded
to nine. Previous transport versions retain their rules and do not gain plane gravity.
