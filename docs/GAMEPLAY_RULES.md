# Gameplay configuration

The startup dialog and live settings reuse the same controls. Defaults follow the supplied gameplay table: For Science on; full faces and full slices on; gravity toward the last cleared plane after clears; all four piece sizes eligible; one uniformly selected eligible piece per cleared plane; connected, facebound fragment locking. Movement bandaging is disabled. The existing single-cell fall limit remains on.

## Semantics

- Face and slice ring tests require their eight perimeter cells. A successful ring removes the entire plane, including its center if occupied. A plane scores once even if both full and ring tests match.
- Gravity directions are toward/away from the last cleared plane, D, or a random face. Toward/away has no direction before the first clear. Away from an interior plane moves disconnected groups on either side outward; groups spanning that plane stay put.
- Always-on gravity runs after turns and placements. Clear-only gravity runs after each clear event, including cascades. Random direction changes once per placement, including automatic placements, not on turns or hold swaps.
- Eligible pieces are connected components sharing their original piece ID. Sizes 1–3 are fragments. Size 4 must be a valid whole tetromino. Whole pieces use the existing same-color pooled reconstruction rules; fragments retain their individual group masks through turns.
- Fragment connection and outer-face requirements are checked at locking only. Disabled connection ignores the saved facebound preference. Whole pieces still require reconstruction. No released cubies can overlap the stack when locking.
- Per-clear selection counts each cleared plane. Random-cell selection may miss an empty/ineligible cell without retrying. All-piece mode bypasses the lottery. Placement release happens once at the next piece start; enabling it midway through a turn does not turn Hold into a release trigger.
- For Science enables current-piece and hold-pocket editing (including empty), and Undo before top out. Editing current respawns only the current inventory and uses normal automatic-placement logic. At top out Undo remains available regardless of debug mode.

## Transport

Snapshot ABI remains v4 (226 words). `game_rules()` returns a packed configuration, or `0xffffffff` for legacy state. JavaScript normalizes that unsigned sentinel. `game_configure_rules(word)` rejects invalid groups and adopts the new rules; `game_debug_piece(held, piece)` validates debug permission. Saved-state transport v4 appends the configuration word and remembered gravity plane (0–8, 9 = none) to v3. Old versions remain importable with their old mechanics until explicitly changed.

Packed bits: 0 debug; 1–4 full face/ring face/full slice/ring slice; 5 gravity enabled; 6–7 direction; 8 always-on; 9 release enabled; 10–13 sizes 1–4; 14 connected; 15 facebound; 16–17 release event (clear/placement/all on clear); 18–19 selection (equal/cell/largest/smallest); 20 single-cell fall limit. At least one clear type and, when releasing, at least one piece size are required.

## Spatial whole-piece reconstruction

The effective same-face requirement (connection and facebound both checked) now also applies to whole pieces. With it off, exact-cover reconstruction accepts the three nonplanar tetracubes: Left Screw, Right Screw and Branch, alongside the existing planar shapes. Nonplanar shapes retain their logical source color and piece IDs. Placed Left Screws display light gray (#c8c8c8), Right Screws dark gray (#505050), and Branches brown (#996633). They render through the existing arbitrary-cell composite mesh, and remain eligible for subsequent whole-piece release. Current-piece spawning and the queue remain the six original letters. Legacy shared rules retain planar-only reconstruction.
